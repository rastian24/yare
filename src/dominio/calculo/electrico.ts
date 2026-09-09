/**
 * Cálculos eléctricos de la Sección 770: corriente de proyecto, corriente
 * admisible, coordinación con la protección y caída de tensión.
 *
 * Todo puro y sin estado. La secuencia de cálculo sigue la Tabla 770-B.I
 * (Anexo 770-B, guía práctica para determinar la sección de cables).
 */

import {
  AGRUPAMIENTO,
  CAIDA_TENSION_V_A_KM,
  CALIBRES_PROTECCION,
  CORRIENTE_ADMISIBLE,
  DPMS_MINIMA_VA,
  FRACCION_ILUMINACION,
  PAT_MINIMO_ABSOLUTO,
  PE_MINIMO_ABSOLUTO,
  SECCIONES_COMERCIALES,
  SIMULTANEIDAD,
  VA_POR_BOCA_ILUMINACION,
} from '@/normativa/aea770/tablas'
import type { Circuito, Fases, TipoCircuito } from '@/dominio/tipos'

// ---------------------------------------------------------------------------
// Demanda de potencia máxima simultánea (770.8.1, Tabla 770.8.I)
// ---------------------------------------------------------------------------

export interface EntradaDPMS {
  tipo: TipoCircuito
  /** Cantidad de bocas del circuito (las que computan como boca según 770.7.1). */
  bocas: number
  /** Sólo para IUG: si el circuito lleva tomacorrientes derivados. */
  conTomasDerivados?: boolean
  /**
   * Suma de las cargas declaradas del circuito, en VA. Si supera el mínimo de
   * la tabla, manda ésta: la Nota de la Tabla 770.8.I dice que los valores son
   * mínimos y que si los consumos son conocidos y mayores, se usan los mayores.
   */
  cargaDeclaradaVA?: number
}

/**
 * DPMS de un circuito, en VA (Tabla 770.8.I).
 *
 * - IUG sin tomacorrientes derivados: ⅔ de considerar todos los puntos de
 *   utilización a razón de 60 VA cada uno.
 * - IUG con tomacorrientes derivados: 2 200 VA por circuito.
 * - TUG: 2 200 VA por circuito.
 * - TUE: 3 300 VA por circuito.
 */
export function dpmsCircuito(e: EntradaDPMS): number {
  let minimo: number

  if (e.tipo === 'IUG' && !e.conTomasDerivados) {
    minimo = FRACCION_ILUMINACION * e.bocas * VA_POR_BOCA_ILUMINACION
  } else {
    minimo = DPMS_MINIMA_VA[e.tipo]
  }

  return Math.max(minimo, e.cargaDeclaradaVA ?? 0)
}

/**
 * Coeficiente de simultaneidad aplicable según la cantidad mínima de circuitos
 * del inmueble (Tabla 770.8.II).
 *
 * La tabla sólo lista 2, 3, 5 y 6 circuitos. Para valores intermedios se toma
 * el coeficiente del escalón inmediato inferior, que es el conservador; por
 * encima de 6 se mantiene 0,6.
 */
export function coeficienteSimultaneidad(cantidadCircuitos: number): number {
  let coef = SIMULTANEIDAD[0]!.coeficiente
  for (const fila of SIMULTANEIDAD) {
    if (cantidadCircuitos >= fila.circuitos) coef = fila.coeficiente
  }
  return coef
}

// ---------------------------------------------------------------------------
// Corriente de proyecto Ib (Tabla 770-B.I)
// ---------------------------------------------------------------------------

/**
 * Corriente de proyecto en A.
 *
 *   monofásico: Ib = DPMS / 220
 *   trifásico:  Ib = DPMS / (√3 · 380)
 */
export function corrienteProyecto(dpmsVA: number, fases: Fases, tensionV: number): number {
  if (fases === 'trifasica') return dpmsVA / (Math.sqrt(3) * tensionV)
  return dpmsVA / tensionV
}

// ---------------------------------------------------------------------------
// Corriente admisible Iz (Tablas 770.12.I y 770.12.II)
// ---------------------------------------------------------------------------

/**
 * Factor de corrección por agrupamiento de circuitos en una misma canalización
 * (Tabla 770.12.II). El PE no cuenta como cable cargado.
 *
 * Un solo circuito no lleva corrección. La tabla llega hasta 3 circuitos; por
 * encima se mantiene 0,70, que es el valor más desfavorable que consigna.
 */
