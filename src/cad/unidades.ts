/**
 * Unidades de dibujo de un DXF.
 *
 * La escala sale del archivo cuando $INSUNITS está definido, y ahí no hace
 * falta calibrar nada: las coordenadas del modelo ya son medidas reales.
 *
 * Cuando viene sin definir ($INSUNITS = 0, que es frecuente), la app NO
 * adivina en silencio: propone la unidad más plausible por el tamaño del
 * dibujo y deja que el usuario confirme, o que calibre a mano como en una foto.
 */

import type { BBox, UnidadDXF } from '@/dominio/tipos'

/** Códigos del grupo 70 de $INSUNITS que tienen sentido en arquitectura. */
const CODIGOS: Record<number, UnidadDXF> = {
  0: 'sin_definir',
  1: 'pulgadas',
  2: 'pies',
  4: 'mm',
  5: 'cm',
  6: 'm',
}

export const METROS_POR_UNIDAD: Record<Exclude<UnidadDXF, 'sin_definir'>, number> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  pulgadas: 0.0254,
  pies: 0.3048,
}

export const NOMBRE_UNIDAD: Record<UnidadDXF, string> = {
  sin_definir: 'sin definir',
  mm: 'milímetros',
  cm: 'centímetros',
  m: 'metros',
  pulgadas: 'pulgadas',
  pies: 'pies',
}

export function unidadDeCodigo(codigo: number | undefined): UnidadDXF {
  if (codigo === undefined) return 'sin_definir'
  return CODIGOS[codigo] ?? 'sin_definir'
}

/**
 * Rango de dimensiones plausibles para una vivienda unifamiliar, en metros.
 *
 * El dominio de la Sección 770 son viviendas unifamiliares hasta 63 A, así que
 * un plano que mida 2 m o 5 km de lado casi seguro tiene la unidad equivocada.
 * El rango es holgado a propósito: sirve para descartar errores de orden de
 * magnitud, no para validar el proyecto.
 */
export const DIMENSION_PLAUSIBLE_M = { min: 3, max: 200 }

export interface DiagnosticoUnidad {
  unidad: UnidadDXF
  /** Dimensión mayor del dibujo con esta unidad, en metros. */
  dimensionMayorM: number
  plausible: boolean
}

/** Dimensión mayor de la bbox, en unidades de dibujo. */
export function dimensionMayor(bbox: BBox): number {
  return Math.max(bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y)
}

/**
 * Evalúa cada unidad posible contra el tamaño del dibujo, para poder decirle al
 * usuario "el plano mide 12 400 unidades: si fueran mm son 12,4 m, que tiene
 * sentido; si fueran metros son 12,4 km, que no".
 */
export function diagnosticarUnidades(bbox: BBox): DiagnosticoUnidad[] {
  const mayor = dimensionMayor(bbox)

  return (Object.keys(METROS_POR_UNIDAD) as Array<Exclude<UnidadDXF, 'sin_definir'>>).map(
    (unidad) => {
      const dimensionMayorM = mayor * METROS_POR_UNIDAD[unidad]
      return {
        unidad,
        dimensionMayorM,
        plausible:
          dimensionMayorM >= DIMENSION_PLAUSIBLE_M.min &&
          dimensionMayorM <= DIMENSION_PLAUSIBLE_M.max,
      }
    },
  )
}

/**
 * Unidad más probable para un dibujo sin $INSUNITS.
 *
 * Devuelve `null` si ninguna resulta plausible, en cuyo caso hay que calibrar
 * a mano: es preferible pedir el dato a inventarlo.
 */
export function unidadMasProbable(bbox: BBox): UnidadDXF | null {
  const plausibles = diagnosticarUnidades(bbox).filter((d) => d.plausible)
  if (plausibles.length === 0) return null

  // Entre varias plausibles, la que deja el dibujo más cerca de una vivienda
  // típica (del orden de 10-15 m de lado).
  const referencia = 12
  plausibles.sort(
    (a, b) => Math.abs(a.dimensionMayorM - referencia) - Math.abs(b.dimensionMayorM - referencia),
  )
  return plausibles[0]!.unidad
}

/**
 * ¿La unidad declarada da un tamaño de vivienda razonable?
 *
 * Un DXF puede declarar metros y estar dibujado en milímetros; en ese caso la
 * superficie de los ambientes saldría un millón de veces mayor y arrastraría a
 * todo el cálculo normativo. Conviene avisar antes que calcular mal.
 */
export function unidadDeclaradaEsPlausible(unidad: UnidadDXF, bbox: BBox): boolean {
  if (unidad === 'sin_definir') return false
  const dimensionM = dimensionMayor(bbox) * METROS_POR_UNIDAD[unidad]
  return (
    dimensionM >= DIMENSION_PLAUSIBLE_M.min && dimensionM <= DIMENSION_PLAUSIBLE_M.max
  )
}
