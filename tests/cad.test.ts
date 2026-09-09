import { describe, expect, it } from 'vitest'
import { importarDXF, pareceDWG } from '@/cad/importar'
import {
  diagnosticarUnidades,
  unidadDeclaradaEsPlausible,
  unidadMasProbable,
} from '@/cad/unidades'
import { detectarAmbientes, aAmbiente, tipoDesdeNombre } from '@/cad/ambientes'
import { IndiceEspacial, forzarOrtogonal, segmentosDe } from '@/cad/snapping'
import { areaPoligono } from '@/dominio/calculo/longitudes'
import { escalaDe } from '@/dominio/calculo/longitudes'
import * as f from './fixtures/dxf'
import type { Plano } from '@/dominio/tipos'

describe('Unidades ($INSUNITS)', () => {
  it('un rectángulo de 5000 × 4000 en mm da 20 m²', () => {
    const r = importarDXF(f.dxf({ insUnits: 4, entidades: f.rectangulo(0, 0, 5000, 4000) }))

    expect(r.unidades).toBe('mm')
    expect(r.origenUnidad).toBe('declarada')

    const poli = r.entidades.find((e) => e.tipo === 'polilinea')
    expect(poli).toBeDefined()
    if (poli?.tipo !== 'polilinea') throw new Error('esperaba una polilínea')

    // 5000 mm × 4000 mm = 5 m × 4 m = 20 m²
    expect(areaPoligono(poli.puntos) * 0.001 ** 2).toBeCloseTo(20, 5)
  })

  /**
   * El mismo dibujo declarado en metros daría 20 000 000 m², que es absurdo
   * para una vivienda unifamiliar. Se avisa en lugar de calcular mal todo el
   * grado de electrificación.
   */
  it('rechaza por implausible una unidad que da un tamaño absurdo', () => {
    const r = importarDXF(f.dxf({ insUnits: 6, entidades: f.rectangulo(0, 0, 5000, 4000) }))

    expect(r.unidades).toBe('m')
    expect(r.avisos.some((a) => /verificar la unidad/i.test(a))).toBe(true)

    expect(
      unidadDeclaradaEsPlausible('m', { min: { x: 0, y: 0 }, max: { x: 5000, y: 4000 } }),
    ).toBe(false)
    expect(
      unidadDeclaradaEsPlausible('mm', { min: { x: 0, y: 0 }, max: { x: 5000, y: 4000 } }),
    ).toBe(true)
  })

  it('sin $INSUNITS propone una unidad pero avisa que hay que confirmarla', () => {
    const r = importarDXF(f.dxf({ insUnits: 0, entidades: f.rectangulo(0, 0, 12000, 9000) }))

    expect(r.origenUnidad).toBe('inferida')
    expect(r.unidades).toBe('mm')
    expect(r.avisos.some((a) => /no declara unidades/i.test(a))).toBe(true)
  })

  it('si ninguna unidad es plausible, no adivina', () => {
    // Un dibujo de 0,5 unidades de lado no es una vivienda en ninguna unidad.
    const bbox = { min: { x: 0, y: 0 }, max: { x: 0.5, y: 0.4 } }
    expect(unidadMasProbable(bbox)).toBeNull()

    const r = importarDXF(f.dxf({ insUnits: 0, entidades: f.rectangulo(0, 0, 0.5, 0.4) }))
    expect(r.origenUnidad).toBe('indeterminada')
    expect(r.unidades).toBe('sin_definir')
  })

  it('un plano sin unidades no produce escala, y eso bloquea las longitudes', () => {
    const r = importarDXF(f.dxf({ insUnits: 0, entidades: f.rectangulo(0, 0, 0.5, 0.4) }))

    const plano: Plano = {
      id: 'p1',
      nombre: 'test',
      fuente: {
        tipo: 'dxf',
        blobId: 'b1',
        unidades: r.unidades,
        capas: r.capas,
        entidades: r.entidades,
        bbox: r.bbox,
        calibracion: null,
      },
    }

    expect(escalaDe(plano).calibrado).toBe(false)
  })

  it('el diagnóstico muestra el tamaño resultante en cada unidad', () => {
    const d = diagnosticarUnidades({ min: { x: 0, y: 0 }, max: { x: 12400, y: 8900 } })

    const mm = d.find((x) => x.unidad === 'mm')!
    expect(mm.dimensionMayorM).toBeCloseTo(12.4, 5)
    expect(mm.plausible).toBe(true)

    const m = d.find((x) => x.unidad === 'm')!
    expect(m.dimensionMayorM).toBeCloseTo(12400, 5)
    expect(m.plausible).toBe(false)
  })
})

