/**
 * Vivienda de prueba: unifamiliar de ~90 m², que cae en grado de
 * electrificación "Medio" y por lo tanto exige 3 circuitos.
 */

import { listaPreciosPorDefecto } from '@/dominio/computo/presupuesto'
import {
  ALTURAS_POR_DEFECTO,
  SUMINISTRO_POR_DEFECTO,
  type Ambiente,
  type Circuito,
  type Elemento,
  type Plano,
  type Proyecto,
  type Punto,
  type Tramo,
} from '@/dominio/tipos'

/** Plano raster calibrado: 1 unidad = 1 cm, o sea 100 px por metro. */
export function planoCalibrado(): Plano {
  return {
    id: 'plano-1',
    nombre: 'Planta',
    fuente: {
      tipo: 'raster',
      blobId: 'blob-1',
      anchoPx: 1200,
      altoPx: 900,
      calibracion: {
        p1: { x: 0, y: 0 },
        p2: { x: 100, y: 0 },
        metrosReales: 1,
      },
    },
  }
}

/** Plano raster sin calibrar: no debe producir longitudes. */
export function planoSinCalibrar(): Plano {
  const p = planoCalibrado()
  if (p.fuente.tipo === 'raster') p.fuente.calibracion = null
  return p
}

export const AMBIENTES: Ambiente[] = [
  { id: 'estar', nombre: 'Estar comedor', tipo: 'estar', superficieM2: 24 },
  { id: 'dorm1', nombre: 'Dormitorio 1', tipo: 'dormitorio', superficieM2: 12 },
  { id: 'dorm2', nombre: 'Dormitorio 2', tipo: 'dormitorio', superficieM2: 9 },
  { id: 'cocina', nombre: 'Cocina', tipo: 'cocina', superficieM2: 10 },
  { id: 'bano', nombre: 'Baño', tipo: 'bano', superficieM2: 4 },
  { id: 'lavadero', nombre: 'Lavadero', tipo: 'lavadero', superficieM2: 5 },
  { id: 'pasillo', nombre: 'Pasillo', tipo: 'pasillo', superficieM2: 6, longitudM: 6 },
]

/**
 * Cuatro circuitos: el grado Medio exige tres como mínimo, y la variante a) de
 * la Tabla 770.7.II (2 IUG + 1 TUG) se cumple con el cuarto de más.
 *
 * Hacen falta dos TUG porque la vivienda tiene 17 bocas de tomacorriente y el
 * máximo por circuito es 15 (Tabla 770.6.I).
 */
export const CIRCUITOS: Circuito[] = [
  { id: 'c-iug1', nombre: 'IUG 1', tipo: 'IUG', seccionMm2: 1.5, proteccionIn: 10 },
  { id: 'c-iug2', nombre: 'IUG 2', tipo: 'IUG', seccionMm2: 1.5, proteccionIn: 10 },
  { id: 'c-tug1', nombre: 'TUG 1', tipo: 'TUG', seccionMm2: 2.5, proteccionIn: 16 },
  { id: 'c-tug2', nombre: 'TUG 2', tipo: 'TUG', seccionMm2: 2.5, proteccionIn: 16 },
]

let contador = 0
const nuevoId = (p: string) => `${p}-${++contador}`

export function boca(
  simboloId: string,
  ambienteId: string,
  circuitoId: string,
  posicion: Punto,
): Elemento {
  return { id: nuevoId('el'), simboloId, planoId: 'plano-1', posicion, ambienteId, circuitoId }
}

/**
 * Arma un proyecto completo. Por defecto cumple los puntos mínimos de la
 * Tabla 770.7.III para el grado Medio.
 */
