/**
 * Estado de la aplicación.
 *
 * El proyecto es la única fuente de verdad. Todo lo derivado —cálculo,
 * hallazgos, materiales y presupuesto— se recalcula con `useCalculo()`, nunca
 * se guarda, así que no puede quedar desincronizado del plano.
 */

import { create } from 'zustand'
import { produce } from 'immer'
import {
  ALTURAS_POR_DEFECTO,
  SUMINISTRO_POR_DEFECTO,
  type Ambiente,
  type Circuito,
  type Elemento,
  type Plano,
  type Proyecto,
  type Punto,
  type Tramo,
} from '@/dominio/tipos'
import {
  mismaSuperficie,
  remedirAmbiente,
  superficiesDeAmbientes,
} from '@/dominio/calculo/ambientes'
import { escalaDe, puntoEnPoligono } from '@/dominio/calculo/longitudes'
import { listaPreciosPorDefecto } from '@/dominio/computo/presupuesto'
import { guardarProyecto } from '@/persistencia/db'

export type Herramienta = 'seleccionar' | 'colocar' | 'tramo' | 'calibrar' | 'ambiente'

export interface EstadoApp {
  proyecto: Proyecto
  // --- Estado de edición, no se persiste ---
  herramienta: Herramienta
  simboloActivo: string | null
  circuitoActivo: string | null
  seleccion: string[]
  /** Puntos del tramo que se está dibujando. */
  tramoEnCurso: Punto[]
  /** Vértices del ambiente que se está delimitando. */
  poligonoEnCurso: Punto[]
  ortogonal: boolean
  snapActivo: boolean
  /** Capas del DXF ocultas por el usuario. */
  capasOcultas: Set<string>
  guardando: boolean

  // --- Acciones ---
  reemplazarProyecto: (p: Proyecto) => void
  actualizar: (fn: (p: Proyecto) => void) => void

  setHerramienta: (h: Herramienta) => void
  setSimboloActivo: (id: string | null) => void
  setCircuitoActivo: (id: string | null) => void
  setSeleccion: (ids: string[]) => void
  setOrtogonal: (v: boolean) => void
  setSnapActivo: (v: boolean) => void
  toggleCapa: (nombre: string) => void

  /** Deja el proyecto con este plano como único plano, reemplazando el anterior. */
  establecerPlano: (plano: Plano) => void
  agregarElemento: (elemento: Elemento) => void
  moverElemento: (id: string, posicion: Punto) => void
  actualizarElemento: (id: string, cambios: Partial<Elemento>) => void
  borrarElemento: (id: string) => void
  /** Borra varios elementos de una sola vez, para no encadenar guardados. */
  borrarElementos: (ids: string[]) => void

  iniciarTramo: (p: Punto) => void
  agregarPuntoTramo: (p: Punto) => void
  cerrarTramo: (elementoIds: string[], tipoCano: string) => void
  cancelarTramo: () => void
  actualizarTramo: (id: string, cambios: Partial<Tramo>) => void
  borrarTramo: (id: string) => void

  agregarCircuito: (c: Circuito) => void
  actualizarCircuito: (id: string, cambios: Partial<Circuito>) => void
  borrarCircuito: (id: string) => void
  asignarACircuito: (elementoIds: string[], circuitoId: string | null) => void

  iniciarPoligono: (p: Punto) => void
  agregarPuntoPoligono: (p: Punto) => void
  deshacerPuntoPoligono: () => void
  cancelarPoligono: () => void

  setAmbientes: (ambientes: Ambiente[]) => void
  agregarAmbiente: (ambiente: Ambiente) => void
  actualizarAmbiente: (id: string, cambios: Partial<Ambiente>) => void
  borrarAmbiente: (id: string) => void
  /** Vuelve a medir con la escala vigente los ambientes delimitados en el plano. */
  remedirAmbientes: () => void
  /** Fuerza las superficies del inmueble a la suma de los ambientes. */
  sincronizarSuperficies: () => void
}

export function proyectoVacio(): Proyecto {
  const ahora = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    nombre: 'Proyecto sin título',
    creadoEn: ahora,
    actualizadoEn: ahora,
    inmueble: { superficieCubiertaM2: 0, superficieSemicubiertaM2: 0, ambientes: [] },
    suministro: { ...SUMINISTRO_POR_DEFECTO },
    alturas: { ...ALTURAS_POR_DEFECTO },
    planos: [],
    elementos: [],
    tramos: [],
    circuitos: [],
    precios: listaPreciosPorDefecto(),
  }
}

export const nuevoId = (prefijo: string): string =>
  `${prefijo}-${Math.random().toString(36).slice(2, 9)}`

/** Guardado diferido, para no escribir en IndexedDB en cada arrastre. */
let temporizador: ReturnType<typeof setTimeout> | null = null
function guardarDiferido(proyecto: Proyecto): void {
  if (temporizador) clearTimeout(temporizador)
  temporizador = setTimeout(() => {
    void guardarProyecto(proyecto)
  }, 600)
}

