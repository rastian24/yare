/**
 * Test de integración: una vivienda de 90 m² recorrida de punta a punta, desde
 * la superficie hasta el presupuesto.
 */

import { describe, expect, it } from 'vitest'
import { calcularProyecto } from '@/dominio/calculo/proyecto'
import { validar } from '@/normativa/aea770/motor'
import { computarMateriales } from '@/dominio/computo/materiales'
import { calcularPresupuesto, computarManoObra } from '@/dominio/computo/presupuesto'
import { longitudTramo } from '@/dominio/calculo/longitudes'
import { proyectoBase, planoSinCalibrar, tramoHasta } from './fixtures/proyecto'
import { ALTURAS_POR_DEFECTO } from '@/dominio/tipos'

describe('Vivienda de 90 m² — cadena normativa completa', () => {
  it('deriva grado Medio y exige 3 circuitos', () => {
    const c = calcularProyecto(proyectoBase())

    expect(c.superficieM2).toBe(90)
    expect(c.grado).toBe('medio')
    expect(c.minimoCircuitos.totalRequerido).toBe(3)
    expect(c.minimoCircuitos.cumple).toBe(true)
  })

  it('cumple los puntos mínimos de todos los ambientes', () => {
    const r = validar(calcularProyecto(proyectoBase()))
    const faltantes = r.hallazgos.filter((h) => h.clausula === '770.7.5')

    expect(faltantes).toEqual([])
  })

  it('detecta cuando falta una boca en un ambiente', () => {
    const p = proyectoBase()
    // Se quita una de las tres bocas de TUG del dormitorio 1.
    const i = p.elementos.findIndex((e) => e.ambienteId === 'dorm1' && e.simboloId === 'toma_10a')
    p.elementos.splice(i, 1)

    const r = validar(calcularProyecto(p))
    const h = r.hallazgos.find((x) => x.clausula === '770.7.5' && x.mensaje.includes('Dormitorio 1'))

    expect(h).toBeDefined()
    expect(h!.severidad).toBe('error')
    expect(h!.mensaje).toContain('Requeridas 3, colocadas 2')
  })

  it('calcula la DPMS de cada circuito según la Tabla 770.8.I', () => {
    const c = calcularProyecto(proyectoBase())

    // Los IUG sin tomas derivados van por ⅔ × bocas × 60 VA.
    const iug1 = c.circuitos.find((x) => x.circuito.id === 'c-iug1')!
    expect(iug1.bocas).toBe(5) // 2 estar + 1 dorm1 + 2 pasillo
    expect(iug1.dpmsVA).toBeCloseTo((2 / 3) * 5 * 60, 5)

    // El TUG tiene el valor fijo de 2 200 VA por circuito.
    const tug = c.circuitos.find((x) => x.circuito.id === 'c-tug1')!
    expect(tug.dpmsVA).toBe(2200)
    expect(tug.ibA).toBeCloseTo(10, 5)
  })

  it('aplica el coeficiente de simultaneidad del escalón que corresponde', () => {
    const c = calcularProyecto(proyectoBase())

    // Cuatro circuitos: la Tabla 770.8.II sólo lista 2, 3, 5 y 6, así que se
    // toma el escalón inferior, que es el conservador.
    expect(c.proyecto.circuitos).toHaveLength(4)
    expect(c.coefSimultaneidad).toBe(0.8)
    expect(c.cargaTotalVA).toBeCloseTo(c.dpmsTotalVA * 0.8, 5)
  })
})

describe('Alerta por cantidad de bocas (770.6.6)', () => {
  it('avisa cuando un circuito pasa de 15 bocas', () => {
    const p = proyectoBase()
    const actuales = calcularProyecto(p).circuitos.find((x) => x.circuito.id === 'c-tug1')!.bocas

    for (let i = 0; i < 16 - actuales; i++) {
      p.elementos.push({
        id: `extra-${i}`,
        simboloId: 'toma_10a',
        planoId: 'plano-1',
        posicion: { x: 100 + i * 20, y: 500 },
        ambienteId: 'estar',
        circuitoId: 'c-tug1',
      })
    }

    const c = calcularProyecto(p)
    const tug = c.circuitos.find((x) => x.circuito.id === 'c-tug1')!
    expect(tug.bocas).toBe(16)

    const r = validar(c)
    const h = r.hallazgos.find((x) => x.id === 'bocas-max-c-tug1')
    expect(h).toBeDefined()
    expect(h!.severidad).toBe('error')
    expect(h!.mensaje).toContain('máximo para un circuito TUG es 15')
  })

  it('los interruptores de efecto no cuentan como boca (Nota 1 de 770.6.6)', () => {
    const p = proyectoBase()
    const antes = calcularProyecto(p).circuitos.find((x) => x.circuito.id === 'c-iug1')!.bocas

    for (let i = 0; i < 5; i++) {
      p.elementos.push({
        id: `llave-${i}`,
        simboloId: 'llave_unipolar',
        planoId: 'plano-1',
        posicion: { x: 100 + i * 20, y: 600 },
        ambienteId: 'estar',
        circuitoId: 'c-iug1',
      })
    }

    const despues = calcularProyecto(p).circuitos.find((x) => x.circuito.id === 'c-iug1')!.bocas
    expect(despues).toBe(antes)
  })
})

