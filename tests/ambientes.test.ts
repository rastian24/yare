/**
 * Delimitación de ambientes sobre el plano.
 *
 * Lo que se verifica acá es que la superficie salga de la medida real —la del
 * DXF o la de la calibración— y que sin escala no salga ningún número.
 */

import { describe, expect, it } from 'vitest'
import {
  ambienteDesdePoligono,
  centroide,
  cierraElContorno,
  ladoMayorEnvolvente,
  medirPoligono,
  midePorLongitud,
  mismaSuperficie,
  perimetroPoligono,
  remedirAmbiente,
  seCruzaConsigoMismo,
  superficiesDeAmbientes,
} from '@/dominio/calculo/ambientes'
import { escalaDe } from '@/dominio/calculo/longitudes'
import { importarDXF } from '@/cad/importar'
import * as fdxf from './fixtures/dxf'
import { planoCalibrado, planoSinCalibrar } from './fixtures/proyecto'
import type { Ambiente, Escala, Punto } from '@/dominio/tipos'

/** Escala de un DXF en milímetros: la que sale de $INSUNITS = 4. */
const EN_MM: Escala = { metrosPorUnidad: 0.001, calibrado: true, origen: 'archivo' }

const SIN_ESCALA: Escala = { metrosPorUnidad: 0, calibrado: false, origen: 'sin_calibrar' }

function rect(x: number, y: number, ancho: number, alto: number): Punto[] {
  return [
    { x, y },
    { x: x + ancho, y },
    { x: x + ancho, y: y + alto },
    { x, y: y + alto },
  ]
}

describe('Medición de un contorno', () => {
  it('mide con las unidades del CAD: 5000 × 4000 mm son 20 m²', () => {
    const medidas = medirPoligono(rect(0, 0, 5000, 4000), EN_MM)

    expect(medidas?.superficieM2).toBeCloseTo(20, 6)
    expect(medidas?.perimetroM).toBeCloseTo(18, 6)
    expect(medidas?.longitudMayorM).toBeCloseTo(5, 6)
  })

  /**
   * El mismo contorno sobre una foto calibrada a 100 px por metro tiene que dar
   * lo mismo: para el cálculo, de dónde viene la escala es indiferente.
   */
  it('mide con la calibración manual de un plano raster', () => {
    const escala = escalaDe(planoCalibrado())
    const medidas = medirPoligono(rect(0, 0, 500, 400), escala)

    expect(escala.origen).toBe('manual')
    expect(medidas?.superficieM2).toBeCloseTo(20, 6)
    expect(medidas?.perimetroM).toBeCloseTo(18, 6)
  })

  it('sin escala no devuelve superficie, en lugar de devolver cero', () => {
    expect(medirPoligono(rect(0, 0, 500, 400), escalaDe(planoSinCalibrar()))).toBeNull()
    expect(medirPoligono(rect(0, 0, 500, 400), SIN_ESCALA)).toBeNull()
    expect(medirPoligono(rect(0, 0, 500, 400), null)).toBeNull()
  })

  it('no mide un contorno de menos de tres vértices', () => {
    expect(medirPoligono([{ x: 0, y: 0 }], EN_MM)).toBeNull()
    expect(
      medirPoligono(
        [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        EN_MM,
      ),
    ).toBeNull()
  })

  /** Los ambientes en "L" son moneda corriente: no se pueden medir por bbox. */
  it('mide un ambiente en L por la fórmula de Gauss, no por su envolvente', () => {
    const ele: Punto[] = [
      { x: 0, y: 0 },
      { x: 6000, y: 0 },
      { x: 6000, y: 2000 },
      { x: 3000, y: 2000 },
      { x: 3000, y: 5000 },
      { x: 0, y: 5000 },
    ]

    // 6 × 2 + 3 × 3 = 21 m², contra los 30 m² de la envolvente.
    expect(medirPoligono(ele, EN_MM)?.superficieM2).toBeCloseTo(21, 6)
    expect(ladoMayorEnvolvente(ele) * 0.001).toBeCloseTo(6, 6)
  })

  it('el perímetro cierra el contorno con el último lado', () => {
    expect(perimetroPoligono(rect(0, 0, 3, 4))).toBeCloseTo(14, 9)
  })
})

describe('Contorno cruzado', () => {
  it('un rectángulo no se cruza consigo mismo', () => {
    expect(seCruzaConsigoMismo(rect(0, 0, 10, 10))).toBe(false)
  })

  /**
   * La fórmula de Gauss no se queja de un moño: le resta el lóbulo invertido y
   * devuelve una superficie más chica sin avisar. Por eso se detecta aparte.
   */
  it('detecta el moño, donde la superficie deja de ser la que se ve', () => {
    const mono: Punto[] = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    ]

    expect(seCruzaConsigoMismo(mono)).toBe(true)
    expect(medirPoligono(mono, { ...EN_MM, metrosPorUnidad: 1 })?.superficieM2).toBeCloseTo(0, 9)
  })

  /**
   * Mientras se marca hay que mirar sólo los lados dibujados: el que cierra el
   * contorno todavía no existe y avisar por él sería un falso positivo.
   */
  it('en modo abierto no cuenta el lado que todavía no se dibujó', () => {
    const zeta: Punto[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 5 },
      { x: 10, y: 5 },
    ]

    expect(seCruzaConsigoMismo(zeta, true)).toBe(false)
    expect(seCruzaConsigoMismo(zeta)).toBe(true)
  })
})

