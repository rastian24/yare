/** 770.10.3.1 y 770.10.3.6.2 — Curvas y cajas de paso en las canalizaciones. */

import { CANALIZACION } from '../tablas'
import type { Hallazgo } from '@/dominio/tipos'
import type { ProyectoCalculado } from '@/dominio/calculo/proyecto'

export function curvasPorTramo(p: ProyectoCalculado): Hallazgo[] {
  const hallazgos: Hallazgo[] = []

  for (const t of p.tramos) {
    const id = t.tramo.id

    if (t.curvas > CANALIZACION.maxCurvasEntreCajas) {
      hallazgos.push({
        id: `curvas-${id}`,
        severidad: 'error',
        clausula: '770.10.3.1',
        mensaje:
          `Tramo ${id}: tiene ${t.curvas} curvas y el máximo entre bocas, cajas o gabinetes es ` +
          `${CANALIZACION.maxCurvasEntreCajas}.`,
        sugerencia: 'Intercalar una caja de paso para partir el recorrido.',
        alcance: { tipo: 'tramo', id },
      })
    }

    if (t.longitudM !== null && t.longitudM > CANALIZACION.maxMetrosEntreCajas && t.curvas === 0) {
      hallazgos.push({
        id: `caja-paso-${id}`,
        severidad: 'advertencia',
        clausula: '770.10.3.6.2',
        mensaje:
          `Tramo ${id}: ${t.longitudM.toFixed(1)} m en recorrido recto sin derivación. En tramos ` +
          `rectos se debe colocar como mínimo una caja de paso cada ` +
          `${CANALIZACION.maxMetrosEntreCajas} m.`,
        sugerencia: `Agregar ${Math.floor(t.longitudM / CANALIZACION.maxMetrosEntreCajas)} caja(s) de paso.`,
        alcance: { tipo: 'tramo', id },
      })
    }
  }

  return hallazgos
}
