/** 770.11 y Tabla 770.11.I — Secciones nominales mínimas de cables. */

import { SECCIONES_MINIMAS } from '../tablas'
import type { Circuito, Hallazgo } from '@/dominio/tipos'
import type { ProyectoCalculado } from '@/dominio/calculo/proyecto'

/** Sección mínima admisible de un circuito terminal, según la Tabla 770.11.I. */
export function seccionMinimaDe(circuito: Pick<Circuito, 'tipo' | 'conTomasDerivados'>): number {
  switch (circuito.tipo) {
    case 'IUG':
      // Un circuito de iluminación que incluye tomacorrientes de uso general
      // sube de 1,5 a 2,5 mm².
      return circuito.conTomasDerivados ? SECCIONES_MINIMAS.iugConTomas : SECCIONES_MINIMAS.iug
    case 'TUG':
      return SECCIONES_MINIMAS.tug
    case 'TUE':
      return SECCIONES_MINIMAS.tue
  }
}

export function seccionMinima(p: ProyectoCalculado): Hallazgo[] {
  const hallazgos: Hallazgo[] = []

  for (const c of p.circuitos) {
    const minima = seccionMinimaDe(c.circuito)

    if (c.circuito.seccionMm2 < minima) {
      const detalle = c.circuito.conTomasDerivados
        ? ' (por incluir tomacorrientes derivados)'
        : ''

      hallazgos.push({
        id: `seccion-minima-${c.circuito.id}`,
        severidad: 'error',
        clausula: '770.11',
        mensaje:
          `${c.circuito.nombre}: la sección de ${c.circuito.seccionMm2} mm² está por debajo del ` +
          `mínimo de ${minima} mm² para un circuito ${c.circuito.tipo}${detalle}.`,
        sugerencia: `Subir la sección a ${minima} mm².`,
        alcance: { tipo: 'circuito', id: c.circuito.id },
      })
    }
  }

  return hallazgos
}
