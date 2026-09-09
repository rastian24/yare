/**
 * Cálculo derivado del proyecto: todo lo que las reglas necesitan para validar.
 *
 * Nada de esto se persiste. Se recalcula a partir del `Proyecto` cada vez que
 * cambia, de modo que los materiales, el presupuesto y los hallazgos no puedan
 * quedar desincronizados del plano.
 */

import {
  caidaTensionPorTabla,
  coeficienteSimultaneidad,
  corrienteAdmisible,
  corrienteParaCaidaTension,
  corrienteProyecto,
  desequilibrioPct,
  dpmsCircuito,
  elegirProteccion,
  factorAgrupamiento,
  seccionPE,
} from './electrico'
import { calcularCaneria, calcularCaneriaConSaltoPorCorrugado, hazDeCircuitos } from './canerias'
import {
  contarCurvas,
  escalaDe,
  longitudHastaBocaMasAlejada,
  longitudTramo,
  longitudPolilinea,
} from './longitudes'
import {
  exigenciasDelInmueble,
  gradoDeInmueble,
  superficieLimiteAplicacion,
  verificarMinimoCircuitos,
  type ExigenciaAmbiente,
  type ResultadoMinimoCircuitos,
} from '@/normativa/aea770/electrificacion'
import { TIPOS_CIRCUITO } from '@/normativa/aea770/tablas'
import { buscarCano, type FamiliaCano } from '@/normativa/aea770/canerias'
import { buscarSimbolo } from '@/simbologia/catalogo'
import type {
  Circuito,
  Elemento,
  Escala,
  Fase,
  GradoElectrificacion,
  Plano,
  Proyecto,
  Tramo,
} from '@/dominio/tipos'
import type { ResultadoCaneria } from './canerias'

// ---------------------------------------------------------------------------
// Circuito calculado
// ---------------------------------------------------------------------------

export interface CircuitoCalculado {
  circuito: Circuito
  /** Elementos asignados al circuito. */
  elementos: Elemento[]
  /** Bocas que computan según 770.7.1 (excluye interruptores y cajas de paso). */
  bocas: number
  /** Máximo de bocas del tipo de circuito (Tabla 770.6.I). */
  maxBocas: number
  /** Máximo calibre de protección del tipo de circuito (Tabla 770.6.I). */
  maxProteccionA: number
  dpmsVA: number
  /** Corriente de proyecto en A. */
  ibA: number
  /** Corriente admisible del cable, ya corregida por agrupamiento. */
  izA: number
  factorAgrupamiento: number
  /** Calibre que cumple Ib ≤ In ≤ Iz, o `null` si ninguno entra. */
  proteccionSugeridaA: number | null
  seccionPEMm2: number
  /** Longitud hasta la boca más alejada, en m. `null` si falta calibración. */
  longitudM: number | null
  /** Corriente considerada para la caída de tensión (770.15.6). */
  corrienteCaidaA: number
  caidaV: number | null
  caidaPct: number | null
}

// ---------------------------------------------------------------------------
// Tramo calculado
// ---------------------------------------------------------------------------

export interface TramoCalculado {
  tramo: Tramo
  longitudM: number | null
  plantaM: number | null
  verticalM: number | null
  curvas: number
  /** Circuitos que atraviesan el tramo. */
  circuitoIds: string[]
  /** Cañería recomendada para el haz que lo atraviesa. */
  caneria: ResultadoCaneria | null
  /** Cañería elegida por el usuario, si difiere de la recomendada. */
  caneriaElegida: string | null
}

// ---------------------------------------------------------------------------
// Proyecto calculado
// ---------------------------------------------------------------------------

export interface ProyectoCalculado {
  proyecto: Proyecto
  escala: Escala | null
  superficieM2: number
  grado: GradoElectrificacion
  minimoCircuitos: ResultadoMinimoCircuitos
  exigenciasAmbientes: ExigenciaAmbiente[]
  circuitos: CircuitoCalculado[]
  tramos: TramoCalculado[]
  /** DPMS total antes de aplicar el coeficiente de simultaneidad. */
  dpmsTotalVA: number
  coefSimultaneidad: number
  /** Carga total del inmueble en VA, ya con simultaneidad (770.8.3.1). */
  cargaTotalVA: number
  /** Corriente de la línea principal, en A. */
  corrienteTotalA: number
  cargaPorFaseVA: Record<Fase, number>
  desequilibrioPct: number
}

