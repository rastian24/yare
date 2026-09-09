/**
 * Motor de validación: corre todas las reglas de la Sección 770 sobre un
 * proyecto calculado y agrupa los hallazgos.
 *
 * Agregar una regla es agregarla a `REGLAS`. Nada más.
 */

import * as reglas from './reglas'
import type { Hallazgo, Severidad } from '@/dominio/tipos'
import type { ProyectoCalculado } from '@/dominio/calculo/proyecto'
import type { Regla } from './reglas'

export const REGLAS: readonly Regla[] = [
  reglas.calibracionPlano,
  reglas.minimoCircuitos,
  reglas.puntosMinimos,
  reglas.bocasPorCircuito,
  reglas.seccionMinima,
  reglas.corrienteAdmisible,
  reglas.caidaTension,
  reglas.diametroCaneria,
  reglas.conductorProteccion,
  reglas.equilibrioFases,
  reglas.suministroTrifasico,
  reglas.curvasPorTramo,
]

const ORDEN_SEVERIDAD: Record<Severidad, number> = { error: 0, advertencia: 1, info: 2 }

export interface ResultadoValidacion {
  hallazgos: Hallazgo[]
  errores: number
  advertencias: number
  /** Hallazgos que afectan a todo el proyecto. */
  delProyecto: Hallazgo[]
  /** Hallazgos indexados por id de circuito. */
  porCircuito: Map<string, Hallazgo[]>
  /** Hallazgos indexados por id de tramo. */
  porTramo: Map<string, Hallazgo[]>
  /** Hallazgos indexados por id de ambiente. */
  porAmbiente: Map<string, Hallazgo[]>
  /** Hallazgos indexados por id de boca. */
  porBoca: Map<string, Hallazgo[]>
  /** ¿El proyecto está en condiciones normativas? */
  conforme: boolean
}

export function validar(calculado: ProyectoCalculado): ResultadoValidacion {
  const hallazgos = REGLAS.flatMap((regla) => regla(calculado)).sort(
    (a, b) => ORDEN_SEVERIDAD[a.severidad] - ORDEN_SEVERIDAD[b.severidad],
  )

  const porCircuito = new Map<string, Hallazgo[]>()
  const porTramo = new Map<string, Hallazgo[]>()
  const porAmbiente = new Map<string, Hallazgo[]>()
  const porBoca = new Map<string, Hallazgo[]>()
  const delProyecto: Hallazgo[] = []

  const empujar = (m: Map<string, Hallazgo[]>, id: string, h: Hallazgo) => {
    const lista = m.get(id)
    if (lista) lista.push(h)
    else m.set(id, [h])
  }

  for (const h of hallazgos) {
    switch (h.alcance.tipo) {
      case 'proyecto':
        delProyecto.push(h)
        break
      case 'circuito':
        empujar(porCircuito, h.alcance.id, h)
        break
      case 'tramo':
        empujar(porTramo, h.alcance.id, h)
        break
      case 'ambiente':
        empujar(porAmbiente, h.alcance.id, h)
        break
      case 'boca':
        empujar(porBoca, h.alcance.id, h)
        break
    }
  }

  const errores = hallazgos.filter((h) => h.severidad === 'error').length
  const advertencias = hallazgos.filter((h) => h.severidad === 'advertencia').length

  return {
    hallazgos,
    errores,
    advertencias,
    delProyecto,
    porCircuito,
    porTramo,
    porAmbiente,
    porBoca,
    conforme: errores === 0,
  }
}

/** Severidad más alta presente en una lista de hallazgos. */
export function severidadMaxima(hallazgos: Hallazgo[] | undefined): Severidad | null {
  if (!hallazgos || hallazgos.length === 0) return null
  if (hallazgos.some((h) => h.severidad === 'error')) return 'error'
  if (hallazgos.some((h) => h.severidad === 'advertencia')) return 'advertencia'
  return 'info'
}
