/** 770.6.6 y Tabla 770.6.I — Máxima cantidad de bocas y calibre de protección. */

import type { Hallazgo } from '@/dominio/tipos'
import type { ProyectoCalculado } from '@/dominio/calculo/proyecto'

export function bocasPorCircuito(p: ProyectoCalculado): Hallazgo[] {
  const hallazgos: Hallazgo[] = []

  for (const c of p.circuitos) {
    if (c.bocas > c.maxBocas) {
      hallazgos.push({
        id: `bocas-max-${c.circuito.id}`,
        severidad: 'error',
        clausula: '770.6.6',
        mensaje:
          `${c.circuito.nombre}: tiene ${c.bocas} bocas y el máximo para un circuito ` +
          `${c.circuito.tipo} es ${c.maxBocas}.`,
        sugerencia: `Dividir el circuito o mover ${c.bocas - c.maxBocas} boca(s) a otro circuito.`,
        alcance: { tipo: 'circuito', id: c.circuito.id },
      })
    }

    if (c.circuito.proteccionIn > c.maxProteccionA) {
      hallazgos.push({
        id: `proteccion-max-${c.circuito.id}`,
        severidad: 'error',
        clausula: '770.6.6',
        mensaje:
          `${c.circuito.nombre}: la protección de ${c.circuito.proteccionIn} A supera el máximo ` +
          `de ${c.maxProteccionA} A para un circuito ${c.circuito.tipo}.`,
        sugerencia: `Bajar la protección a ${c.maxProteccionA} A o menos.`,
        alcance: { tipo: 'circuito', id: c.circuito.id },
      })
    }

    if (c.bocas === 0) {
      hallazgos.push({
        id: `bocas-cero-${c.circuito.id}`,
        severidad: 'advertencia',
        clausula: '770.6.5',
        mensaje: `${c.circuito.nombre}: no tiene ninguna boca asignada.`,
        sugerencia: 'Asignar bocas al circuito o eliminarlo del proyecto.',
        alcance: { tipo: 'circuito', id: c.circuito.id },
      })
    }
  }

  return hallazgos
}