describe('Denormalización de bloques', () => {
  it('aplica la escala de un INSERT a la geometría del bloque', () => {
    const r = importarDXF(
      f.dxf({
        insUnits: 4,
        bloques: f.bloqueRectangulo('LOCAL', 1000, 1000),
        entidades: f.insert('LOCAL', 0, 0, 2),
      }),
    )

    const poli = r.entidades.find((e) => e.tipo === 'polilinea')
    if (poli?.tipo !== 'polilinea') throw new Error('esperaba una polilínea')

    // El bloque mide 1000 × 1000; con escala 2 debe medir 2000 × 2000.
    const xs = poli.puntos.map((p) => p.x)
    const ys = poli.puntos.map((p) => p.y)
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(2000, 3)
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(2000, 3)
  })

  it('aplica la traslación de un INSERT', () => {
    const r = importarDXF(
      f.dxf({
        insUnits: 4,
        bloques: f.bloqueRectangulo('LOCAL', 1000, 1000),
        entidades: f.insert('LOCAL', 5000, 3000, 1),
      }),
    )

    const poli = r.entidades.find((e) => e.tipo === 'polilinea')
    if (poli?.tipo !== 'polilinea') throw new Error('esperaba una polilínea')

    const xs = poli.puntos.map((p) => p.x)
    expect(Math.min(...xs)).toBeCloseTo(5000, 3)
  })
})

describe('Detección de ambientes', () => {
  it('calcula el área de un polígono en L por la fórmula de Gauss', () => {
    const r = importarDXF(f.dxf({ insUnits: 4, entidades: f.poligonoL(3000) }))

    const poli = r.entidades.find((e) => e.tipo === 'polilinea')
    if (poli?.tipo !== 'polilinea') throw new Error('esperaba una polilínea')

    // La L es un cuadrado de 2a × 2a menos un cuadrado de a × a, con a = 3 m:
    // 36 - 9 = 27 m²
    expect(areaPoligono(poli.puntos) * 0.001 ** 2).toBeCloseTo(27, 4)
  })

  it('detecta locales y les pone el nombre del texto que contienen', () => {
    const entidades = [
      f.rectangulo(0, 0, 4000, 3000, 'LOCALES'),
      f.texto(2000, 1500, 'DORMITORIO 1', 'ROTULOS'),
      f.rectangulo(5000, 0, 3000, 3000, 'LOCALES'),
      f.texto(6500, 1500, 'COCINA', 'ROTULOS'),
    ].join('\n')

    const r = importarDXF(f.dxf({ insUnits: 4, entidades, capas: ['0', 'LOCALES', 'ROTULOS'] }))
    const detectados = detectarAmbientes(r.entidades, r.unidades)

    expect(detectados).toHaveLength(2)

    const dorm = detectados.find((a) => a.nombre.includes('DORMITORIO'))
    expect(dorm).toBeDefined()
    expect(dorm!.tipoPropuesto).toBe('dormitorio')
    expect(dorm!.confianza).toBe('alta')
    expect(dorm!.superficieM2).toBeCloseTo(12, 2)

    const cocina = detectados.find((a) => a.nombre.includes('COCINA'))
    expect(cocina!.tipoPropuesto).toBe('cocina')
    expect(cocina!.superficieM2).toBeCloseTo(9, 2)
  })

  it('filtra por capa cuando se le indica', () => {
    const entidades = [
      f.rectangulo(0, 0, 4000, 3000, 'LOCALES'),
      f.rectangulo(5000, 0, 3000, 3000, 'MUEBLES'),
    ].join('\n')

    const r = importarDXF(f.dxf({ insUnits: 4, entidades, capas: ['0', 'LOCALES', 'MUEBLES'] }))

    expect(detectarAmbientes(r.entidades, r.unidades, { capas: ['LOCALES'] })).toHaveLength(1)
    expect(detectarAmbientes(r.entidades, r.unidades)).toHaveLength(2)
  })

  it('descarta polígonos demasiado chicos, como carpintería o mobiliario', () => {
    const entidades = [
      f.rectangulo(0, 0, 4000, 3000, 'LOCALES'),
      f.rectangulo(500, 500, 600, 400, 'LOCALES'), // 0,24 m²
    ].join('\n')

    const r = importarDXF(f.dxf({ insUnits: 4, entidades, capas: ['0', 'LOCALES'] }))
    expect(detectarAmbientes(r.entidades, r.unidades)).toHaveLength(1)
  })

  it('descarta el contorno cuando envuelve a otro local', () => {
    const entidades = [
      f.rectangulo(0, 0, 10000, 8000, 'MUROS'), // contorno general
      f.rectangulo(500, 500, 4000, 3000, 'MUROS'), // local adentro
    ].join('\n')

    const r = importarDXF(f.dxf({ insUnits: 4, entidades, capas: ['0', 'MUROS'] }))
    const detectados = detectarAmbientes(r.entidades, r.unidades)

    expect(detectados).toHaveLength(1)
    expect(detectados[0]!.superficieM2).toBeCloseTo(12, 2)
  })

  it('sin unidades no detecta nada, porque no puede medir', () => {
    const r = importarDXF(f.dxf({ insUnits: 0, entidades: f.rectangulo(0, 0, 0.4, 0.3) }))
    expect(detectarAmbientes(r.entidades, r.unidades)).toEqual([])
  })

  it('un pasillo guarda su longitud en metros, no en unidades de dibujo', () => {
    const entidades = [
      f.rectangulo(0, 0, 8000, 1200, 'LOCALES'),
      f.texto(4000, 600, 'PASILLO', 'LOCALES'),
    ].join('\n')

    const r = importarDXF(f.dxf({ insUnits: 4, entidades, capas: ['0', 'LOCALES'] }))
    const detectado = detectarAmbientes(r.entidades, r.unidades)[0]!
    const ambiente = aAmbiente(detectado, r.unidades)

    expect(ambiente.tipo).toBe('pasillo')
    expect(ambiente.longitudM).toBeCloseTo(8, 2)
  })
})

