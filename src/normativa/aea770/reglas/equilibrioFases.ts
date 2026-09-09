/** 770.8.3.4 — Equilibrio de cargas en suministro trifásico. */

import { MAX_DESEQUILIBRIO_PCT } from '../tablas'
import type { Hallazgo } from '@/dominio/tipos'
import type { ProyectoCalculado } from '@/dominio/calculo/proyecto'

export function equilibrioFases(p: ProyectoCalculado): Hallazgo[] {
  if (p.proyecto.suministro.fases !== 'trifasica') return []
  if (p.desequilibrioPct <= MAX_DESEQUILIBRIO_PCT) return []

  const { R, S, T } = p.cargaPorFaseVA

  return [
    {
      id: 'desequilibrio-fases',
      severidad: 'advertencia',
      clausula: '770.8.3.4',
      mensaje:
        `El desequilibrio entre fases es del ${p.desequilibrioPct.toFixed(1)} % y se recomienda ` +
        `no superar el ${MAX_DESEQUILIBRIO_PCT} %. ` +
        `R: ${R.toFixed(0)} VA · S: ${S.toFixed(0)} VA · T: ${T.toFixed(0)} VA.`,
      sugerencia: 'Redistribuir circuitos monofásicos entre las fases.',
      alcance: { tipo: 'proyecto' },
    },
  ]
}
