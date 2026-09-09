/**
 * Grado de electrificación (770.7.3), número mínimo de circuitos (770.7.4) y
 * puntos mínimos de utilización (770.7.5).
 *
 * Toda la cadena normativa arranca acá: la superficie determina el grado, el
 * grado determina cuántos circuitos y cuántas bocas hacen falta.
 */

import {
  GRADOS_ELECTRIFICACION,
  MIN_CIRCUITOS,
  PUNTOS_MINIMOS,
  PUNTOS_MINIMOS_DORMITORIO,
  type ExigenciaBocas,
  type ReglaAmbiente,
  type VarianteCircuitos,
} from './tablas'
import type { Ambiente, GradoElectrificacion, Inmueble } from '@/dominio/tipos'

// ---------------------------------------------------------------------------
// Superficie y grado
// ---------------------------------------------------------------------------

/**
 * Superficie a considerar, llamada "límite de aplicación" en 770.7.3: la
 * superficie cubierta más el cincuenta por ciento de la semicubierta.
 */
export function superficieLimiteAplicacion(inmueble: Inmueble): number {
  return inmueble.superficieCubiertaM2 + 0.5 * inmueble.superficieSemicubiertaM2
}

/** Grado de electrificación según la Tabla 770.7.I. */
export function gradoDeSuperficie(superficieM2: number): GradoElectrificacion {
  for (const g of GRADOS_ELECTRIFICACION) {
    if (superficieM2 <= g.hastaM2) return g.grado
  }
  return 'superior'
}

export function gradoDeInmueble(inmueble: Inmueble): GradoElectrificacion {
  return gradoDeSuperficie(superficieLimiteAplicacion(inmueble))
}

export function nombreGrado(grado: GradoElectrificacion): string {
  return GRADOS_ELECTRIFICACION.find((g) => g.grado === grado)?.nombre ?? grado
}

// ---------------------------------------------------------------------------
// Número mínimo de circuitos (Tabla 770.7.II)
// ---------------------------------------------------------------------------

export interface ConteoCircuitos {
  iug: number
  tug: number
  tue: number
}

export interface ResultadoMinimoCircuitos {
  cumple: boolean
  totalRequerido: number
  totalActual: number
  /** Variantes admitidas para el grado. Basta con cumplir una. */
  variantes: VarianteCircuitos[]
  /** La variante más cercana a lo que hay, para poder sugerir qué falta. */
  varianteMasCercana: VarianteCircuitos
  faltanIUG: number
  faltanTUG: number
}

/**
 * Verifica el número mínimo de circuitos contra la Tabla 770.7.II.
 *
 * Un proyecto cumple si satisface AL MENOS UNA de las variantes de su grado.
 * En el grado "superior" el sexto circuito es de libre elección, así que
 * cualquier circuito adicional (incluido un TUE) sirve para completarlo.
 */
export function verificarMinimoCircuitos(
  grado: GradoElectrificacion,
  conteo: ConteoCircuitos,
): ResultadoMinimoCircuitos {
  const { total, variantes } = MIN_CIRCUITOS[grado]
  const totalActual = conteo.iug + conteo.tug + conteo.tue

  let mejor = variantes[0]!
  let mejorFaltante = Infinity

  for (const v of variantes) {
    const faltanIUG = Math.max(0, v.iug - conteo.iug)
    const faltanTUG = Math.max(0, v.tug - conteo.tug)
    const faltante = faltanIUG + faltanTUG

    if (faltante < mejorFaltante) {
      mejorFaltante = faltante
      mejor = v
    }
  }

  const faltanIUG = Math.max(0, mejor.iug - conteo.iug)
  const faltanTUG = Math.max(0, mejor.tug - conteo.tug)
  const cumple = mejorFaltante === 0 && totalActual >= total

  return {
    cumple,
    totalRequerido: total,
    totalActual,
    variantes,
    varianteMasCercana: mejor,
    faltanIUG,
    faltanTUG,
  }
}

// ---------------------------------------------------------------------------
// Puntos mínimos de utilización (Tabla 770.7.III)
// ---------------------------------------------------------------------------

/**
 * Regla aplicable a un ambiente según su tipo, superficie y el grado de
 * electrificación del inmueble.
 */
export function reglaDeAmbiente(
  ambiente: Ambiente,
  grado: GradoElectrificacion,
): ReglaAmbiente | null {
  if (ambiente.tipo === 'dormitorio') {
    for (const fila of PUNTOS_MINIMOS_DORMITORIO) {
      if (ambiente.superficieM2 <= fila.hastaM2 && fila.grados.includes(grado)) {
        return fila.regla
      }
    }
    // Nota 1 de 770.7.5: un dormitorio de más de 36 m² en una vivienda de menos
    // de 130 m² toma los puntos mínimos del grado "elevado".
    const filaGrande = PUNTOS_MINIMOS_DORMITORIO.at(-1)
    return filaGrande ? filaGrande.regla : null
  }

  const reglas = PUNTOS_MINIMOS[ambiente.tipo]
  if (!reglas) return null
  return reglas[grado] ?? reglas.porDefecto
}

/**
 * Resuelve una exigencia de bocas para un ambiente concreto.
 *
 * Las exigencias "una boca cada N m² o fracción" y "cada N metros o fracción"
 * se redondean hacia arriba, y después se aplica el piso `minimo`.
 */
export function bocasExigidas(exigencia: ExigenciaBocas, ambiente: Ambiente): number {
  if (exigencia.soloSiLongitudMayorA !== undefined) {
    const longitud = ambiente.longitudM ?? 0
    if (longitud <= exigencia.soloSiLongitudMayorA) return 0
  }

  if (exigencia.fija !== undefined) return exigencia.fija

  let cantidad = 0
  if (exigencia.cadaM2 !== undefined) {
    cantidad = Math.ceil(ambiente.superficieM2 / exigencia.cadaM2)
  } else if (exigencia.cadaML !== undefined) {
    cantidad = Math.ceil((ambiente.longitudM ?? 0) / exigencia.cadaML)
  }

  return Math.max(cantidad, exigencia.minimo ?? 0)
}

export interface ExigenciaAmbiente {
  ambienteId: string
  nombre: string
  iugRequeridas: number
  tugRequeridas: number
  /** Módulos para electrodomésticos de ubicación fija (sólo cocina). */
  modulosRequeridos: number
}

/** Puntos mínimos de utilización de un ambiente. */
export function exigenciaDeAmbiente(
  ambiente: Ambiente,
  grado: GradoElectrificacion,
): ExigenciaAmbiente | null {
  const regla = reglaDeAmbiente(ambiente, grado)
  if (!regla) return null

  return {
    ambienteId: ambiente.id,
    nombre: ambiente.nombre,
    iugRequeridas: bocasExigidas(regla.iug, ambiente),
    tugRequeridas: bocasExigidas(regla.tug, ambiente),
    modulosRequeridos: regla.tug.modulos ?? 0,
  }
}

/** Puntos mínimos de todos los ambientes del inmueble. */
export function exigenciasDelInmueble(
  inmueble: Inmueble,
  grado: GradoElectrificacion,
): ExigenciaAmbiente[] {
  return inmueble.ambientes
    .map((a) => exigenciaDeAmbiente(a, grado))
    .filter((e): e is ExigenciaAmbiente => e !== null)
}
