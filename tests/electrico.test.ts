import { describe, expect, it } from 'vitest'
import {
  caidaTensionPorTabla,
  coeficienteSimultaneidad,
  corrienteAdmisible,
  corrienteProyecto,
  desequilibrioPct,
  dpmsCircuito,
  elegirProteccion,
  factorAgrupamiento,
  seccionPAT,
  seccionPE,
  seccionPorCaidaTension,
} from '@/dominio/calculo/electrico'

describe('DPMS (Tabla 770.8.I)', () => {
  it('IUG sin tomas derivados: ⅔ de las bocas a 60 VA', () => {
    // 12 bocas × 60 VA = 720 VA; ⅔ → 480 VA
    expect(dpmsCircuito({ tipo: 'IUG', bocas: 12 })).toBeCloseTo(480, 5)
  })

  it('IUG con tomas derivados: 2 200 VA fijos', () => {
    expect(dpmsCircuito({ tipo: 'IUG', bocas: 12, conTomasDerivados: true })).toBe(2200)
  })

  it('TUG: 2 200 VA por circuito', () => {
    expect(dpmsCircuito({ tipo: 'TUG', bocas: 6 })).toBe(2200)
  })

  it('TUE: 3 300 VA por circuito', () => {
    expect(dpmsCircuito({ tipo: 'TUE', bocas: 2 })).toBe(3300)
  })

  it('si la carga declarada supera el mínimo, manda la declarada', () => {
    // Nota de la Tabla 770.8.I: los valores son mínimos; si los consumos son
    // conocidos y mayores, se calcula con los mayores.
    expect(dpmsCircuito({ tipo: 'TUG', bocas: 10, cargaDeclaradaVA: 3000 })).toBe(3000)
    expect(dpmsCircuito({ tipo: 'TUG', bocas: 10, cargaDeclaradaVA: 1000 })).toBe(2200)
  })
})

describe('Coeficientes de simultaneidad (Tabla 770.8.II)', () => {
  it('reproduce los cuatro escalones de la tabla', () => {
    expect(coeficienteSimultaneidad(2)).toBe(1)
    expect(coeficienteSimultaneidad(3)).toBe(0.8)
    expect(coeficienteSimultaneidad(5)).toBe(0.7)
    expect(coeficienteSimultaneidad(6)).toBe(0.6)
  })

  it('para valores intermedios toma el escalón inferior', () => {
    expect(coeficienteSimultaneidad(4)).toBe(0.8)
  })

  it('por encima de 6 se mantiene en 0,6', () => {
    expect(coeficienteSimultaneidad(9)).toBe(0.6)
  })
})

describe('Corriente de proyecto y admisible', () => {
  it('un TUG de 2 200 VA en 220 V da 10 A', () => {
    expect(corrienteProyecto(2200, 'monofasica', 220)).toBeCloseTo(10, 5)
  })

  it('trifásico divide por √3·380', () => {
    expect(corrienteProyecto(7000, 'trifasica', 380)).toBeCloseTo(7000 / (Math.sqrt(3) * 380), 5)
  })

  it('2,5 mm² monofásico admite 21 A (columna 2x de la Tabla 770.12.I)', () => {
    expect(corrienteAdmisible(2.5, 'monofasica')).toBe(21)
  })

  it('2,5 mm² trifásico admite 18 A (columna 3x)', () => {
    expect(corrienteAdmisible(2.5, 'trifasica')).toBe(18)
  })
})

describe('Factor de agrupamiento (Tabla 770.12.II)', () => {
  it('un solo circuito no lleva corrección', () => {
    expect(factorAgrupamiento(1, 'monofasica')).toBe(1)
  })

  it('dos circuitos monofásicos: 0,80', () => {
    expect(factorAgrupamiento(2, 'monofasica')).toBe(0.8)
  })

  it('tres circuitos monofásicos: 0,70', () => {
    expect(factorAgrupamiento(3, 'monofasica')).toBe(0.7)
  })

  it('por encima de tres se mantiene el más desfavorable de la tabla', () => {
    expect(factorAgrupamiento(5, 'monofasica')).toBe(0.7)
  })

  /**
   * El caso que motiva la alerta por cantidad de equipos: un TUE de 3 300 VA
   * son 15 A, que en 2,5 mm² aislado entran (21 A) pero agrupado con otros dos
   * circuitos ya no (21 × 0,70 = 14,7 A).
   */
  it('tres circuitos agrupados dejan 2,5 mm² por debajo de un TUE', () => {
    const ib = corrienteProyecto(3300, 'monofasica', 220)
    expect(ib).toBeCloseTo(15, 5)

    expect(corrienteAdmisible(2.5, 'monofasica', 1)).toBeGreaterThan(ib)
    expect(corrienteAdmisible(2.5, 'monofasica', 3)).toBeCloseTo(14.7, 5)
    expect(corrienteAdmisible(2.5, 'monofasica', 3)).toBeLessThan(ib)
  })
})

