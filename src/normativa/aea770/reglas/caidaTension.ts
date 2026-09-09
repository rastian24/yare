/**
 * 770.15.6 — Caídas de tensión.
 *
 * Ésta es la alerta por distancia: la caída entre los bornes de salida del
 * tablero principal y cualquier punto de utilización no debe superar el 3 % en
 * circuitos terminales de uso general o especial.
 */

import { seccionPorCaidaTension } from '@/dominio/calculo/electrico'
import { seccionMinimaDe } from './seccionMinima'
import type { Hallazgo } from '@/dominio/tipos'
import type { ProyectoCalculado } from '@/dominio/calculo/proyecto'

export function caidaTension(p: ProyectoCalculado): Hallazgo[] {
  const hallazgos: Hallazgo[] = []
  const { suministro } = p.proyecto
  const maxPct = suministro.caidaTensionMaxPct

  for (const c of p.circuitos) {
    const id = c.circuito.id

    if (c.longitudM === null) {
      // Sin longitud no se puede verificar. Que falte se informa una sola vez
      // desde `calibracionPlano`, no una vez por circuito.
      continue
    }

    if (c.caidaPct === null) continue

    if (c.caidaPct > maxPct) {
      const sugerida = seccionPorCaidaTension(
        {
          corrienteA: c.corrienteCaidaA,
          longitudM: c.longitudM,
          tensionV: suministro.tensionV,
          fases: suministro.fases,
        },
        maxPct,
        seccionMinimaDe(c.circuito),
      )

      hallazgos.push({
        id: `caida-${id}`,
        severidad: 'error',
        clausula: '770.15.6',
        mensaje:
          `${c.circuito.nombre}: la caída de tensión hasta la boca más alejada es de ` +
          `${c.caidaPct.toFixed(2)} % (${c.caidaV?.toFixed(2)} V) sobre ` +
          `${c.longitudM.toFixed(1)} m, y el máximo admisible es ${maxPct} %.`,
        sugerencia: sugerida
          ? `Subir la sección de ${c.circuito.seccionMm2} a ${sugerida} mm², o acercar el tablero.`
          : 'Acortar el recorrido o dividir el circuito; ninguna sección de tabla alcanza.',
        alcance: { tipo: 'circuito', id },
      })
    } else if (c.caidaPct > maxPct * 0.85) {
      hallazgos.push({
        id: `caida-margen-${id}`,
        severidad: 'advertencia',
        clausula: '770.15.6',
        mensaje:
          `${c.circuito.nombre}: la caída de tensión es de ${c.caidaPct.toFixed(2)} %, cerca del ` +
          `límite de ${maxPct} %.`,
        sugerencia: 'Cualquier extensión del circuito lo pondría fuera de norma.',
        alcance: { tipo: 'circuito', id },
      })
    }
  }

  return hallazgos
}
