/** 770.7.5 y Tabla 770.7.III — Número mínimo de puntos de utilización. */

import { buscarSimbolo } from '@/simbologia/catalogo'
import type { Hallazgo } from '@/dominio/tipos'
import type { ProyectoCalculado } from '@/dominio/calculo/proyecto'

export function puntosMinimos(p: ProyectoCalculado): Hallazgo[] {
  const hallazgos: Hallazgo[] = []

  // Bocas efectivamente colocadas por ambiente, separadas por tipo de circuito.
  const colocadas = new Map<string, { iug: number; tug: number }>()
  for (const el of p.proyecto.elementos) {
    if (!el.ambienteId) continue

    const simbolo = buscarSimbolo(el.simboloId)
    if (!simbolo?.computaComoBoca) continue

    const actual = colocadas.get(el.ambienteId) ?? { iug: 0, tug: 0 }

    // Se clasifica por el circuito al que está asignada la boca; si todavía no
    // tiene circuito, por la categoría del símbolo.
    const circuito = p.circuitos.find((c) => c.circuito.id === el.circuitoId)
    const tipo = circuito?.circuito.tipo ?? (simbolo.categoria === 'iluminacion' ? 'IUG' : 'TUG')

    if (tipo === 'IUG') actual.iug++
    else actual.tug++

    colocadas.set(el.ambienteId, actual)
  }

  for (const exigencia of p.exigenciasAmbientes) {
    const puestas = colocadas.get(exigencia.ambienteId) ?? { iug: 0, tug: 0 }

    if (puestas.iug < exigencia.iugRequeridas) {
      hallazgos.push({
        id: `puntos-iug-${exigencia.ambienteId}`,
        severidad: 'error',
        clausula: '770.7.5',
        mensaje:
          `${exigencia.nombre}: faltan bocas de iluminación. ` +
          `Requeridas ${exigencia.iugRequeridas}, colocadas ${puestas.iug}.`,
        sugerencia: `Agregar ${exigencia.iugRequeridas - puestas.iug} boca(s) de IUG.`,
        alcance: { tipo: 'ambiente', id: exigencia.ambienteId },
      })
    }

    const tugRequeridas = exigencia.tugRequeridas + exigencia.modulosRequeridos
    if (puestas.tug < tugRequeridas) {
      const detalleModulos =
        exigencia.modulosRequeridos > 0
          ? ` (${exigencia.tugRequeridas} bocas más ${exigencia.modulosRequeridos} módulos para electrodomésticos de ubicación fija)`
          : ''

      hallazgos.push({
        id: `puntos-tug-${exigencia.ambienteId}`,
        severidad: 'error',
        clausula: '770.7.5',
        mensaje:
          `${exigencia.nombre}: faltan bocas de tomacorriente. ` +
          `Requeridas ${tugRequeridas}${detalleModulos}, colocadas ${puestas.tug}.`,
        sugerencia: `Agregar ${tugRequeridas - puestas.tug} boca(s) de TUG.`,
        alcance: { tipo: 'ambiente', id: exigencia.ambienteId },
      })
    }
  }

  return hallazgos
}
