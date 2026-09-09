/**
 * No es una regla de la norma sino una precondición del cálculo: sin escala no
 * hay longitudes, y sin longitudes no se puede verificar la caída de tensión de
 * 770.15.6 ni computar cable y caño.
 *
 * Se informa una sola vez y de forma explícita, en lugar de dejar que cada
 * circuito reporte una caída de tensión inexistente.
 */

import type { Hallazgo } from '@/dominio/tipos'
import type { ProyectoCalculado } from '@/dominio/calculo/proyecto'
import { buscarSimbolo } from '@/simbologia/catalogo'

export function calibracionPlano(p: ProyectoCalculado): Hallazgo[] {
  const hallazgos: Hallazgo[] = []

  if (p.proyecto.planos.length === 0) {
    if (p.proyecto.elementos.length > 0) {
      hallazgos.push({
        id: 'sin-plano',
        severidad: 'advertencia',
        clausula: '770-A.1.3',
        mensaje: 'El proyecto no tiene plano cargado.',
        sugerencia: 'Cargar una foto del plano o un archivo DXF.',
        alcance: { tipo: 'proyecto' },
      })
    }
    return hallazgos
  }

  if (p.escala && !p.escala.calibrado) {
    const esDxf = p.proyecto.planos[0]?.fuente.tipo === 'dxf'

    hallazgos.push({
      id: 'sin-calibrar',
      severidad: 'advertencia',
      clausula: '770.15.6',
      mensaje: esDxf
        ? 'El DXF no declara unidades de dibujo ($INSUNITS = 0), así que no se pueden medir ' +
          'longitudes. La caída de tensión y el cómputo de cable y caño quedan sin verificar.'
        : 'El plano no está calibrado, así que no se pueden medir longitudes. La caída de ' +
          'tensión y el cómputo de cable y caño quedan sin verificar.',
      sugerencia: esDxf
        ? 'Elegir la unidad del dibujo, o calibrar sobre una distancia conocida.'
        : 'Calibrar trazando una línea sobre una distancia conocida del plano.',
      alcance: { tipo: 'proyecto' },
    })
  }

  // Sin tablero no hay origen desde donde medir la caída de tensión.
  const tieneTablero = p.proyecto.elementos.some(
    (e) => buscarSimbolo(e.simboloId)?.categoria === 'tablero',
  )

  if (!tieneTablero && p.circuitos.length > 0) {
    hallazgos.push({
      id: 'sin-tablero',
      severidad: 'advertencia',
      clausula: '770.15.6',
      mensaje:
        'No hay tablero colocado en el plano. La caída de tensión se mide desde los bornes de ' +
        'salida del tablero principal, así que no se puede verificar.',
      sugerencia: 'Colocar el tablero principal en el plano.',
      alcance: { tipo: 'proyecto' },
    })
  }

  return hallazgos
}
