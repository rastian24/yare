import { describe, expect, it } from 'vitest'
import {
  bocasExigidas,
  exigenciaDeAmbiente,
  gradoDeSuperficie,
  superficieLimiteAplicacion,
  verificarMinimoCircuitos,
} from '@/normativa/aea770/electrificacion'
import type { Ambiente } from '@/dominio/tipos'

const amb = (over: Partial<Ambiente>): Ambiente => ({
  id: 'a1',
  nombre: 'Ambiente',
  tipo: 'estar',
  superficieM2: 0,
  ...over,
})

describe('Grado de electrificación (Tabla 770.7.I)', () => {
  it('reproduce los cuatro escalones', () => {
    expect(gradoDeSuperficie(45)).toBe('minimo')
    expect(gradoDeSuperficie(60)).toBe('minimo')
    expect(gradoDeSuperficie(60.1)).toBe('medio')
    expect(gradoDeSuperficie(130)).toBe('medio')
    expect(gradoDeSuperficie(130.1)).toBe('elevado')
    expect(gradoDeSuperficie(200)).toBe('elevado')
    expect(gradoDeSuperficie(200.1)).toBe('superior')
  })

  it('la superficie computa el 50 % de la semicubierta (770.7.3)', () => {
    const s = superficieLimiteAplicacion({
      superficieCubiertaM2: 100,
      superficieSemicubiertaM2: 40,
      ambientes: [],
    })
    expect(s).toBe(120)
    expect(gradoDeSuperficie(s)).toBe('medio')
  })

  it('una vivienda de 90 m² es grado medio', () => {
    expect(gradoDeSuperficie(90)).toBe('medio')
  })
})

describe('Número mínimo de circuitos (Tabla 770.7.II)', () => {
  it('grado medio exige 3 circuitos', () => {
    const r = verificarMinimoCircuitos('medio', { iug: 1, tug: 1, tue: 0 })
    expect(r.cumple).toBe(false)
    expect(r.totalRequerido).toBe(3)
  })

  it('grado medio se cumple con 2 IUG + 1 TUG', () => {
    expect(verificarMinimoCircuitos('medio', { iug: 2, tug: 1, tue: 0 }).cumple).toBe(true)
  })

  it('grado medio también se cumple con 1 IUG + 2 TUG (segunda variante)', () => {
    expect(verificarMinimoCircuitos('medio', { iug: 1, tug: 2, tue: 0 }).cumple).toBe(true)
  })

  it('grado mínimo exige 1 IUG y 1 TUG', () => {
    expect(verificarMinimoCircuitos('minimo', { iug: 1, tug: 1, tue: 0 }).cumple).toBe(true)
    expect(verificarMinimoCircuitos('minimo', { iug: 2, tug: 0, tue: 0 }).cumple).toBe(false)
  })

  it('grado elevado exige 5 circuitos', () => {
    expect(verificarMinimoCircuitos('elevado', { iug: 2, tug: 3, tue: 0 }).cumple).toBe(true)
    expect(verificarMinimoCircuitos('elevado', { iug: 2, tug: 2, tue: 0 }).cumple).toBe(false)
  })

  it('grado superior exige 6, con el sexto de libre elección', () => {
    // 2 IUG + 3 TUG cubre la variante, y el TUE hace de sexto circuito libre.
    expect(verificarMinimoCircuitos('superior', { iug: 2, tug: 3, tue: 1 }).cumple).toBe(true)
    // Sin el sexto circuito no alcanza aunque la mezcla IUG/TUG sea correcta.
    expect(verificarMinimoCircuitos('superior', { iug: 2, tug: 3, tue: 0 }).cumple).toBe(false)
  })

  it('informa cuántos circuitos faltan de cada tipo', () => {
    const r = verificarMinimoCircuitos('elevado', { iug: 1, tug: 1, tue: 0 })
    expect(r.faltanIUG).toBe(1)
    expect(r.faltanTUG).toBe(2)
  })
})