describe('Mapeo de nombres a tipo de ambiente', () => {
  it('reconoce los rótulos habituales de un plano argentino', () => {
    expect(tipoDesdeNombre('DORM. 2').tipo).toBe('dormitorio')
    expect(tipoDesdeNombre('Cocina - Comedor').tipo).toBe('cocina')
    expect(tipoDesdeNombre('BAÑO').tipo).toBe('bano')
    expect(tipoDesdeNombre('Toilette').tipo).toBe('toilette')
    expect(tipoDesdeNombre('LAVADERO').tipo).toBe('lavadero')
    expect(tipoDesdeNombre('Living comedor').tipo).toBe('estar')
    expect(tipoDesdeNombre('COCHERA').tipo).toBe('vestibulo')
    expect(tipoDesdeNombre('Galería').tipo).toBe('semicubierto')
  })

  it('el toilette gana sobre baño porque es más específico', () => {
    expect(tipoDesdeNombre('TOILETTE').tipo).toBe('toilette')
  })

  it('marca baja confianza cuando no reconoce el rótulo', () => {
    expect(tipoDesdeNombre('LOCAL 4').confianza).toBe('baja')
  })
})

describe('Snapping', () => {
  it('engancha al extremo de una línea', () => {
    const r = importarDXF(f.dxf({ insUnits: 4, entidades: f.linea(0, 0, 1000, 0) }))
    const indice = new IndiceEspacial(r.entidades, r.bbox)

    const s = indice.snap({ x: 990, y: 15 }, 100)
    expect(s).not.toBeNull()
    expect(s!.tipo).toBe('extremo')
    expect(s!.punto.x).toBeCloseTo(1000, 3)
    expect(s!.punto.y).toBeCloseTo(0, 3)
  })

  it('engancha al punto medio', () => {
    const r = importarDXF(f.dxf({ insUnits: 4, entidades: f.linea(0, 0, 1000, 0) }))
    const indice = new IndiceEspacial(r.entidades, r.bbox)

    const s = indice.snap({ x: 500, y: 20 }, 100)
    expect(s).not.toBeNull()
    expect(s!.punto.x).toBeCloseTo(500, 3)
  })

  it('engancha a la intersección de dos líneas', () => {
    const entidades = [f.linea(0, 500, 1000, 500), f.linea(500, 0, 500, 1000)].join('\n')
    const r = importarDXF(f.dxf({ insUnits: 4, entidades }))
    const indice = new IndiceEspacial(r.entidades, r.bbox)

    const s = indice.snap({ x: 515, y: 515 }, 60, new Set(['interseccion']))
    expect(s).not.toBeNull()
    expect(s!.tipo).toBe('interseccion')
    expect(s!.punto.x).toBeCloseTo(500, 3)
    expect(s!.punto.y).toBeCloseTo(500, 3)
  })

  it('no engancha nada fuera del radio', () => {
    const r = importarDXF(f.dxf({ insUnits: 4, entidades: f.linea(0, 0, 1000, 0) }))
    const indice = new IndiceEspacial(r.entidades, r.bbox)

    expect(indice.snap({ x: 500, y: 5000 }, 50)).toBeNull()
  })

  it('descompone una polilínea cerrada en todos sus lados', () => {
    const segs = segmentosDe({
      tipo: 'polilinea',
      capa: '0',
      puntos: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      cerrada: true,
    })
    expect(segs).toHaveLength(3)
  })
})

describe('Ruteo ortogonal (770.10.3.1)', () => {
  it('fuerza el segmento al eje dominante', () => {
    expect(forzarOrtogonal({ x: 0, y: 0 }, { x: 100, y: 20 })).toEqual({ x: 100, y: 0 })
    expect(forzarOrtogonal({ x: 0, y: 0 }, { x: 20, y: 100 })).toEqual({ x: 0, y: 100 })
  })
})

describe('DWG', () => {
  it('detecta un DWG por extensión y por firma', () => {
    expect(pareceDWG('plano.dwg', '')).toBe(true)
    expect(pareceDWG('plano.DWG', '')).toBe(true)
    expect(pareceDWG('plano.dxf', 'AC1027')).toBe(true)
    expect(pareceDWG('plano.dxf', '0\nSECTION')).toBe(false)
  })
})
