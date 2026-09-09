/**
 * Casos de prueba tomados textualmente de AEA 90364-7-770.
 *
 * La norma incluye tres ejemplos resueltos que sirven de verificación directa
 * del algoritmo de selección de cañerías. Si alguno de estos falla, el motor
 * está mal, no el test.
 */

import { describe, expect, it } from 'vitest'
import {
  areaOcupada,
  calcularCaneria,
  calcularCaneriaConSaltoPorCorrugado,
  hazDeCircuitos,
} from '@/dominio/calculo/canerias'
import { buscarCano } from '@/normativa/aea770/canerias'

describe('Tabla 770.10.VII/VIII — lectura directa para haz homogéneo', () => {
  /**
   * Nota al pie 3 de 770.10.3.3.4:
   * "Para el pasaje de dos conductores de 2,5 mm² (+ PE), las tablas 770.10.VII
   *  y 770.10.VIII establecen una medida de canalización de RS 16, RP 16 o
   *  equivalente (designación comercial 5/8")."
   */
  it('2 cables de 2,5 mm² + PE entran en RS 16 (metálica)', () => {
    const r = calcularCaneria({
      cables: [{ seccionMm2: 2.5, cantidad: 2 }],
      pe: [{ seccionMm2: 2.5, cantidad: 1 }],
      familia: 'metalica',
    })

    expect(r).not.toBeNull()
    expect(r!.cano.designacion).toBe('RS 16')
    expect(r!.cano.comercial).toBe('5/8"')
    expect(r!.metodo).toBe('tabla')
  })

  it('2 cables de 2,5 mm² + PE entran en RP 16 (aislante rígida)', () => {
    const r = calcularCaneria({
      cables: [{ seccionMm2: 2.5, cantidad: 2 }],
      pe: [{ seccionMm2: 2.5, cantidad: 1 }],
      familia: 'rigida',
    })

    expect(r).not.toBeNull()
    expect(r!.cano.designacion).toBe('RP 16')
    expect(r!.cano.comercial).toBe('5/8"')
  })

  /**
   * Continuación de la misma nota:
   * "Si el caño a instalar posee una pared interna no uniforme, como ser
   *  corrugado por dentro, se debe adoptar una medida no menor a RS 19, RP 20 o
   *  equivalente - designación comercial 3/4" - (la inmediata superior)."
   */
  it('el mismo haz en pared no uniforme sube a RS 19', () => {
    const r = calcularCaneriaConSaltoPorCorrugado({
      cables: [{ seccionMm2: 2.5, cantidad: 2 }],
      pe: [{ seccionMm2: 2.5, cantidad: 1 }],
      familia: 'curvable',
      familiaLisaDeReferencia: 'metalica',
    })

    expect(r).not.toBeNull()
    expect(r!.cano.designacion).toBe('RS 19')
    expect(r!.cano.comercial).toBe('3/4"')
    expect(r!.justificacion).toContain('770.10.3.3.4 e.2')
  })

  it('el mismo haz en pared no uniforme sube a RP 20 en la familia rígida', () => {
    const r = calcularCaneriaConSaltoPorCorrugado({
      cables: [{ seccionMm2: 2.5, cantidad: 2 }],
      pe: [{ seccionMm2: 2.5, cantidad: 1 }],
      familia: 'curvable',
      familiaLisaDeReferencia: 'rigida',
    })

    expect(r).not.toBeNull()
    expect(r!.cano.designacion).toBe('RP 20')
    expect(r!.cano.comercial).toBe('3/4"')
  })

  /**
   * 770.10.3.8.4:
   * "un caño IRAM-IAS U 500 2005, semipesado de 32 mm (1 1/4"), puede contener
   *  seis cables de 6 mm² más PE."
   */
  it('RS 32 admite exactamente 6 cables de 6 mm² + PE', () => {
    const seis = calcularCaneria({
      cables: [{ seccionMm2: 6, cantidad: 6 }],
      pe: [{ seccionMm2: 6, cantidad: 1 }],
      familia: 'metalica',
    })

    expect(seis).not.toBeNull()
    expect(seis!.cano.designacion).toBe('RS 32')
    expect(seis!.cano.comercial).toBe('1 1/4"')
  })

  it('el séptimo cable de 6 mm² ya no entra en RS 32', () => {
    const siete = calcularCaneria({
      cables: [{ seccionMm2: 6, cantidad: 7 }],
      pe: [{ seccionMm2: 6, cantidad: 1 }],
      familia: 'metalica',
    })

    expect(siete).not.toBeNull()
    // RL 32 (661 mm²) es el inmediato superior y la tabla le da 7 cables de 6 mm².
    expect(siete!.cano.designacion).toBe('RL 32')
  })

  /**
   * 770.10.3.8.4:
   * "un caño IRAM 62386-21, rígido pesado de 16 mm, puede contener dos cables
   *  de 1 mm² más PE."
   */
  it('RP 16 admite 2 cables de 1 mm² + PE', () => {
    const r = calcularCaneria({
      cables: [{ seccionMm2: 1, cantidad: 2 }],
      pe: [{ seccionMm2: 2.5, cantidad: 1 }],
      familia: 'rigida',
    })

    expect(r).not.toBeNull()
    expect(r!.cano.designacion).toBe('RP 16')
  })
})