describe('Puntos mínimos de utilización (Tabla 770.7.III)', () => {
  it('dormitorio de menos de 10 m²: 1 IUG + 2 TUG', () => {
    const e = exigenciaDeAmbiente(amb({ tipo: 'dormitorio', superficieM2: 8 }), 'medio')
    expect(e).toEqual(
      expect.objectContaining({ iugRequeridas: 1, tugRequeridas: 2, modulosRequeridos: 0 }),
    )
  })

  it('dormitorio de 12 m²: 1 IUG + 3 TUG', () => {
    const e = exigenciaDeAmbiente(amb({ tipo: 'dormitorio', superficieM2: 12 }), 'medio')
    expect(e).toEqual(expect.objectContaining({ iugRequeridas: 1, tugRequeridas: 3 }))
  })

  it('dormitorio de más de 36 m² en grado elevado: 2 IUG + 3 TUG', () => {
    const e = exigenciaDeAmbiente(amb({ tipo: 'dormitorio', superficieM2: 40 }), 'elevado')
    expect(e).toEqual(expect.objectContaining({ iugRequeridas: 2, tugRequeridas: 3 }))
  })

  it('cocina grado medio: 2 IUG + 3 TUG + 2 módulos', () => {
    const e = exigenciaDeAmbiente(amb({ tipo: 'cocina', superficieM2: 9 }), 'medio')
    expect(e).toEqual(
      expect.objectContaining({ iugRequeridas: 2, tugRequeridas: 3, modulosRequeridos: 2 }),
    )
  })

  it('cocina grado mínimo: 1 IUG + 3 TUG + 2 módulos', () => {
    const e = exigenciaDeAmbiente(amb({ tipo: 'cocina', superficieM2: 6 }), 'minimo')
    expect(e).toEqual(
      expect.objectContaining({ iugRequeridas: 1, tugRequeridas: 3, modulosRequeridos: 2 }),
    )
  })

  it('cocina grado superior: 2 IUG + 4 TUG + 3 módulos', () => {
    const e = exigenciaDeAmbiente(amb({ tipo: 'cocina', superficieM2: 14 }), 'superior')
    expect(e).toEqual(
      expect.objectContaining({ iugRequeridas: 2, tugRequeridas: 4, modulosRequeridos: 3 }),
    )
  })

  it('baño: 1 IUG + 1 TUG en cualquier grado', () => {
    for (const grado of ['minimo', 'medio', 'elevado', 'superior'] as const) {
      const e = exigenciaDeAmbiente(amb({ tipo: 'bano', superficieM2: 4 }), grado)
      expect(e).toEqual(expect.objectContaining({ iugRequeridas: 1, tugRequeridas: 1 }))
    }
  })

  it('toilette no exige TUG: el toma se carga al circuito de iluminación (770.7.1 k)', () => {
    const e = exigenciaDeAmbiente(amb({ tipo: 'toilette', superficieM2: 2 }), 'medio')
    expect(e).toEqual(expect.objectContaining({ iugRequeridas: 1, tugRequeridas: 0 }))
  })

  it('lavadero sube a 2 TUG a partir del grado medio', () => {
    expect(exigenciaDeAmbiente(amb({ tipo: 'lavadero', superficieM2: 5 }), 'minimo')).toEqual(
      expect.objectContaining({ tugRequeridas: 1 }),
    )
    expect(exigenciaDeAmbiente(amb({ tipo: 'lavadero', superficieM2: 5 }), 'medio')).toEqual(
      expect.objectContaining({ tugRequeridas: 2 }),
    )
  })
})

describe('Exigencias por superficie y longitud', () => {
  it('estar: una boca de IUG cada 18 m² o fracción, mínimo una', () => {
    expect(bocasExigidas({ cadaM2: 18, minimo: 1 }, amb({ superficieM2: 10 }))).toBe(1)
    expect(bocasExigidas({ cadaM2: 18, minimo: 1 }, amb({ superficieM2: 18 }))).toBe(1)
    expect(bocasExigidas({ cadaM2: 18, minimo: 1 }, amb({ superficieM2: 19 }))).toBe(2)
    expect(bocasExigidas({ cadaM2: 18, minimo: 1 }, amb({ superficieM2: 36 }))).toBe(2)
  })

  it('estar: una boca de TUG cada 6 m² o fracción, mínimo dos', () => {
    expect(bocasExigidas({ cadaM2: 6, minimo: 2 }, amb({ superficieM2: 5 }))).toBe(2)
    expect(bocasExigidas({ cadaM2: 6, minimo: 2 }, amb({ superficieM2: 20 }))).toBe(4)
  })

  it('estar de 24 m² en grado medio: 2 IUG y 4 TUG', () => {
    const e = exigenciaDeAmbiente(amb({ tipo: 'estar', superficieM2: 24 }), 'medio')
    expect(e).toEqual(expect.objectContaining({ iugRequeridas: 2, tugRequeridas: 4 }))
  })

  it('pasillo: una boca cada 5 m o fracción', () => {
    const e = exigenciaDeAmbiente(
      amb({ tipo: 'pasillo', superficieM2: 6, longitudM: 7 }),
      'minimo',
    )
    expect(e).toEqual(expect.objectContaining({ iugRequeridas: 2 }))
  })

  it('pasillo corto en grado medio no exige boca (sólo para L > 2 m)', () => {
    const e = exigenciaDeAmbiente(
      amb({ tipo: 'pasillo', superficieM2: 2, longitudM: 1.5 }),
      'medio',
    )
    expect(e).toEqual(expect.objectContaining({ iugRequeridas: 0 }))
  })
})