describe('Alerta por distancia (770.15.6)', () => {
  it('un TUG de 2,5 mm² a 20 m queda dentro del 3 %', () => {
    const p = proyectoBase()
    const bocaLejana = p.elementos.find((e) => e.circuitoId === 'c-tug1')!
    p.tramos = [tramoHasta('t1', ['tablero', bocaLejana.id], 20)]

    const c = calcularProyecto(p)
    const tug = c.circuitos.find((x) => x.circuito.id === 'c-tug1')!

    // 20 m en planta, más las verticales respecto del tramo por losa (2,60 m):
    // el tablero está a 1,60 m (sube 1,00) y la boca a 0,25 m (baja 2,35).
    expect(tug.longitudM).toBeCloseTo(20 + 1.0 + 2.35, 2)
    expect(tug.caidaPct).not.toBeNull()
    expect(tug.caidaPct!).toBeLessThan(3)

    expect(validar(c).hallazgos.find((h) => h.id === 'caida-c-tug1')).toBeUndefined()
  })

  it('el mismo circuito a 45 m supera el 3 % y sugiere subir de sección', () => {
    const p = proyectoBase()
    const bocaLejana = p.elementos.find((e) => e.circuitoId === 'c-tug1')!
    p.tramos = [tramoHasta('t1', ['tablero', bocaLejana.id], 45)]

    const c = calcularProyecto(p)
    const tug = c.circuitos.find((x) => x.circuito.id === 'c-tug1')!
    expect(tug.caidaPct!).toBeGreaterThan(3)

    const h = validar(c).hallazgos.find((x) => x.id === 'caida-c-tug1')
    expect(h).toBeDefined()
    expect(h!.severidad).toBe('error')
    expect(h!.clausula).toBe('770.15.6')
    expect(h!.sugerencia).toContain('4 mm²')
  })

  it('sin calibrar el plano no inventa longitudes: avisa', () => {
    const p = proyectoBase({ planos: [planoSinCalibrar()] })
    p.tramos = [tramoHasta('t1', ['tablero', p.elementos[2]!.id], 30)]

    const c = calcularProyecto(p)
    expect(c.escala!.calibrado).toBe(false)
    expect(c.circuitos.every((x) => x.longitudM === null)).toBe(true)

    const r = validar(c)
    expect(r.hallazgos.find((h) => h.id === 'sin-calibrar')).toBeDefined()
    // Y no reporta caídas de tensión fantasma.
    expect(r.hallazgos.filter((h) => h.id.startsWith('caida-'))).toEqual([])
  })
})

describe('Longitud 3D: planta más tramos verticales', () => {
  it('suma las bajadas de una boca de techo a una llave de pared', () => {
    const p = proyectoBase()
    p.elementos.push(
      { id: 'techo', simboloId: 'luz_techo', planoId: 'plano-1', posicion: { x: 0, y: 0 } },
      { id: 'llave', simboloId: 'llave_unipolar', planoId: 'plano-1', posicion: { x: 400, y: 0 } },
    )

    const tramo = tramoHasta('t-vert', ['techo', 'llave'], 4)
    const l = longitudTramo(tramo, p.planos[0]!, p.elementos, {
      ...ALTURAS_POR_DEFECTO,
    })

    expect(l).not.toBeNull()
    // La boca de techo está a la altura del tramo (losa, 2,6 m) y no baja nada;
    // la llave está a 1,20 m, así que baja 1,40 m.
    expect(l!.plantaM).toBeCloseTo(4, 5)
    expect(l!.verticalM).toBeCloseTo(1.4, 5)
    expect(l!.totalM).toBeCloseTo(5.4, 5)
  })

  it('una longitud manual pisa lo calculado', () => {
    const p = proyectoBase()
    const tramo = { ...tramoHasta('t1', ['tablero'], 10), longitudManualM: 7.5 }
    const l = longitudTramo(tramo, p.planos[0]!, p.elementos, ALTURAS_POR_DEFECTO)

    expect(l!.totalM).toBe(7.5)
  })
})