/**
 * ¿Las superficies declaradas del inmueble vienen de sumar los ambientes?
 *
 * Mientras coincidan con la suma, se mantienen derivadas: delimitar un ambiente
 * más actualiza el total y con él el grado de electrificación. En cuanto el
 * usuario escribe un número propio dejan de coincidir, y entonces no se pisa:
 * PanelInmueble ofrece sincronizar cuando corresponda.
 */
function superficiesEstabanDerivadas(proyecto: Proyecto): boolean {
  const suma = superficiesDeAmbientes(proyecto.inmueble.ambientes)
  return (
    mismaSuperficie(proyecto.inmueble.superficieCubiertaM2, suma.cubiertaM2) &&
    mismaSuperficie(proyecto.inmueble.superficieSemicubiertaM2, suma.semicubiertaM2)
  )
}

function aplicarSuperficiesDeAmbientes(proyecto: Proyecto): void {
  const suma = superficiesDeAmbientes(proyecto.inmueble.ambientes)
  proyecto.inmueble.superficieCubiertaM2 = suma.cubiertaM2
  proyecto.inmueble.superficieSemicubiertaM2 = suma.semicubiertaM2
}

export const useApp = create<EstadoApp>((set, get) => ({
  proyecto: proyectoVacio(),
  herramienta: 'seleccionar',
  simboloActivo: null,
  circuitoActivo: null,
  seleccion: [],
  tramoEnCurso: [],
  poligonoEnCurso: [],
  ortogonal: true,
  snapActivo: true,
  capasOcultas: new Set(),
  guardando: false,

  // Las capas ocultas son del plano que se va: si no se limpian, un proyecto
  // importado abre con capas apagadas por nombre sin que nadie lo haya pedido.
  reemplazarProyecto: (p) =>
    set({
      proyecto: p,
      seleccion: [],
      tramoEnCurso: [],
      poligonoEnCurso: [],
      capasOcultas: new Set(),
    }),

  actualizar: (fn) =>
    set((estado) => {
      const proyecto = produce(estado.proyecto, (borrador) => {
        fn(borrador)
        borrador.actualizadoEn = new Date().toISOString()
      })
      guardarDiferido(proyecto)
      return { proyecto }
    }),

  setHerramienta: (herramienta) => set({ herramienta, tramoEnCurso: [], poligonoEnCurso: [] }),
  setSimboloActivo: (simboloActivo) =>
    set({ simboloActivo, herramienta: simboloActivo ? 'colocar' : 'seleccionar' }),
  setCircuitoActivo: (circuitoActivo) => set({ circuitoActivo }),
  setSeleccion: (seleccion) => set({ seleccion }),
  setOrtogonal: (ortogonal) => set({ ortogonal }),
  setSnapActivo: (snapActivo) => set({ snapActivo }),

  toggleCapa: (nombre) =>
    set((estado) => {
      const capasOcultas = new Set(estado.capasOcultas)
      if (capasOcultas.has(nombre)) capasOcultas.delete(nombre)
      else capasOcultas.add(nombre)
      return { capasOcultas }
    }),

  establecerPlano: (plano) => {
    const anterior = get().proyecto.planos[0] ?? null

    get().actualizar((p) => {
      // El proyecto trabaja siempre sobre un solo plano —todo lo demás lee
      // `planos[0]`—, así que cargar uno nuevo reemplaza al anterior en lugar
      // de dejarlo escondido detrás.
      p.planos = [plano]

      if (anterior && anterior.id !== plano.id) {
        // Lo ya dibujado se queda: sus coordenadas son las del plano, y el
        // usuario las reacomoda si el fondo nuevo no coincide.
        for (const el of p.elementos) el.planoId = plano.id
        for (const t of p.tramos) t.planoId = plano.id
      }
    })

    // Las capas ocultas eran del archivo anterior.
    if (anterior) set({ capasOcultas: new Set<string>(), seleccion: [] })
  },

  agregarElemento: (elemento) => get().actualizar((p) => void p.elementos.push(elemento)),

  moverElemento: (id, posicion) =>
    get().actualizar((p) => {
      const el = p.elementos.find((e) => e.id === id)
      if (el) el.posicion = posicion
    }),

  actualizarElemento: (id, cambios) =>
    get().actualizar((p) => {
      const el = p.elementos.find((e) => e.id === id)
      if (el) Object.assign(el, cambios)
    }),

  borrarElemento: (id) => get().borrarElementos([id]),

  borrarElementos: (ids) => {
    if (ids.length === 0) return
    const borrados = new Set(ids)

    get().actualizar((p) => {
      p.elementos = p.elementos.filter((e) => !borrados.has(e.id))
      // Un tramo que se queda sin extremos deja de tener sentido.
      p.tramos = p.tramos
        .map((t) => ({ ...t, elementoIds: t.elementoIds.filter((e) => !borrados.has(e)) }))
        .filter((t) => t.elementoIds.length > 0)
    })

    // La selección no puede seguir apuntando a lo que ya no está.
    set((estado) => ({ seleccion: estado.seleccion.filter((id) => !borrados.has(id)) }))
  },

  iniciarTramo: (p) => set({ tramoEnCurso: [p], herramienta: 'tramo' }),
  agregarPuntoTramo: (p) => set((e) => ({ tramoEnCurso: [...e.tramoEnCurso, p] })),
  cancelarTramo: () => set({ tramoEnCurso: [] }),

  cerrarTramo: (elementoIds, tipoCano) => {
    const puntos = get().tramoEnCurso
    if (puntos.length < 2) {
      set({ tramoEnCurso: [] })
      return
    }

    const planoId = get().proyecto.planos[0]?.id ?? ''
    get().actualizar((p) =>
      void p.tramos.push({
        id: nuevoId('tramo'),
        planoId,
        puntos,
        tipoCano,
        nivel: 'losa',
        elementoIds,
      }),
    )
    set({ tramoEnCurso: [] })
  },

  actualizarTramo: (id, cambios) =>
    get().actualizar((p) => {
      const t = p.tramos.find((x) => x.id === id)
      if (t) Object.assign(t, cambios)
    }),

  borrarTramo: (id) => get().actualizar((p) => void (p.tramos = p.tramos.filter((t) => t.id !== id))),

  agregarCircuito: (c) => get().actualizar((p) => void p.circuitos.push(c)),

  actualizarCircuito: (id, cambios) =>
    get().actualizar((p) => {
      const c = p.circuitos.find((x) => x.id === id)
      if (c) Object.assign(c, cambios)
    }),

  borrarCircuito: (id) =>
    get().actualizar((p) => {
      p.circuitos = p.circuitos.filter((c) => c.id !== id)
      for (const el of p.elementos) {
        if (el.circuitoId === id) el.circuitoId = undefined
      }
    }),

  asignarACircuito: (elementoIds, circuitoId) =>
    get().actualizar((p) => {
      const ids = new Set(elementoIds)
      for (const el of p.elementos) {
        if (ids.has(el.id)) el.circuitoId = circuitoId ?? undefined
      }
    }),

  iniciarPoligono: (p) => set({ poligonoEnCurso: [p], herramienta: 'ambiente' }),
  agregarPuntoPoligono: (p) => set((e) => ({ poligonoEnCurso: [...e.poligonoEnCurso, p] })),
  deshacerPuntoPoligono: () => set((e) => ({ poligonoEnCurso: e.poligonoEnCurso.slice(0, -1) })),
  cancelarPoligono: () => set({ poligonoEnCurso: [] }),

  setAmbientes: (ambientes) =>
    get().actualizar((p) => {
      // Reemplazo completo: es la confirmación de la detección sobre el CAD, así
      // que las superficies del inmueble pasan a ser las de esos ambientes.
      p.inmueble.ambientes = ambientes
      aplicarSuperficiesDeAmbientes(p)
    }),

  agregarAmbiente: (ambiente) =>
    get().actualizar((p) => {
      const derivadas = superficiesEstabanDerivadas(p)
      p.inmueble.ambientes.push(ambiente)
      if (derivadas) aplicarSuperficiesDeAmbientes(p)

      // Las bocas que ya estaban dentro del contorno pasan a contar para los
      // mínimos de la Tabla 770.7.III. Sólo las que no tenían ambiente: un
      // contorno nuevo no le roba bocas a uno existente.
      if (!ambiente.poligono) return
      for (const el of p.elementos) {
        if (el.ambienteId) continue
        if (puntoEnPoligono(el.posicion, ambiente.poligono)) el.ambienteId = ambiente.id
      }
    }),

  actualizarAmbiente: (id, cambios) =>
    get().actualizar((p) => {
      const a = p.inmueble.ambientes.find((x) => x.id === id)
      if (!a) return

      const derivadas = superficiesEstabanDerivadas(p)
      Object.assign(a, cambios)
      if (derivadas) aplicarSuperficiesDeAmbientes(p)
    }),

  borrarAmbiente: (id) =>
    get().actualizar((p) => {
      const derivadas = superficiesEstabanDerivadas(p)
      p.inmueble.ambientes = p.inmueble.ambientes.filter((a) => a.id !== id)
      if (derivadas) aplicarSuperficiesDeAmbientes(p)

      for (const el of p.elementos) {
        if (el.ambienteId === id) el.ambienteId = undefined
      }
    }),

  remedirAmbientes: () =>
    get().actualizar((p) => {
      const plano = p.planos[0]
      if (!plano) return

      const escala = escalaDe(plano)
      if (!escala.calibrado) return

      const derivadas = superficiesEstabanDerivadas(p)

      // Se copian los campos medidos en lugar de reemplazar el objeto: el
      // borrador de immer no debe recibir de vuelta un ambiente armado a partir
      // de él mismo.
      for (const a of p.inmueble.ambientes) {
        const medido = remedirAmbiente(a, escala)
        a.superficieM2 = medido.superficieM2
        if (medido.longitudM === undefined) delete a.longitudM
        else a.longitudM = medido.longitudM
      }

      if (derivadas) aplicarSuperficiesDeAmbientes(p)
    }),

  sincronizarSuperficies: () => get().actualizar(aplicarSuperficiesDeAmbientes),
}))