export function factorAgrupamiento(circuitosEnCanalizacion: number, fases: Fases): number {
  if (circuitosEnCanalizacion <= 1) return 1

  const filas = AGRUPAMIENTO.filter((f) => f.fases === fases).sort(
    (a, b) => a.hastaCircuitos - b.hastaCircuitos,
  )

  let factor = 1
  for (const fila of filas) {
    if (circuitosEnCanalizacion >= fila.hastaCircuitos) factor = fila.factor
  }
  return factor
}

/**
 * Corriente admisible del cable en A, ya corregida por agrupamiento.
 *
 * `cablesCargados` es 2 para un circuito monofásico (2 cables cargados + PE,
 * columna "2x") y 3 para uno trifásico (3 cables cargados + N + PE, "3x").
 */
export function corrienteAdmisible(
  seccionMm2: number,
  fases: Fases,
  circuitosEnCanalizacion = 1,
): number {
  const fila = CORRIENTE_ADMISIBLE[seccionMm2]
  if (!fila) {
    throw new Error(`Sección ${seccionMm2} mm² fuera de la Tabla 770.12.I`)
  }
  const base = fases === 'trifasica' ? fila.tres : fila.dos
  return base * factorAgrupamiento(circuitosEnCanalizacion, fases)
}

// ---------------------------------------------------------------------------
// Coordinación cable / protección (770.15.3)
// ---------------------------------------------------------------------------

/**
 * Elige la corriente asignada de la protección que cumple Ib ≤ In ≤ Iz.
 * Devuelve `null` si ningún calibre entra en la ventana, lo que significa que
 * hay que subir la sección del cable.
 *
 * `maxProteccionA` acota por tipo de circuito (Tabla 770.6.I): IUG 16 A,
 * TUG 20 A, TUE 32 A.
 */
export function elegirProteccion(
  ibA: number,
  izA: number,
  maxProteccionA: number,
): number | null {
  for (const calibre of CALIBRES_PROTECCION) {
    if (calibre >= ibA && calibre <= izA && calibre <= maxProteccionA) return calibre
  }
  return null
}

/**
 * Sección mínima que satisface Ib ≤ Iz, buscando en la serie comercial a
 * partir de un piso dado.
 */
export function seccionPorCorriente(
  ibA: number,
  fases: Fases,
  circuitosEnCanalizacion = 1,
  seccionMinimaMm2 = 1,
): number | null {
  for (const s of SECCIONES_COMERCIALES) {
    if (s < seccionMinimaMm2) continue
    if (!CORRIENTE_ADMISIBLE[s]) continue
    if (corrienteAdmisible(s, fases, circuitosEnCanalizacion) >= ibA) return s
  }
  return null
}

// ---------------------------------------------------------------------------
// Caída de tensión (770.15.6 y Tabla 770.15.IV)
// ---------------------------------------------------------------------------

export interface EntradaCaidaTension {
  seccionMm2: number
  /** Corriente de línea en A. */
  corrienteA: number
  /** Longitud del circuito en metros, entre los dos puntos considerados. */
  longitudM: number
  tensionV: number
  fases: Fases
}

export interface ResultadoCaidaTension {
  caidaV: number
  caidaPct: number
}

/**
 * Caída de tensión por el método de tabla (770.15.6 b, Tabla 770.15.IV).
 *
 * La tabla da V/A·km para cables unipolares en contacto en cañería, con
 * cos φ = 0,80 y sen φ = 0,60, y es válida para líneas monofásicas. Para
 * trifásico se aplica el factor √3/2 sobre el valor monofásico, que es la
 * relación entre las constantes k de la fórmula general de 770.15.6 a.
 */
export function caidaTensionPorTabla(e: EntradaCaidaTension): ResultadoCaidaTension {
  const vAkm = CAIDA_TENSION_V_A_KM[e.seccionMm2]
  if (vAkm === undefined) {
    throw new Error(`Sección ${e.seccionMm2} mm² fuera de la Tabla 770.15.IV`)
  }

  const factorFases = e.fases === 'trifasica' ? Math.sqrt(3) / 2 : 1
  const caidaV = vAkm * e.corrienteA * (e.longitudM / 1000) * factorFases

  return { caidaV, caidaPct: (caidaV / e.tensionV) * 100 }
}