describe('Agrupamiento en cañería (Tabla 770.12.II)', () => {
  it('tres circuitos en la misma cañería reducen la corriente admisible', () => {
    const p = proyectoBase()
    const unaDeCada = ['c-iug1', 'c-iug2', 'c-tug1'].map(
      (cid) => p.elementos.find((e) => e.circuitoId === cid)!.id,
    )
    p.tramos = [tramoHasta('t-comun', ['tablero', ...unaDeCada], 10)]

    const c = calcularProyecto(p)
    const tug = c.circuitos.find((x) => x.circuito.id === 'c-tug1')!

    expect(tug.factorAgrupamiento).toBe(0.7)
    // 2,5 mm² monofásico: 21 A × 0,70 = 14,7 A
    expect(tug.izA).toBeCloseTo(14.7, 5)
    // Con Ib = 10 A todavía entra, pero con poco margen.
    expect(tug.ibA).toBeLessThan(tug.izA)
  })

  it('un TUE de 3 300 VA en 2,5 mm² agrupado dispara la alerta', () => {
    const p = proyectoBase()
    p.circuitos.push({
      id: 'c-tue',
      nombre: 'TUE 1',
      tipo: 'TUE',
      seccionMm2: 2.5,
      proteccionIn: 20,
    })
    p.elementos.push({
      id: 'toma-tue',
      simboloId: 'toma_20a',
      planoId: 'plano-1',
      posicion: { x: 900, y: 300 },
      ambienteId: 'cocina',
      circuitoId: 'c-tue',
    })

    const otros = ['c-iug1', 'c-tug1'].map(
      (cid) => p.elementos.find((e) => e.circuitoId === cid)!.id,
    )
    p.tramos = [tramoHasta('t-comun', ['tablero', 'toma-tue', ...otros], 8)]

    const c = calcularProyecto(p)
    const tue = c.circuitos.find((x) => x.circuito.id === 'c-tue')!

    expect(tue.ibA).toBeCloseTo(15, 5)
    expect(tue.izA).toBeCloseTo(14.7, 5)

    const h = validar(c).hallazgos.find((x) => x.id === 'iz-insuficiente-c-tue')
    expect(h).toBeDefined()
    expect(h!.mensaje).toContain('factor de agrupamiento')
    expect(h!.sugerencia).toContain('4 mm²')
  })

  it('sube el diámetro de cañería recomendado al agregar circuitos', () => {
    const p = proyectoBase()

    const soloUno = calcularProyecto({
      ...p,
      tramos: [tramoHasta('t', ['tablero', p.elementos.find((e) => e.circuitoId === 'c-tug1')!.id], 5)],
    })

    const tresCircuitos = calcularProyecto({
      ...p,
      tramos: [
        tramoHasta(
          't',
          ['tablero', ...['c-iug1', 'c-iug2', 'c-tug1'].map((cid) => p.elementos.find((e) => e.circuitoId === cid)!.id)],
          5,
        ),
      ],
    })

    const uno = soloUno.tramos[0]!.caneria!
    const tres = tresCircuitos.tramos[0]!.caneria!

    expect(tres.cano.seccionInternaMm2).toBeGreaterThan(uno.cano.seccionInternaMm2)
    expect(tres.ocupacionPct).toBeLessThanOrEqual(35)
  })
})

describe('Cómputo de materiales (770-A.1.4)', () => {
  it('computa cable, caños, cajas, módulos, tablero y puesta a tierra', () => {
    const p = proyectoBase()
    p.tramos = [
      tramoHasta('t1', ['tablero', p.elementos.find((e) => e.circuitoId === 'c-tug1')!.id], 12),
    ]

    const materiales = computarMateriales(calcularProyecto(p))
    const categorias = new Set(materiales.map((m) => m.categoria))

    expect(categorias).toContain('cable')
    expect(categorias).toContain('cano')
    expect(categorias).toContain('caja')
    expect(categorias).toContain('modulo')
    expect(categorias).toContain('tablero')
    expect(categorias).toContain('pat')
  })

  it('incluye el diferencial de 30 mA, que es obligatorio (770.14.2)', () => {
    const materiales = computarMateriales(calcularProyecto(proyectoBase()))
    const dif = materiales.find((m) => m.id === 'diferencial')

    expect(dif).toBeDefined()
    expect(dif!.descripcion).toContain('30 mA')
    expect(dif!.clausula).toBe('770.14.2')
  })

  it('una térmica por circuito', () => {
    const p = proyectoBase()
    const materiales = computarMateriales(calcularProyecto(p))
    const termicas = materiales.filter((m) => m.id.startsWith('termica-'))

    expect(termicas.reduce((n, t) => n + t.cantidad, 0)).toBe(p.circuitos.length)
  })

  it('redondea la cañería a barras de 3 m', () => {
    const p = proyectoBase()
    p.tramos = [
      tramoHasta('t1', ['tablero', p.elementos.find((e) => e.circuitoId === 'c-tug1')!.id], 10),
    ]

    const materiales = computarMateriales(calcularProyecto(p))
    const cano = materiales.find((m) => m.categoria === 'cano')!

    expect(cano.unidad).toBe('barra')
    expect(Number.isInteger(cano.cantidad)).toBe(true)
    expect(cano.detalle).toContain('barras de 3 m')
  })

  it('sin tramos no computa cable ni caño, pero sí el tablero', () => {
    const materiales = computarMateriales(calcularProyecto(proyectoBase()))

    expect(materiales.filter((m) => m.categoria === 'cano')).toEqual([])
    expect(materiales.filter((m) => m.categoria === 'tablero').length).toBeGreaterThan(0)
  })
})