export function proyectoBase(over: Partial<Proyecto> = {}): Proyecto {
  contador = 0

  const elementos: Elemento[] = [
    { id: 'tablero', simboloId: 'tablero_principal', planoId: 'plano-1', posicion: { x: 0, y: 0 } },
    { id: 'jabalina', simboloId: 'jabalina', planoId: 'plano-1', posicion: { x: -50, y: 0 } },
  ]

  // Estar 24 m²: 2 IUG (1 cada 18 m²) y 4 TUG (1 cada 6 m², mínimo 2)
  elementos.push(boca('luz_techo', 'estar', 'c-iug1', { x: 200, y: 100 }))
  elementos.push(boca('luz_techo', 'estar', 'c-iug1', { x: 400, y: 100 }))
  for (let i = 0; i < 4; i++) {
    elementos.push(boca('toma_10a', 'estar', 'c-tug1', { x: 200 + i * 100, y: 200 }))
  }

  // Dormitorio 1 (12 m²): 1 IUG + 3 TUG
  elementos.push(boca('luz_techo', 'dorm1', 'c-iug1', { x: 600, y: 100 }))
  for (let i = 0; i < 3; i++) {
    elementos.push(boca('toma_10a', 'dorm1', 'c-tug1', { x: 600 + i * 60, y: 200 }))
  }

  // Dormitorio 2 (9 m², menos de 10): 1 IUG + 2 TUG
  elementos.push(boca('luz_techo', 'dorm2', 'c-iug2', { x: 800, y: 100 }))
  for (let i = 0; i < 2; i++) {
    elementos.push(boca('toma_10a', 'dorm2', 'c-tug1', { x: 800 + i * 60, y: 200 }))
  }

  // Cocina grado Medio: 2 IUG + 3 TUG + 2 módulos
  elementos.push(boca('luz_techo', 'cocina', 'c-iug2', { x: 1000, y: 100 }))
  elementos.push(boca('luz_techo', 'cocina', 'c-iug2', { x: 1060, y: 100 }))
  for (let i = 0; i < 3; i++) {
    elementos.push(boca('toma_mesada', 'cocina', 'c-tug2', { x: 1000 + i * 50, y: 200 }))
  }
  elementos.push(boca('toma_fijo', 'cocina', 'c-tug2', { x: 1000, y: 250 }))
  elementos.push(boca('toma_fijo', 'cocina', 'c-tug2', { x: 1050, y: 250 }))

  // Baño: 1 IUG + 1 TUG
  elementos.push(boca('luz_techo', 'bano', 'c-iug2', { x: 1150, y: 100 }))
  elementos.push(boca('toma_10a', 'bano', 'c-tug2', { x: 1150, y: 200 }))

  // Lavadero grado Medio: 1 IUG + 2 TUG
  elementos.push(boca('luz_techo', 'lavadero', 'c-iug2', { x: 1250, y: 100 }))
  for (let i = 0; i < 2; i++) {
    elementos.push(boca('toma_10a', 'lavadero', 'c-tug2', { x: 1250 + i * 50, y: 200 }))
  }

  // Pasillo de 6 m: 2 IUG (una cada 5 m o fracción)
  elementos.push(boca('luz_techo', 'pasillo', 'c-iug1', { x: 500, y: 400 }))
  elementos.push(boca('luz_techo', 'pasillo', 'c-iug1', { x: 700, y: 400 }))

  return {
    id: 'proy-1',
    nombre: 'Vivienda de prueba',
    creadoEn: '2026-01-01',
    actualizadoEn: '2026-01-01',
    inmueble: {
      superficieCubiertaM2: 90,
      superficieSemicubiertaM2: 0,
      ambientes: AMBIENTES,
    },
    suministro: { ...SUMINISTRO_POR_DEFECTO },
    alturas: { ...ALTURAS_POR_DEFECTO },
    planos: [planoCalibrado()],
    elementos,
    tramos: [],
    circuitos: CIRCUITOS.map((c) => ({ ...c })),
    precios: listaPreciosPorDefecto(),
    ...over,
  }
}

/**
 * Tramo entre el tablero y un elemento, de la longitud en planta indicada.
 * Con la calibración de 100 px por metro, `metrosEnPlanta` × 100 da los píxeles.
 */
export function tramoHasta(
  id: string,
  elementoIds: string[],
  metrosEnPlanta: number,
  tipoCano = 'RP 20',
): Tramo {
  return {
    id,
    planoId: 'plano-1',
    puntos: [
      { x: 0, y: 0 },
      { x: metrosEnPlanta * 100, y: 0 },
    ],
    tipoCano,
    nivel: 'losa',
    elementoIds,
  }
}