/**
 * Caída de tensión por la fórmula general de 770.15.6 a:
 *
 *   ΔU = k · I · L · (R·cos φ + X·sen φ)
 *
 * con k = 2 en monofásico y bifásico, y √3 en trifásico. `L` va en km.
 *
 * Se usa cuando se conocen R y X del cable; si no, conviene la tabla.
 */
export function caidaTensionPorFormula(
  e: EntradaCaidaTension & { resistenciaOhmKm: number; reactanciaOhmKm: number; cosPhi: number },
): ResultadoCaidaTension {
  const k = e.fases === 'trifasica' ? Math.sqrt(3) : 2
  const senPhi = Math.sqrt(Math.max(0, 1 - e.cosPhi ** 2))
  const caidaV =
    k *
    e.corrienteA *
    (e.longitudM / 1000) *
    (e.resistenciaOhmKm * e.cosPhi + e.reactanciaOhmKm * senPhi)

  return { caidaV, caidaPct: (caidaV / e.tensionV) * 100 }
}

/**
 * Corriente a considerar para el cálculo de caída de tensión (770.15.6).
 *
 * La norma indica que los circuitos de iluminación se consideran con ⅔ de la
 * carga total en el extremo más alejado, y los de tomacorrientes con su DPMS
 * completa.
 *
 * Ojo: para un IUG sin tomas derivados la DPMS de la Tabla 770.8.I ya viene
 * afectada por el ⅔, así que volver a aplicarlo sería contarlo dos veces. Por
 * eso el ⅔ sólo se aplica cuando la DPMS no lo incluye — es decir, cuando el
 * circuito de iluminación lleva tomacorrientes derivados y su DPMS es el valor
 * fijo de 2 200 VA.
 */
export function corrienteParaCaidaTension(
  circuito: Pick<Circuito, 'tipo' | 'conTomasDerivados'>,
  dpmsVA: number,
  fases: Fases,
  tensionV: number,
): number {
  const ib = corrienteProyecto(dpmsVA, fases, tensionV)
  if (circuito.tipo === 'IUG' && circuito.conTomasDerivados) {
    return ib * FRACCION_ILUMINACION
  }
  return ib
}

/**
 * Menor sección comercial que mantiene la caída de tensión dentro del límite.
 * Devuelve `null` si ninguna sección de la tabla alcanza.
 */
export function seccionPorCaidaTension(
  e: Omit<EntradaCaidaTension, 'seccionMm2'>,
  maxPct: number,
  seccionMinimaMm2 = 1,
): number | null {
  for (const s of SECCIONES_COMERCIALES) {
    if (s < seccionMinimaMm2) continue
    if (CAIDA_TENSION_V_A_KM[s] === undefined) continue
    if (caidaTensionPorTabla({ ...e, seccionMm2: s }).caidaPct <= maxPct) return s
  }
  return null
}

// ---------------------------------------------------------------------------
// Conductor de protección (Tabla 770.14.I)
// ---------------------------------------------------------------------------

/**
 * Sección del conductor de protección PE en función de la sección de fase.
 *
 *   S ≤ 16      → S
 *   16 < S ≤ 35 → 16
 *   S > 35      → S / 2
 *
 * Con el piso absoluto de 2,5 mm² de 770.14.4.5.
 */
export function seccionPE(seccionFaseMm2: number): number {
  let pe: number
  if (seccionFaseMm2 <= 16) pe = seccionFaseMm2
  else if (seccionFaseMm2 <= 35) pe = 16
  else pe = seccionFaseMm2 / 2

  return Math.max(pe, PE_MINIMO_ABSOLUTO)
}

/**
 * Sección del cable de puesta a tierra PAT. Misma regla que el PE pero con
 * piso de 4 mm² (nota de la Tabla 770.14.I).
 */
export function seccionPAT(seccionFaseMm2: number): number {
  return Math.max(seccionPE(seccionFaseMm2), PAT_MINIMO_ABSOLUTO)
}

// ---------------------------------------------------------------------------
// Desequilibrio entre fases (770.8.3.4)
// ---------------------------------------------------------------------------

/**
 * Desequilibrio porcentual entre la fase más y la menos cargada, referido a la
 * más cargada. Devuelve 0 si no hay carga.
 */
export function desequilibrioPct(cargasPorFase: number[]): number {
  const activas = cargasPorFase.filter((c) => c > 0)
  if (activas.length === 0) return 0

  const max = Math.max(...cargasPorFase)
  const min = Math.min(...cargasPorFase)
  if (max === 0) return 0

  return ((max - min) / max) * 100
}