/** Familia de caño a la que pertenece una designación, para el cálculo. */
function familiaDeCano(designacion: string): FamiliaCano {
  return buscarCano(designacion)?.familia ?? 'rigida'
}

/**
 * Cuántos cables cargados lleva un circuito dentro de la cañería.
 * Un circuito monofásico lleva 2 (fase y neutro); uno trifásico, 4 (tres fases
 * y neutro). El PE se computa aparte.
 */
function cablesCargados(fases: Proyecto['suministro']['fases']): number {
  return fases === 'trifasica' ? 4 : 2
}

export function calcularProyecto(proyecto: Proyecto): ProyectoCalculado {
  const { suministro, alturas, inmueble } = proyecto

  const planoPrincipal = proyecto.planos[0] ?? null
  const escala = planoPrincipal ? escalaDe(planoPrincipal) : null

  const superficieM2 = superficieLimiteAplicacion(inmueble)
  const grado = gradoDeInmueble(inmueble)

  const conteo = {
    iug: proyecto.circuitos.filter((c) => c.tipo === 'IUG').length,
    tug: proyecto.circuitos.filter((c) => c.tipo === 'TUG').length,
    tue: proyecto.circuitos.filter((c) => c.tipo === 'TUE').length,
  }
  const minimoCircuitos = verificarMinimoCircuitos(grado, conteo)
  const exigenciasAmbientes = exigenciasDelInmueble(inmueble, grado)

  // --- Cuántos circuitos comparte cada tramo -------------------------------
  // Se usa para el factor de agrupamiento: el máximo de circuitos que
  // comparten canalización a lo largo del recorrido del circuito.
  const circuitosPorTramo = new Map<string, Set<string>>()
  const elementoAcircuito = new Map<string, string>()
  for (const el of proyecto.elementos) {
    if (el.circuitoId) elementoAcircuito.set(el.id, el.circuitoId)
  }
  for (const tramo of proyecto.tramos) {
    const ids = new Set<string>()
    for (const elId of tramo.elementoIds) {
      const cid = elementoAcircuito.get(elId)
      if (cid) ids.add(cid)
    }
    circuitosPorTramo.set(tramo.id, ids)
  }

  const agrupamientoDeCircuito = (circuitoId: string): number => {
    let max = 1
    for (const [tramoId, ids] of circuitosPorTramo) {
      if (ids.has(circuitoId)) {
        max = Math.max(max, ids.size)
      }
      void tramoId
    }
    return max
  }

  // --- Circuitos -----------------------------------------------------------
  const tablero = proyecto.elementos.find((e) => {
    const s = buscarSimbolo(e.simboloId)
    return s?.categoria === 'tablero'
  })

  const circuitos: CircuitoCalculado[] = proyecto.circuitos.map((circuito) => {
    const elementos = proyecto.elementos.filter((e) => e.circuitoId === circuito.id)

    const bocas = elementos.reduce((n, e) => {
      const s = buscarSimbolo(e.simboloId)
      return n + (s?.computaComoBoca ? 1 : 0)
    }, 0)

    const cargaDeclaradaVA = elementos.reduce((va, e) => {
      const s = buscarSimbolo(e.simboloId)
      return va + (e.cargaVA ?? s?.cargaVA ?? 0)
    }, 0)

    const dpmsVA = dpmsCircuito({
      tipo: circuito.tipo,
      bocas,
      conTomasDerivados: circuito.conTomasDerivados,
      cargaDeclaradaVA: circuito.tipo === 'IUG' ? undefined : cargaDeclaradaVA,
    })

    const agrupados = circuito.circuitosAgrupados ?? agrupamientoDeCircuito(circuito.id)
    const ibA = corrienteProyecto(dpmsVA, suministro.fases, suministro.tensionV)

    let izA = 0
    try {
      izA = corrienteAdmisible(circuito.seccionMm2, suministro.fases, agrupados)
    } catch {
      izA = 0
    }

    const spec = TIPOS_CIRCUITO[circuito.tipo]
    const proteccionSugeridaA = izA > 0 ? elegirProteccion(ibA, izA, spec.maxProteccionA) : null

    // --- Longitud y caída de tensión ---------------------------------------
    let longitudM: number | null = null
    if (planoPrincipal && tablero) {
      const bocaIds = elementos.map((e) => e.id)
      longitudM = longitudHastaBocaMasAlejada(
        tablero.id,
        bocaIds,
        proyecto.tramos,
        planoPrincipal,
        proyecto.elementos,
        alturas,
      )
    }

    const corrienteCaidaA = corrienteParaCaidaTension(
      circuito,
      dpmsVA,
      suministro.fases,
      suministro.tensionV,
    )

    let caidaV: number | null = null
    let caidaPct: number | null = null
    if (longitudM !== null) {
      try {
        const r = caidaTensionPorTabla({
          seccionMm2: circuito.seccionMm2,
          corrienteA: corrienteCaidaA,
          longitudM,
          tensionV: suministro.tensionV,
          fases: suministro.fases,
        })
        caidaV = r.caidaV
        caidaPct = r.caidaPct
      } catch {
        // Sección fuera de la Tabla 770.15.IV: se deja sin calcular y la regla
        // correspondiente lo reporta.
      }
    }

    return {
      circuito,
      elementos,
      bocas,
      maxBocas: spec.maxBocas,
      maxProteccionA: spec.maxProteccionA,
      dpmsVA,
      ibA,
      izA,
      factorAgrupamiento: factorAgrupamiento(agrupados, suministro.fases),
      proteccionSugeridaA,
      seccionPEMm2: seccionPE(circuito.seccionMm2),
      longitudM,
      corrienteCaidaA,
      caidaV,
      caidaPct,
    }
  })

  const circuitoPorId = new Map(circuitos.map((c) => [c.circuito.id, c]))

  // --- Tramos --------------------------------------------------------------
  const tramos: TramoCalculado[] = proyecto.tramos.map((tramo) => {
    const l = planoPrincipal
      ? longitudTramo(tramo, planoPrincipal, proyecto.elementos, alturas)
      : null

    const circuitoIds = [...(circuitosPorTramo.get(tramo.id) ?? [])]
    const delTramo = circuitoIds
      .map((id) => circuitoPorId.get(id))
      .filter((c): c is CircuitoCalculado => c !== undefined)

    let caneria: ResultadoCaneria | null = null
    if (delTramo.length > 0) {
      const { cables, pe } = hazDeCircuitos(
        delTramo.map((c) => ({
          seccionMm2: c.circuito.seccionMm2,
          cablesCargados: cablesCargados(suministro.fases),
        })),
      )

      const familia = familiaDeCano(tramo.tipoCano)
      caneria =
        familia === 'curvable'
          ? calcularCaneriaConSaltoPorCorrugado({
              cables,
              pe,
              familia,
              familiaLisaDeReferencia: 'rigida',
            })
          : calcularCaneria({ cables, pe, familia })
    }

    return {
      tramo,
      longitudM: l?.totalM ?? null,
      plantaM: l?.plantaM ?? null,
      verticalM: l?.verticalM ?? null,
      curvas: contarCurvas(tramo.puntos),
      circuitoIds,
      caneria,
      caneriaElegida: tramo.diametroElegido ?? null,
    }
  })

  // --- Carga total (770.8.3.1) --------------------------------------------
  const dpmsTotalVA = circuitos.reduce((sum, c) => sum + c.dpmsVA, 0)
  const coefSimultaneidad = coeficienteSimultaneidad(proyecto.circuitos.length)
  const cargaTotalVA = dpmsTotalVA * coefSimultaneidad
  const corrienteTotalA = corrienteProyecto(cargaTotalVA, suministro.fases, suministro.tensionV)

  const cargaPorFaseVA: Record<Fase, number> = { R: 0, S: 0, T: 0 }
  for (const c of circuitos) {
    const fase = c.circuito.fase ?? 'R'
    cargaPorFaseVA[fase] += c.dpmsVA
  }

  return {
    proyecto,
    escala,
    superficieM2,
    grado,
    minimoCircuitos,
    exigenciasAmbientes,
    circuitos,
    tramos,
    dpmsTotalVA,
    coefSimultaneidad,
    cargaTotalVA,
    corrienteTotalA,
    cargaPorFaseVA,
    desequilibrioPct:
      suministro.fases === 'trifasica'
        ? desequilibrioPct([cargaPorFaseVA.R, cargaPorFaseVA.S, cargaPorFaseVA.T])
        : 0,
  }
}

/** Longitud total de canalización por tipo de caño, en metros. */
export function metrosDeCaneria(calculado: ProyectoCalculado): Map<string, number> {
  const porTipo = new Map<string, number>()
  for (const t of calculado.tramos) {
    const designacion = t.caneriaElegida ?? t.caneria?.cano.designacion
    if (!designacion || t.longitudM === null) continue
    porTipo.set(designacion, (porTipo.get(designacion) ?? 0) + t.longitudM)
  }
  return porTipo
}

export { longitudPolilinea }
export type { Plano }