describe('Cierre del contorno', () => {
  it('volver sobre el primer vértice cierra, pero recién con tres marcados', () => {
    const marcados = rect(0, 0, 100, 100).slice(0, 3)

    expect(cierraElContorno(marcados, { x: 3, y: 2 }, 5)).toBe(true)
    expect(cierraElContorno(marcados, { x: 30, y: 20 }, 5)).toBe(false)
    expect(cierraElContorno(marcados.slice(0, 2), { x: 0, y: 0 }, 5)).toBe(false)
  })
})

describe('Centroide', () => {
  it('cae dentro de un ambiente en L, donde el promedio de vértices falla', () => {
    const ele: Punto[] = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 6 },
      { x: 0, y: 6 },
    ]

    const c = centroide(ele)
    expect(c).not.toBeNull()
    // El brazo horizontal pesa más que el vertical: el centro tira hacia él.
    expect(c!.x).toBeGreaterThan(0)
    expect(c!.x).toBeLessThan(6)
    expect(c!.y).toBeGreaterThan(0)
    expect(c!.y).toBeLessThan(6)
  })

  it('un contorno degenerado cae al promedio de sus vértices', () => {
    const alineados: Punto[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ]

    expect(centroide(alineados)).toEqual({ x: 5, y: 0 })
    expect(centroide([])).toBeNull()
  })
})

describe('Ambiente a partir del contorno', () => {
  it('guarda la superficie medida y el contorno', () => {
    const poligono = rect(0, 0, 4000, 3000)
    const ambiente = ambienteDesdePoligono({
      id: 'amb-1',
      nombre: 'Dormitorio 1',
      tipo: 'dormitorio',
      poligono,
      escala: EN_MM,
    })

    expect(ambiente).toEqual({
      id: 'amb-1',
      nombre: 'Dormitorio 1',
      tipo: 'dormitorio',
      superficieM2: 12,
      poligono,
    })
    expect(ambiente!.longitudM).toBeUndefined()
  })

  /** Tabla 770.7.III: en pasillos y semicubiertos manda la longitud. */
  it('a un pasillo le agrega la longitud además de la superficie', () => {
    const ambiente = ambienteDesdePoligono({
      id: 'amb-2',
      nombre: 'Pasillo',
      tipo: 'pasillo',
      poligono: rect(0, 0, 7000, 1000),
      escala: EN_MM,
    })

    expect(midePorLongitud('pasillo')).toBe(true)
    expect(ambiente?.superficieM2).toBe(7)
    expect(ambiente?.longitudM).toBe(7)
  })

  it('sin escala no crea el ambiente', () => {
    expect(
      ambienteDesdePoligono({
        id: 'amb-3',
        nombre: 'Estar',
        tipo: 'estar',
        poligono: rect(0, 0, 4000, 3000),
        escala: SIN_ESCALA,
      }),
    ).toBeNull()
  })

  /**
   * La superficie de un ambiente delimitado sale del DXF sin intervención: es
   * el mismo número que el import ya calcula para las polilíneas cerradas.
   */
  it('sobre un DXF da lo mismo que la detección automática', () => {
    const r = importarDXF(fdxf.dxf({ insUnits: 4, entidades: fdxf.rectangulo(0, 0, 5000, 4000) }))
    const poli = r.entidades.find((e) => e.tipo === 'polilinea')
    if (poli?.tipo !== 'polilinea') throw new Error('esperaba una polilínea')

    const plano = {
      id: 'p',
      nombre: 'planta.dxf',
      fuente: {
        tipo: 'dxf' as const,
        blobId: 'b',
        unidades: r.unidades,
        capas: r.capas,
        entidades: r.entidades,
        bbox: r.bbox,
        calibracion: null,
      },
    }

    const ambiente = ambienteDesdePoligono({
      id: 'amb-4',
      nombre: 'Estar',
      tipo: 'estar',
      poligono: poli.puntos,
      escala: escalaDe(plano),
    })

    expect(ambiente?.superficieM2).toBe(20)
  })
})

