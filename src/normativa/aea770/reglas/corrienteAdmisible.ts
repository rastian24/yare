/**
 * 770.12.2 y 770.15.3 — Corriente admisible y coordinación con la protección.
 *
 * Ésta es la alerta por cantidad de equipos conectados: a más carga en el
 * circuito, mayor corriente de proyecto, y en algún punto la sección deja de
 * alcanzar. El factor de agrupamiento de la Tabla 770.12.II hace que además
 * dependa de cuántos circuitos comparten la cañería.
 */

import { seccionPorCorriente } from '@/dominio/calculo/electrico'
import { seccionMinimaDe } from './seccionMinima'
import type { Hallazgo } from '@/dominio/tipos'
import type { ProyectoCalculado } from '@/dominio/calculo/proyecto'

export function corrienteAdmisible(p: ProyectoCalculado): Hallazgo[] {
  const hallazgos: Hallazgo[] = []
  const { fases } = p.proyecto.suministro

  for (const c of p.circuitos) {
    const id = c.circuito.id

    if (c.izA === 0) {
      hallazgos.push({
        id: `iz-fuera-tabla-${id}`,
        severidad: 'advertencia',
        clausula: '770.12.2',
        mensaje:
          `${c.circuito.nombre}: la sección de ${c.circuito.seccionMm2} mm² no figura en la ` +
          `Tabla 770.12.I, así que no se puede verificar la corriente admisible.`,
        sugerencia: 'Usar una sección de la serie normalizada.',
        alcance: { tipo: 'circuito', id },
      })
      continue
    }

    const agrupado = c.factorAgrupamiento < 1

    // --- Ib ≤ Iz ------------------------------------------------------------
    if (c.ibA > c.izA) {
      const sugerida = seccionPorCorriente(
        c.ibA,
        fases,
        Math.round(1 / c.factorAgrupamiento) || 1,
        seccionMinimaDe(c.circuito),
      )

      const porAgrupamiento = agrupado
        ? ` La corriente admisible baja de la de tabla a ${c.izA.toFixed(1)} A por el factor de ` +
          `agrupamiento ${c.factorAgrupamiento} (Tabla 770.12.II).`
        : ''

      hallazgos.push({
        id: `iz-insuficiente-${id}`,
        severidad: 'error',
        clausula: '770.12.2',
        mensaje:
          `${c.circuito.nombre}: la corriente de proyecto (${c.ibA.toFixed(1)} A) supera la ` +
          `corriente admisible del cable de ${c.circuito.seccionMm2} mm² ` +
          `(${c.izA.toFixed(1)} A).${porAgrupamiento}`,
        sugerencia: sugerida
          ? `Subir la sección a ${sugerida} mm², o separar el circuito en otra cañería.`
          : 'Dividir la carga en más circuitos.',
        alcance: { tipo: 'circuito', id },
      })
      continue
    }

    // --- Ib ≤ In ≤ Iz -------------------------------------------------------
    const inActual = c.circuito.proteccionIn

    if (inActual < c.ibA) {
      hallazgos.push({
        id: `in-baja-${id}`,
        severidad: 'error',
        clausula: '770.15.3',
        mensaje:
          `${c.circuito.nombre}: la protección de ${inActual} A es menor que la corriente de ` +
          `proyecto (${c.ibA.toFixed(1)} A); actuaría en servicio normal.`,
        sugerencia: c.proteccionSugeridaA
          ? `Usar una protección de ${c.proteccionSugeridaA} A.`
          : 'Revisar la carga del circuito.',
        alcance: { tipo: 'circuito', id },
      })
    } else if (inActual > c.izA) {
      hallazgos.push({
        id: `in-alta-${id}`,
        severidad: 'error',
        clausula: '770.15.3',
        mensaje:
          `${c.circuito.nombre}: la protección de ${inActual} A supera la corriente admisible ` +
          `del cable (${c.izA.toFixed(1)} A); el cable puede sobrecargarse sin que actúe.`,
        sugerencia: c.proteccionSugeridaA
          ? `Bajar la protección a ${c.proteccionSugeridaA} A o subir la sección del cable.`
          : 'Subir la sección del cable.',
        alcance: { tipo: 'circuito', id },
      })
    }

    // Aviso informativo cuando el agrupamiento reduce el margen a menos del 15 %.
    if (agrupado && c.ibA <= c.izA && c.izA - c.ibA < c.izA * 0.15) {
      hallazgos.push({
        id: `iz-margen-${id}`,
        severidad: 'advertencia',
        clausula: '770.12.2',
        mensaje:
          `${c.circuito.nombre}: queda poco margen entre la corriente de proyecto ` +
          `(${c.ibA.toFixed(1)} A) y la admisible corregida por agrupamiento ` +
          `(${c.izA.toFixed(1)} A).`,
        sugerencia: 'Considerar subir una sección o repartir los circuitos en otra cañería.',
        alcance: { tipo: 'circuito', id },
      })
    }
  }

  return hallazgos
}
