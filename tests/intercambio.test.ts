/**
 * Ida y vuelta del archivo de proyecto. Lo que se testea acá no es el camino
 * feliz sino el otro: un archivo importado es dato ajeno —viejo, editado a
 * mano o de otra aplicación— y no puede llegar roto al cálculo.
 */

import { describe, expect, it } from 'vitest'
import {
  ErrorImportacion,
  FORMATO,
  VERSION_FORMATO,
  parsearArchivoProyecto,
  serializarProyecto,
} from '@/persistencia/intercambio'
import { calcularProyecto } from '@/dominio/calculo/proyecto'
import { ALTURAS_POR_DEFECTO, SUMINISTRO_POR_DEFECTO } from '@/dominio/tipos'
import { proyectoBase } from './fixtures/proyecto'

describe('Exportar e importar', () => {
  it('devuelve el proyecto igual al exportado', () => {
    const original = proyectoBase()
    const { proyecto, adjuntos } = parsearArchivoProyecto(serializarProyecto(original, []))

    expect(proyecto).toEqual(original)
    expect(adjuntos).toEqual([])
  })

  it('conserva el plano adjunto', () => {
    const adjunto = {
      id: 'blob-1',
      nombre: 'planta.png',
      tipo: 'image/png',
      datos: 'aGVjaG8=',
    }
    const { adjuntos } = parsearArchivoProyecto(
      serializarProyecto(proyectoBase(), [adjunto]),
    )

    expect(adjuntos).toEqual([adjunto])
  })

  it('un proyecto importado sigue calculando lo mismo', () => {
    const original = proyectoBase()
    const { proyecto } = parsearArchivoProyecto(serializarProyecto(original, []))

    expect(calcularProyecto(proyecto).grado).toBe(calcularProyecto(original).grado)
  })

  it('acepta las exportaciones viejas, que eran el proyecto pelado', () => {
    const original = proyectoBase()
    const { proyecto, adjuntos } = parsearArchivoProyecto(JSON.stringify(original))

    expect(proyecto).toEqual(original)
    expect(adjuntos).toEqual([])
  })
})

describe('Archivos que no se pueden importar', () => {
  it('rechaza lo que no es JSON', () => {
    expect(() => parsearArchivoProyecto('no soy json')).toThrow(ErrorImportacion)
  })

  it('rechaza un JSON ajeno', () => {
    expect(() => parsearArchivoProyecto('{"foo":1}')).toThrow(ErrorImportacion)
    expect(() => parsearArchivoProyecto('[1,2,3]')).toThrow(ErrorImportacion)
  })

  it('rechaza un formato más nuevo en vez de leerlo a medias', () => {
    const futuro = JSON.stringify({
      formato: FORMATO,
      version: VERSION_FORMATO + 1,
      proyecto: proyectoBase(),
      adjuntos: [],
    })

    expect(() => parsearArchivoProyecto(futuro)).toThrow(/más nueva/)
  })
})

describe('Tolerancia a archivos incompletos o adulterados', () => {
  const archivo = (proyecto: unknown): string =>
    JSON.stringify({ formato: FORMATO, version: VERSION_FORMATO, proyecto, adjuntos: [] })

  it('completa suministro y alturas con los valores por defecto', () => {
    const { proyecto } = parsearArchivoProyecto(
      archivo({ id: 'p1', nombre: 'Sin datos', inmueble: {}, circuitos: [] }),
    )

    expect(proyecto.suministro).toEqual(SUMINISTRO_POR_DEFECTO)
    expect(proyecto.alturas).toEqual(ALTURAS_POR_DEFECTO)
    expect(proyecto.precios.items.length).toBeGreaterThan(0)
  })

  it('descarta los números que no son números', () => {
    const { proyecto } = parsearArchivoProyecto(
      archivo({
        id: 'p1',
        nombre: 'Adulterado',
        inmueble: { superficieCubiertaM2: '90', ambientes: [] },
        suministro: { tensionV: 'doscientos veinte', fases: 'trifasica' },
        alturas: { bocaTechoM: null },
        circuitos: [],
      }),
    )

    expect(proyecto.inmueble.superficieCubiertaM2).toBe(0)
    expect(proyecto.suministro.tensionV).toBe(SUMINISTRO_POR_DEFECTO.tensionV)
    expect(proyecto.suministro.fases).toBe('trifasica')
    expect(proyecto.alturas.bocaTechoM).toBe(ALTURAS_POR_DEFECTO.bocaTechoM)
  })

  it('respeta los precios del archivo, con su fecha', () => {
    const { proyecto } = parsearArchivoProyecto(
      archivo({
        ...proyectoBase(),
        precios: {
          actualizadaEn: '2024-01-01',
          items: [
            {
              id: 'cable_2_5',
              descripcion: 'Cable 2,5 mm²',
              unidad: 'metro',
              precioARS: 1234,
              categoria: 'cable',
            },
          ],
          ayudaGremioPct: 5,
          gastosGeneralesPct: 10,
          beneficioPct: 15,
          ivaPct: 21,
        },
      }),
    )

    expect(proyecto.precios.actualizadaEn).toBe('2024-01-01')
    expect(proyecto.precios.items).toHaveLength(1)
    expect(proyecto.precios.items[0]?.precioARS).toBe(1234)
  })

  it('descarta bocas, tramos y adjuntos sin identificador', () => {
    const texto = JSON.stringify({
      formato: FORMATO,
      version: VERSION_FORMATO,
      proyecto: {
        ...proyectoBase(),
        elementos: [null, { simboloId: 'luz_techo' }, ...proyectoBase().elementos],
        tramos: 'ninguno',
      },
      adjuntos: [{ nombre: 'sin id.png' }, { id: 'blob-1', datos: 'aGVjaG8=' }],
    })

    const { proyecto, adjuntos } = parsearArchivoProyecto(texto)

    expect(proyecto.elementos).toEqual(proyectoBase().elementos)
    expect(proyecto.tramos).toEqual([])
    expect(adjuntos).toHaveLength(1)
    expect(adjuntos[0]?.id).toBe('blob-1')
  })

  it('le pone nombre e id al proyecto que no los trae', () => {
    const { proyecto } = parsearArchivoProyecto(archivo({ inmueble: {}, circuitos: [] }))

    expect(proyecto.id).not.toBe('')
    expect(proyecto.nombre).toBe('Proyecto importado')
  })
})
