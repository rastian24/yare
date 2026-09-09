/** 770.8.3.3 — Suministro monofásico o trifásico. */

import { UMBRAL_TRIFASICO } from '../tablas'
import type { Hallazgo } from '@/dominio/tipos'
import type { ProyectoCalculado } from '@/dominio/calculo/proyecto'

export function suministroTrifasico(p: ProyectoCalculado): Hallazgo[] {
  if (p.proyecto.suministro.fases === 'trifasica') return []

  const superaVA = p.cargaTotalVA > UMBRAL_TRIFASICO.cargaVA
  const superaA = p.corrienteTotalA > UMBRAL_TRIFASICO.corrienteA
  if (!superaVA && !superaA) return []

  const motivos: string[] = []
  if (superaVA) motivos.push(`la carga total es de ${(p.cargaTotalVA / 1000).toFixed(2)} kVA`)
  if (superaA) motivos.push(`la corriente de línea es de ${p.corrienteTotalA.toFixed(1)} A`)

  return [
    {
      id: 'recomendar-trifasico',
      severidad: 'advertencia',
      clausula: '770.8.3.3',
      mensaje:
        `Se recomienda solicitar suministro trifásico: ${motivos.join(' y ')}, ` +
        `por encima de los ${UMBRAL_TRIFASICO.cargaVA / 1000} kVA o ` +
        `${UMBRAL_TRIFASICO.corrienteA} A de una línea de alimentación monofásica.`,
      sugerencia: 'Cambiar el suministro a trifásico en los datos del inmueble.',
      alcance: { tipo: 'proyecto' },
    },
  ]
}
