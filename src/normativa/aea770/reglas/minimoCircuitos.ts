/** 770.7.4 y Tabla 770.7.II — Número mínimo de circuitos. */

import type { Hallazgo } from '@/dominio/tipos'
import type { ProyectoCalculado } from '@/dominio/calculo/proyecto'
import { nombreGrado } from '../electrificacion'

export function minimoCircuitos(p: ProyectoCalculado): Hallazgo[] {
  const m = p.minimoCircuitos
  if (m.cumple) return []

  const faltantes: string[] = []
  if (m.faltanIUG > 0) faltantes.push(`${m.faltanIUG} de iluminación (IUG)`)
  if (m.faltanTUG > 0) faltantes.push(`${m.faltanTUG} de tomacorrientes (TUG)`)

  const variantes = m.variantes
    .map((v) => `${v.iug} IUG + ${v.tug} TUG${v.libre > 0 ? ` + ${v.libre} libre` : ''}`)
    .join(' o ')

  return [
    {
      id: 'min-circuitos',
      severidad: 'error',
      clausula: '770.7.4',
      mensaje:
        `El grado de electrificación ${nombreGrado(p.grado)} (${p.superficieM2.toFixed(1)} m²) ` +
        `exige ${m.totalRequerido} circuitos y el proyecto tiene ${m.totalActual}.`,
      sugerencia:
        faltantes.length > 0
          ? `Faltan ${faltantes.join(' y ')}. Variantes admitidas: ${variantes}.`
          : `Variantes admitidas: ${variantes}.`,
      alcance: { tipo: 'proyecto' },
    },
  ]
}
