/**
 * Acciones del store que no son un simple `set`.
 *
 * La persistencia se simula: el store guarda en IndexedDB con un diferido de
 * 600 ms y acá no hay navegador.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/persistencia/db', () => ({
  guardarProyecto: vi.fn(async () => {}),
}))

import { useApp } from '@/estado/store'
import { planoCalibrado, proyectoBase, tramoHasta } from './fixtures/proyecto'
import type { Plano } from '@/dominio/tipos'

function planoNuevo(): Plano {
  return {
    id: 'plano-2',
    nombre: 'Planta corregida',
    fuente: {
      tipo: 'raster',
      blobId: 'blob-2',
      anchoPx: 2400,
      altoPx: 1800,
      calibracion: null,
    },
  }
}

describe('establecerPlano', () => {
  beforeEach(() => {
    const proyecto = proyectoBase({ planos: [planoCalibrado()] })
    proyecto.tramos = [tramoHasta('tramo-1', ['tablero'], 5)]
    useApp.getState().reemplazarProyecto(proyecto)
  })

  it('deja un solo plano: el nuevo reemplaza al anterior', () => {
    useApp.getState().establecerPlano(planoNuevo())

    const { planos } = useApp.getState().proyecto
    expect(planos.map((p) => p.id)).toEqual(['plano-2'])
  })

  it('carga el primer plano cuando el proyecto no tenía ninguno', () => {
    useApp.getState().reemplazarProyecto(proyectoBase({ planos: [] }))
    useApp.getState().establecerPlano(planoNuevo())

    expect(useApp.getState().proyecto.planos.map((p) => p.id)).toEqual(['plano-2'])
  })

  it('repunta al plano nuevo lo ya dibujado', () => {
    const { elementos, tramos } = useApp.getState().proyecto
    expect(elementos.length).toBeGreaterThan(0)
    expect(tramos.length).toBeGreaterThan(0)

    useApp.getState().establecerPlano(planoNuevo())

    const p = useApp.getState().proyecto
    expect(p.elementos.every((e) => e.planoId === 'plano-2')).toBe(true)
    expect(p.tramos.every((t) => t.planoId === 'plano-2')).toBe(true)
    expect(p.elementos).toHaveLength(elementos.length)
  })

  it('olvida las capas ocultas, que eran del archivo anterior', () => {
    useApp.getState().toggleCapa('MUROS')
    expect(useApp.getState().capasOcultas.has('MUROS')).toBe(true)

    useApp.getState().establecerPlano(planoNuevo())

    expect(useApp.getState().capasOcultas.size).toBe(0)
  })
})
