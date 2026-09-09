/** 770.10.3.8.4 y 770.7.1 p — Medidas mínimas de cañerías. */

import { buscarCano } from '../canerias'
import type { Hallazgo } from '@/dominio/tipos'
import type { ProyectoCalculado } from '@/dominio/calculo/proyecto'

export function diametroCaneria(p: ProyectoCalculado): Hallazgo[] {
  const hallazgos: Hallazgo[] = []

  for (const t of p.tramos) {
    const id = t.tramo.id

    if (t.circuitoIds.length === 0) continue

    if (!t.caneria) {
      hallazgos.push({
        id: `caneria-sin-solucion-${id}`,
        severidad: 'error',
        clausula: '770.10.3.8.4',
        mensaje:
          `Tramo ${id}: ningún caño de la familia elegida admite los cables que lo atraviesan ` +
          `(${t.circuitoIds.length} circuito(s)).`,
        sugerencia: 'Dividir el recorrido en dos cañerías o cambiar a una familia de mayor sección.',
        alcance: { tipo: 'tramo', id },
      })
      continue
    }

    const recomendado = t.caneria.cano
    const elegido = t.caneriaElegida ? buscarCano(t.caneriaElegida) : buscarCano(t.tramo.tipoCano)

    if (!elegido) continue

    if (elegido.seccionInternaMm2 < recomendado.seccionInternaMm2) {
      hallazgos.push({
        id: `caneria-chica-${id}`,
        severidad: 'error',
        clausula: '770.10.3.8.4',
        mensaje:
          `Tramo ${id}: el caño ${elegido.designacion} es insuficiente para los ` +
          `${t.caneria.totalCables} cables que lo atraviesan. Mínimo ${recomendado.designacion}` +
          `${recomendado.comercial ? ` (${recomendado.comercial})` : ''}.`,
        sugerencia: t.caneria.justificacion,
        alcance: { tipo: 'tramo', id },
      })
    }

    if (t.caneria.ocupacionPct > 35) {
      hallazgos.push({
        id: `caneria-llenado-${id}`,
        severidad: 'error',
        clausula: '770.10.3.8.4',
        mensaje:
          `Tramo ${id}: los cables ocupan el ${t.caneria.ocupacionPct.toFixed(1)} % de la sección ` +
          `interna del caño, y el máximo es 35 %.`,
        sugerencia: `Pasar a ${recomendado.designacion} o dividir el haz.`,
        alcance: { tipo: 'tramo', id },
      })
    }
  }

  return hallazgos
}