describe('Regla del 35 % para haces de secciones mezcladas (770.10.3.8.4)', () => {
  it('un haz mezclado se resuelve por llenado, no por tabla', () => {
    const r = calcularCaneria({
      cables: [
        { seccionMm2: 2.5, cantidad: 2 },
        { seccionMm2: 1.5, cantidad: 2 },
      ],
      pe: [{ seccionMm2: 2.5, cantidad: 1 }],
      familia: 'rigida',
    })

    expect(r).not.toBeNull()
    expect(r!.metodo).toBe('llenado_35')
    expect(r!.ocupacionPct).toBeLessThanOrEqual(35)
  })

  it('nunca supera el 35 % de ocupación', () => {
    const r = calcularCaneria({
      cables: [
        { seccionMm2: 6, cantidad: 3 },
        { seccionMm2: 4, cantidad: 4 },
        { seccionMm2: 2.5, cantidad: 6 },
      ],
      pe: [{ seccionMm2: 6, cantidad: 3 }],
      familia: 'metalica',
    })

    expect(r).not.toBeNull()
    expect(r!.ocupacionPct).toBeLessThanOrEqual(35)
  })

  /**
   * La Tabla 770.10.VII no consigna valor para 6 mm² en RL 51 pese a que su
   * sección interna (1 810 mm²) es mayor que la de RS 51 (1 662 mm²), que sí
   * admite 18. La regla del 35 % cubre ese hueco de forma coherente.
   */
  it('el hueco de RL 51 para 6 mm² lo cubre la regla del 35 %', () => {
    const areaHaz = areaOcupada([
      { seccionMm2: 6, cantidad: 18 },
      { seccionMm2: 6, cantidad: 1 },
    ])
    const rl51 = buscarCano('RL 51')!

    expect(areaHaz).toBeLessThanOrEqual(rl51.seccionInternaMm2 * 0.35)
  })
})

describe('Pisos de diámetro interno (770.10.3.8.4 y 770.7.1 p)', () => {
  /**
   * El piso se verifica por designación y no por el diámetro derivado del área
   * libre: esas áreas son orientativas. RS 16 tiene 132 mm² de área libre, que
   * daría 12,96 mm de diámetro interno, y sin embargo la norma lo enumera entre
   * los caños que cumplen el piso de 13 mm de los circuitos terminales.
   */
  it('un circuito terminal admite la medida 16, que es el piso de 13 mm', () => {
    const r = calcularCaneria({
      cables: [{ seccionMm2: 1, cantidad: 2 }],
      pe: [{ seccionMm2: 2.5, cantidad: 1 }],
      familia: 'metalica',
    })

    expect(r).not.toBeNull()
    expect(r!.cano.diametroNominalMm).toBeGreaterThanOrEqual(16)
    expect(r!.cano.designacion).toBe('RS 16')
  })

  it('un corrugado de 16 no alcanza el piso de un circuito terminal', () => {
    const r = calcularCaneria({
      cables: [{ seccionMm2: 1.5, cantidad: 2 }],
      pe: [{ seccionMm2: 1.5, cantidad: 1 }],
      familia: 'curvable',
    })

    expect(r).not.toBeNull()
    // CSP 16 / CL 16 (98 y 102 mm²) quedan por debajo de los lisos de 16.
    expect(r!.cano.diametroNominalMm).toBeGreaterThanOrEqual(19)
  })

  it('un tramo de tablero principal a seccional exige al menos la medida 19/20', () => {
    const r = calcularCaneria({
      cables: [{ seccionMm2: 2.5, cantidad: 2 }],
      pe: [{ seccionMm2: 2.5, cantidad: 1 }],
      familia: 'metalica',
      esTableroPrincipalASeccional: true,
    })

    expect(r).not.toBeNull()
    // 770.7.1 p: mínimo R19 o R20 (3/4"). RS 16 queda descartado aunque la
    // tabla lo permita por cantidad de cables.
    expect(r!.cano.designacion).toBe('RS 19')
    expect(r!.cano.comercial).toBe('3/4"')
  })

  it('el mismo tramo en cañería rígida arranca en RP 20', () => {
    const r = calcularCaneria({
      cables: [{ seccionMm2: 2.5, cantidad: 2 }],
      pe: [{ seccionMm2: 2.5, cantidad: 1 }],
      familia: 'rigida',
      esTableroPrincipalASeccional: true,
    })

    expect(r).not.toBeNull()
    expect(r!.cano.designacion).toBe('RP 20')
  })
})

describe('hazDeCircuitos', () => {
  it('arma el haz sumando cables cargados y un PE por circuito', () => {
    const { cables, pe } = hazDeCircuitos([
      { seccionMm2: 2.5, cablesCargados: 2 },
      { seccionMm2: 2.5, cablesCargados: 2 },
      { seccionMm2: 1.5, cablesCargados: 2 },
    ])

    expect(cables).toEqual([
      { seccionMm2: 1.5, cantidad: 2 },
      { seccionMm2: 2.5, cantidad: 4 },
    ])
    expect(pe).toEqual([
      { seccionMm2: 1.5, cantidad: 1 },
      { seccionMm2: 2.5, cantidad: 2 },
    ])
  })

  it('para secciones de hasta 16 mm² el PE computa con la sección de fase', () => {
    const { pe } = hazDeCircuitos([{ seccionMm2: 10, cablesCargados: 2 }])
    expect(pe).toEqual([{ seccionMm2: 10, cantidad: 1 }])
  })

  it('por encima de 16 mm² el PE se computa como 16 mm²', () => {
    const { pe } = hazDeCircuitos([{ seccionMm2: 25, cablesCargados: 3 }])
    expect(pe).toEqual([{ seccionMm2: 16, cantidad: 1 }])
  })
})