describe('Coordinación cable/protección (770.15.3)', () => {
  it('elige el calibre que cumple Ib ≤ In ≤ Iz', () => {
    // TUG: Ib = 10 A, 2,5 mm² → Iz = 21 A, tope de 20 A por Tabla 770.6.I
    expect(elegirProteccion(10, 21, 20)).toBe(10)
  })

  it('respeta el tope del tipo de circuito', () => {
    // Un IUG no puede llevar más de 16 A aunque el cable admita más.
    expect(elegirProteccion(18, 36, 16)).toBeNull()
  })

  it('devuelve null si ningún calibre entra en la ventana', () => {
    // Ib por encima de Iz: el cable no alcanza, hay que subir sección.
    expect(elegirProteccion(25, 21, 32)).toBeNull()
  })
})

describe('Caída de tensión (770.15.6, Tabla 770.15.IV)', () => {
  /**
   * La alerta por distancia. 2,5 mm² a 15 A:
   *   20 m → 15 V/A·km × 15 A × 0,020 km = 4,50 V = 2,05 % → pasa
   *   30 m → 15 × 15 × 0,030          = 6,75 V = 3,07 % → no pasa
   */
  it('2,5 mm² con 15 A a 20 m queda en 2,05 %', () => {
    const r = caidaTensionPorTabla({
      seccionMm2: 2.5,
      corrienteA: 15,
      longitudM: 20,
      tensionV: 220,
      fases: 'monofasica',
    })

    expect(r.caidaV).toBeCloseTo(4.5, 5)
    expect(r.caidaPct).toBeCloseTo(2.045, 2)
    expect(r.caidaPct).toBeLessThanOrEqual(3)
  })

  it('el mismo circuito a 30 m supera el 3 %', () => {
    const r = caidaTensionPorTabla({
      seccionMm2: 2.5,
      corrienteA: 15,
      longitudM: 30,
      tensionV: 220,
      fases: 'monofasica',
    })

    expect(r.caidaV).toBeCloseTo(6.75, 5)
    expect(r.caidaPct).toBeCloseTo(3.068, 2)
    expect(r.caidaPct).toBeGreaterThan(3)
  })

  it('subir a 4 mm² devuelve el circuito de 30 m dentro del límite', () => {
    const s = seccionPorCaidaTension(
      { corrienteA: 15, longitudM: 30, tensionV: 220, fases: 'monofasica' },
      3,
      2.5,
    )
    expect(s).toBe(4)

    const r = caidaTensionPorTabla({
      seccionMm2: 4,
      corrienteA: 15,
      longitudM: 30,
      tensionV: 220,
      fases: 'monofasica',
    })
    expect(r.caidaPct).toBeLessThanOrEqual(3)
  })
})

describe('Conductor de protección (Tabla 770.14.I)', () => {
  it('para S ≤ 16 el PE iguala la sección de fase', () => {
    expect(seccionPE(4)).toBe(4)
    expect(seccionPE(16)).toBe(16)
  })

  it('entre 16 y 35 el PE queda en 16 mm²', () => {
    expect(seccionPE(25)).toBe(16)
    expect(seccionPE(35)).toBe(16)
  })

  it('por encima de 35 el PE es la mitad de la fase', () => {
    expect(seccionPE(50)).toBe(25)
  })

  it('el PE nunca baja de 2,5 mm² (770.14.4.5)', () => {
    expect(seccionPE(1.5)).toBe(2.5)
    expect(seccionPE(1)).toBe(2.5)
  })

  it('el cable de puesta a tierra nunca baja de 4 mm²', () => {
    expect(seccionPAT(1.5)).toBe(4)
    expect(seccionPAT(2.5)).toBe(4)
    expect(seccionPAT(10)).toBe(10)
  })
})

describe('Desequilibrio entre fases (770.8.3.4)', () => {
  it('un sistema equilibrado da 0 %', () => {
    expect(desequilibrioPct([2200, 2200, 2200])).toBe(0)
  })

  it('detecta un desequilibrio por encima del 30 %', () => {
    expect(desequilibrioPct([3300, 2200, 2200])).toBeCloseTo(33.33, 1)
  })
})
