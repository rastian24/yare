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

  agregarPlano: (plano: Plano) => void
  agregarElemento: (elemento: Elemento) => void
  moverElemento: (id: string, posicion: Punto) => void
  actualizarElemento: (id: string, cambios: Partial<Elemento>) => void
  borrarElemento: (id: string) => void

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

  setAmbientes: (ambientes: Ambiente[]) => void
  actualizarAmbiente: (id: string, cambios: Partial<Ambiente>) => void
  borrarAmbiente: (id: string) => void
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

export const useApp = create<EstadoApp>((set, get) => ({
  proyecto: proyectoVacio(),
  herramienta: 'seleccionar',
  simboloActivo: null,
  circuitoActivo: null,
  seleccion: [],
  tramoEnCurso: [],
  ortogonal: true,
  snapActivo: true,
  capasOcultas: new Set(),
  guardando: false,

  reemplazarProyecto: (p) => set({ proyecto: p, seleccion: [], tramoEnCurso: [] }),

  actualizar: (fn) =>
    set((estado) => {
      const proyecto = produce(estado.proyecto, (borrador) => {
        fn(borrador)
        borrador.actualizadoEn = new Date().toISOString()
      })
      guardarDiferido(proyecto)
      return { proyecto }
    }),

  setHerramienta: (herramienta) => set({ herramienta, tramoEnCurso: [] }),
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

  agregarPlano: (plano) => get().actualizar((p) => void p.planos.push(plano)),

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

  borrarElemento: (id) =>
    get().actualizar((p) => {
      p.elementos = p.elementos.filter((e) => e.id !== id)
      // Un tramo que se queda sin extremos deja de tener sentido.
      p.tramos = p.tramos
        .map((t) => ({ ...t, elementoIds: t.elementoIds.filter((e) => e !== id) }))
        .filter((t) => t.elementoIds.length > 0)
    }),

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

  setAmbientes: (ambientes) =>
    get().actualizar((p) => {
      p.inmueble.ambientes = ambientes
      // La superficie cubierta se deriva de los ambientes detectados, salvo los
      // semicubiertos, que computan al 50 % por separado (770.7.3).
      const cubierta = ambientes
        .filter((a) => a.tipo !== 'semicubierto')
        .reduce((s, a) => s + a.superficieM2, 0)
      const semicubierta = ambientes
        .filter((a) => a.tipo === 'semicubierto')
        .reduce((s, a) => s + a.superficieM2, 0)

      p.inmueble.superficieCubiertaM2 = Number(cubierta.toFixed(2))
      p.inmueble.superficieSemicubiertaM2 = Number(semicubierta.toFixed(2))
    }),

  actualizarAmbiente: (id, cambios) =>
    get().actualizar((p) => {
      const a = p.inmueble.ambientes.find((x) => x.id === id)
      if (a) Object.assign(a, cambios)
    }),

  borrarAmbiente: (id) =>
    get().actualizar((p) => {
      p.inmueble.ambientes = p.inmueble.ambientes.filter((a) => a.id !== id)
      for (const el of p.elementos) {
        if (el.ambienteId === id) el.ambienteId = undefined
      }
    }),
}))