describe('Remedición al cambiar la escala', () => {
  it('recalcula la superficie de los ambientes delimitados', () => {
    const ambiente: Ambiente = {
      id: 'amb-1',
      nombre: 'Estar',
      tipo: 'estar',
      superficieM2: 20,
      poligono: rect(0, 0, 500, 400),
    }

    // La calibración pasa de 100 px/m a 200 px/m: el mismo contorno vale la
    // cuarta parte.
    const remedido = remedirAmbiente(ambiente, {
      metrosPorUnidad: 1 / 200,
      calibrado: true,
      origen: 'manual',
    })

    expect(remedido.superficieM2).toBe(5)
  })

  it('deja intacto un ambiente cargado a mano, sin contorno', () => {
    const aMano: Ambiente = { id: 'x', nombre: 'Estar', tipo: 'estar', superficieM2: 24 }

    expect(remedirAmbiente(aMano, EN_MM)).toBe(aMano)
  })

  it('sin escala no toca la superficie que ya tenía', () => {
    const ambiente: Ambiente = {
      id: 'amb-1',
      nombre: 'Estar',
      tipo: 'estar',
      superficieM2: 20,
      poligono: rect(0, 0, 500, 400),
    }

    expect(remedirAmbiente(ambiente, SIN_ESCALA).superficieM2).toBe(20)
  })

  it('al pasar a pasillo aparece la longitud, y al salir se va', () => {
    const poligono = rect(0, 0, 7000, 1000)
    const pasillo = remedirAmbiente(
      { id: 'a', nombre: 'Pasillo', tipo: 'pasillo', superficieM2: 0, poligono },
      EN_MM,
    )
    expect(pasillo.longitudM).toBe(7)

    const estar = remedirAmbiente({ ...pasillo, tipo: 'estar' }, EN_MM)
    expect(estar.longitudM).toBeUndefined()
  })
})

describe('Superficies del inmueble', () => {
  /** 770.7.3: los semicubiertos computan al 50 %, así que van por separado. */
  it('separa lo cubierto de lo semicubierto', () => {
    const suma = superficiesDeAmbientes([
      { id: '1', nombre: 'Estar', tipo: 'estar', superficieM2: 24 },
      { id: '2', nombre: 'Dormitorio', tipo: 'dormitorio', superficieM2: 12.5 },
      { id: '3', nombre: 'Galería', tipo: 'semicubierto', superficieM2: 8, longitudM: 4 },
    ])

    expect(suma).toEqual({ cubiertaM2: 36.5, semicubiertaM2: 8 })
  })

  it('sin ambientes las superficies son cero', () => {
    expect(superficiesDeAmbientes([])).toEqual({ cubiertaM2: 0, semicubiertaM2: 0 })
  })

  it('compara superficies al centímetro cuadrado', () => {
    expect(mismaSuperficie(36.5, 36.5)).toBe(true)
    expect(mismaSuperficie(36.5, 36.51)).toBe(false)
  })
})