describe('Presupuesto', () => {
  it('separa materiales de mano de obra y cotiza la mano de obra por boca', () => {
    const p = proyectoBase()
    p.tramos = [
      tramoHasta('t1', ['tablero', p.elementos.find((e) => e.circuitoId === 'c-tug1')!.id], 15),
    ]

    const presupuesto = calcularPresupuesto(calcularProyecto(p))

    expect(presupuesto.subtotalMaterialesARS).toBeGreaterThan(0)
    expect(presupuesto.subtotalManoObraARS).toBeGreaterThan(0)

    const bocasIUG = presupuesto.manoDeObra.find((l) => l.id === 'mo_boca_iug')
    expect(bocasIUG).toBeDefined()
    expect(bocasIUG!.unidad).toBe('boca')
  })

  it('cuenta las bocas de mano de obra por tipo de circuito', () => {
    const mo = computarManoObra(calcularProyecto(proyectoBase()))

    // 10 bocas de iluminación (2 estar, 1 dorm1, 1 dorm2, 2 cocina, 1 baño,
    // 1 lavadero, 2 pasillo) y 17 de tomacorriente, repartidas en dos TUG.
    expect(mo.bocasIUG).toBe(10)
    expect(mo.bocasTUG).toBe(17)
    expect(mo.tableros).toBe(1)
    expect(mo.puestasTierra).toBe(1)
  })

  it('aplica gastos generales, beneficio e IVA en orden', () => {
    const p = proyectoBase()
    const presupuesto = calcularPresupuesto(calcularProyecto(p))

    const esperadoNeto =
      presupuesto.subtotalARS +
      presupuesto.ayudaGremioARS +
      presupuesto.gastosGeneralesARS +
      presupuesto.beneficioARS

    expect(presupuesto.netoARS).toBeCloseTo(esperadoNeto, 5)
    expect(presupuesto.ivaARS).toBeCloseTo(esperadoNeto * 0.21, 5)
    expect(presupuesto.totalARS).toBeCloseTo(esperadoNeto * 1.21, 5)
  })

  it('marca los ítems sin precio en lugar de contarlos como cero en silencio', () => {
    const p = proyectoBase()
    p.precios.items = p.precios.items.filter((i) => i.id !== 'diferencial')

    const presupuesto = calcularPresupuesto(calcularProyecto(p))

    expect(presupuesto.itemsSinPrecio.length).toBeGreaterThan(0)
    expect(presupuesto.materiales.find((l) => l.id === 'diferencial')!.sinPrecio).toBe(true)
  })

  it('lleva la fecha de actualización de la lista de precios', () => {
    const presupuesto = calcularPresupuesto(calcularProyecto(proyectoBase()))
    expect(presupuesto.actualizadaEn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('Otras reglas sobre el proyecto completo', () => {
  it('exige toma de tierra', () => {
    const p = proyectoBase()
    p.elementos = p.elementos.filter((e) => e.simboloId !== 'jabalina')

    const h = validar(calcularProyecto(p)).hallazgos.find((x) => x.id === 'pat-faltante')
    expect(h).toBeDefined()
    expect(h!.severidad).toBe('error')
  })

  it('recomienda trifásica cuando la carga supera los 7 kVA', () => {
    const p = proyectoBase()
    for (let i = 0; i < 4; i++) {
      p.circuitos.push({
        id: `c-tue-${i}`,
        nombre: `TUE ${i}`,
        tipo: 'TUE',
        seccionMm2: 4,
        proteccionIn: 25,
      })
    }

    const c = calcularProyecto(p)
    const h = validar(c).hallazgos.find((x) => x.id === 'recomendar-trifasico')

    expect(h).toBeDefined()
    expect(h!.clausula).toBe('770.8.3.3')
  })

  it('el proyecto base no tiene errores normativos', () => {
    const p = proyectoBase()
    p.tramos = [
      tramoHasta('t1', ['tablero', p.elementos.find((e) => e.circuitoId === 'c-tug1')!.id], 12),
    ]

    const r = validar(calcularProyecto(p))
    const errores = r.hallazgos.filter((h) => h.severidad === 'error')

    expect(errores).toEqual([])
    expect(r.conforme).toBe(true)
  })
})
