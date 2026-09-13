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

describe('borrarElementos', () => {
  beforeEach(() => {
    const proyecto = proyectoBase({ planos: [planoCalibrado()] })
    proyecto.tramos = [
      tramoHasta('tramo-1', ['tablero', 'el-1'], 5),
      tramoHasta('tramo-2', ['el-1'], 3),
    ]
    useApp.getState().reemplazarProyecto(proyecto)
  })

  it('borra todos los elementos pedidos de una sola pasada', () => {
    const antes = useApp.getState().proyecto.elementos.length
    useApp.getState().borrarElementos(['el-1', 'el-2'])

    const { elementos } = useApp.getState().proyecto
    expect(elementos).toHaveLength(antes - 2)
    expect(elementos.some((e) => e.id === 'el-1' || e.id === 'el-2')).toBe(false)
  })

  it('desvincula los tramos y descarta los que se quedan sin extremos', () => {
    useApp.getState().borrarElementos(['el-1'])

    const { tramos } = useApp.getState().proyecto
    expect(tramos.map((t) => t.id)).toEqual(['tramo-1'])
    expect(tramos[0]!.elementoIds).toEqual(['tablero'])
  })

  it('saca de la selección lo que ya no está', () => {
    useApp.getState().setSeleccion(['el-1', 'el-2'])
    useApp.getState().borrarElementos(['el-1'])

    expect(useApp.getState().seleccion).toEqual(['el-2'])
  })

  it('no toca el proyecto si no hay nada que borrar', () => {
    const antes = useApp.getState().proyecto
    useApp.getState().borrarElementos([])

    expect(useApp.getState().proyecto).toBe(antes)
  })

  it('borrarElemento sigue borrando de a uno', () => {
    useApp.getState().borrarElemento('el-1')

    expect(useApp.getState().proyecto.elementos.some((e) => e.id === 'el-1')).toBe(false)
  })
})
