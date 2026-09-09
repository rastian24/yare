/**
 * Tablas 770.10.VII, 770.10.VIII y 770.10.IX de AEA 90364-7-770:
 * máxima cantidad de cables por canalización.
 *
 * Las tres tablas se indexan por UNA sola sección de cable (haz homogéneo).
 * Para haces de secciones mezcladas la norma da la regla general de 770.10.3.8.4:
 * el área total ocupada por los cables, incluida la aislación, no debe superar
 * el 35 % de la sección interna del caño. Esa regla vive en
 * `dominio/calculo/canerias.ts` y usa las áreas de `AREA_CABLE_MM2`.
 */

export type FamiliaCano = 'metalica' | 'rigida' | 'curvable'

export interface Cano {
  /** Designación de la norma, p. ej. "RS 16". */
  designacion: string
  familia: FamiliaCano
  /** Diámetro nominal en mm. */
  diametroNominalMm: number
  /** Sección interna libre en mm², según la tabla. */
  seccionInternaMm2: number
  /**
   * Máxima cantidad de cables MÁS el PE, por sección de cable en mm².
   * Una entrada ausente significa que la tabla no lo contempla; en ese caso el
   * cálculo cae en la regla del 35 %.
   */
  maxCables: Readonly<Record<number, number>>
  /**
   * Pared interna lisa o uniforme. Las tablas 770.10.VII y VIII sólo son
   * aplicables a caños de pared lisa (770.10.3.3.4 e.1).
   */
  paredLisa: boolean
  /** Designación comercial en pulgadas, cuando la norma la menciona. */
  comercial?: string
}

/**
 * Diámetro exterior máximo y sección total del cable, incluida la aislación.
 * Encabezado común de las tres tablas.
 */
export const CABLE_DIMENSIONES: Readonly<
  Record<number, { diametroExtMm: number; areaMm2: number }>
> = {
  1: { diametroExtMm: 2.5, areaMm2: 4.91 },
  1.5: { diametroExtMm: 3.5, areaMm2: 9.62 },
  2.5: { diametroExtMm: 4.2, areaMm2: 13.85 },
  4: { diametroExtMm: 4.8, areaMm2: 18.1 },
  6: { diametroExtMm: 6.3, areaMm2: 31.17 },
  10: { diametroExtMm: 7.6, areaMm2: 45.36 },
  16: { diametroExtMm: 8.8, areaMm2: 60.82 },
  25: { diametroExtMm: 11.0, areaMm2: 95.03 },
  35: { diametroExtMm: 12.5, areaMm2: 122.72 },
  50: { diametroExtMm: 14.5, areaMm2: 165.13 },
}

/** Área ocupada por un cable de sección `s`, incluida la aislación, en mm². */
export function areaCable(seccionMm2: number): number {
  const d = CABLE_DIMENSIONES[seccionMm2]
  if (d) return d.areaMm2
  // Secciones fuera de tabla: se estima por el área del círculo del diámetro
  // exterior interpolado. Sólo debería ocurrir con secciones no comerciales.
  const diametro = 2 * Math.sqrt(seccionMm2 / Math.PI) + 2.2
  return (Math.PI * diametro ** 2) / 4
}

/**
 * Fracción máxima de la sección interna del caño que pueden ocupar los cables,
 * para los casos no previstos en las tablas (770.10.3.8.4).
 */
export const FACTOR_LLENADO_MAX = 0.35

/** Diámetro interno mínimo en mm, por tipo de circuito (770.10.3.8.4). */
export const DIAMETRO_INTERNO_MINIMO_MM = {
  /** Circuitos principales o seccionales: RL 19, RS 19, RSP 20 o RP 20. */
  principal: 15,
  /** Circuitos terminales de usos generales o especiales: RL/RS/RSP/RP 16. */
  terminal: 13,
} as const

/**
 * Diámetro nominal mínimo admitido por serie, para cada piso de 770.10.3.8.4.
 *
 * El piso está expresado en la norma como diámetro INTERNO (13 mm y 15 mm),
 * pero las secciones internas libres de las tablas son explícitamente
 * orientativas (nota al pie de las Tablas 770.10.VIII y IX), así que derivar el
 * diámetro interno de esas áreas no reproduce la intención del texto: RS 16
 * tiene 132 mm² de área libre, que daría 12,96 mm, y sin embargo la norma lo
 * nombra entre los que cumplen el piso de 13 mm.
 *
 * Por eso el piso se codifica con la enumeración explícita del texto:
 *   - terminales: "13 mm (RL 16, RS 16, RSP 16 o RP 16)"
 *   - principales y seccionales: "15 mm (RL 19, RS 19, RSP 20 o RP 20)"
 *
 * Las series curvables no están enumeradas en el texto; para ellas el piso se
 * fija en la primera medida cuya área libre supera la del equivalente liso
 * (CSP/CL 16 tienen 98 y 102 mm², bastante menos que los 127-154 mm² de los
 * lisos de 16, así que no califican).
 */
export const PISO_NOMINAL_MM: Readonly<Record<'terminal' | 'principal', Record<string, number>>> = {
  terminal: { RS: 16, RL: 16, RSP: 16, RP: 16, CSP: 19, CL: 19 },
  principal: { RS: 19, RL: 19, RSP: 20, RP: 20, CSP: 22, CL: 22 },
}

// ---------------------------------------------------------------------------
// Tabla 770.10.VII — Canalización metálica
// RS: acero semipesado (IRAM-IAS U 500 2005, Serie 2)
// RL: acero liviano (IRAM-IAS U 500 2224)
// ---------------------------------------------------------------------------

const METALICAS: Cano[] = [
  {
    designacion: 'RS 16', familia: 'metalica', diametroNominalMm: 16,
    seccionInternaMm2: 132, paredLisa: true, comercial: '5/8"',
    maxCables: { 1: 2, 1.5: 4, 2.5: 2 },
  },
  {
    designacion: 'RL 16', familia: 'metalica', diametroNominalMm: 16,
    seccionInternaMm2: 154, paredLisa: true, comercial: '5/8"',
    maxCables: { 1: 4, 1.5: 5, 2.5: 3, 4: 2 },
  },
  {
    designacion: 'RS 19', familia: 'metalica', diametroNominalMm: 19,
    seccionInternaMm2: 177, paredLisa: true, comercial: '3/4"',
    maxCables: { 1: 5, 1.5: 6, 2.5: 4, 4: 3 },
  },
  {
    designacion: 'RL 19', familia: 'metalica', diametroNominalMm: 19,
    seccionInternaMm2: 227, paredLisa: true, comercial: '3/4"',
    maxCables: { 1: 9, 1.5: 7, 2.5: 5, 4: 4, 6: 2 },
  },
  {
    designacion: 'RS 22', familia: 'metalica', diametroNominalMm: 22,
    seccionInternaMm2: 255, paredLisa: true, comercial: '7/8"',
    maxCables: { 1: 11, 1.5: 9, 2.5: 6, 4: 4, 6: 2 },
  },
  {
    designacion: 'RL 22', familia: 'metalica', diametroNominalMm: 22,
    seccionInternaMm2: 314, paredLisa: true, comercial: '7/8"',
    maxCables: { 1: 15, 1.5: 11, 2.5: 7, 4: 5, 6: 3, 10: 2 },
  },
  {
    designacion: 'RS 25', familia: 'metalica', diametroNominalMm: 25,
    seccionInternaMm2: 346, paredLisa: true, comercial: '1"',
    maxCables: { 1.5: 13, 2.5: 9, 4: 6, 6: 3, 10: 2 },
  },
  {
    designacion: 'RL 25', familia: 'metalica', diametroNominalMm: 25,
    seccionInternaMm2: 416, paredLisa: true, comercial: '1"',
    maxCables: { 2.5: 10, 4: 7, 6: 4, 10: 2, 16: 2 },
  },
  {
    designacion: 'RS 32', familia: 'metalica', diametroNominalMm: 32,
    seccionInternaMm2: 616, paredLisa: true, comercial: '1 1/4"',
    maxCables: { 2.5: 15, 4: 11, 6: 6, 10: 4, 16: 3 },
  },
  {
    designacion: 'RL 32', familia: 'metalica', diametroNominalMm: 32,
    seccionInternaMm2: 661, paredLisa: true, comercial: '1 1/4"',
    maxCables: { 4: 12, 6: 7, 10: 4, 16: 3 },
  },
  {
    designacion: 'RS 38', familia: 'metalica', diametroNominalMm: 38,
    seccionInternaMm2: 908, paredLisa: true, comercial: '1 1/2"',
    maxCables: { 6: 9, 10: 6, 16: 4, 25: 2, 35: 2 },
  },
  {
    designacion: 'RL 38', familia: 'metalica', diametroNominalMm: 38,
    seccionInternaMm2: 962, paredLisa: true, comercial: '1 1/2"',
    maxCables: { 6: 10, 10: 7, 16: 5, 25: 3, 35: 2 },
  },
  {
    designacion: 'RS 51', familia: 'metalica', diametroNominalMm: 51,
    seccionInternaMm2: 1662, paredLisa: true, comercial: '2"',
    maxCables: { 6: 18, 10: 12, 16: 9, 25: 5, 35: 4, 50: 3 },
  },
  {
    designacion: 'RL 51', familia: 'metalica', diametroNominalMm: 51,
    seccionInternaMm2: 1810, paredLisa: true, comercial: '2"',
    // La tabla no consigna valor para 6 mm² en RL 51 pese a tener más sección
    // interna que RS 51. Se deja sin entrada a propósito: el cálculo cae en la
    // regla del 35 %, que da el mismo resultado que RS 51.
    maxCables: { 10: 12, 16: 9, 25: 6, 35: 4, 50: 3 },
  },
]

// ---------------------------------------------------------------------------
// Tabla 770.10.VIII — Canalización aislante rígida (IRAM 62386-21)
// RP: rígido pesado (43XX y 44XX) · RSP: rígido semipesado (33XX)
// ---------------------------------------------------------------------------

const RIGIDAS: Cano[] = [
  {
    designacion: 'RP 16', familia: 'rigida', diametroNominalMm: 16,
    seccionInternaMm2: 127, paredLisa: true, comercial: '5/8"',
    maxCables: { 1: 2, 1.5: 4, 2.5: 2 },
  },
  {
    designacion: 'RSP 16', familia: 'rigida', diametroNominalMm: 16,
    seccionInternaMm2: 146, paredLisa: true, comercial: '5/8"',
    maxCables: { 1: 3, 1.5: 4, 2.5: 3, 4: 2 },
  },
  {
    designacion: 'RP 20', familia: 'rigida', diametroNominalMm: 20,
    seccionInternaMm2: 213, paredLisa: true, comercial: '3/4"',
    maxCables: { 1: 8, 1.5: 7, 2.5: 4, 4: 3 },
  },
  {
    designacion: 'RSP 20', familia: 'rigida', diametroNominalMm: 20,
    seccionInternaMm2: 235, paredLisa: true, comercial: '3/4"',
    maxCables: { 1: 10, 1.5: 8, 2.5: 5, 4: 4, 6: 2 },
  },
  {
    designacion: 'RP 22', familia: 'rigida', diametroNominalMm: 22,
    seccionInternaMm2: 264, paredLisa: true, comercial: '7/8"',
    maxCables: { 1: 12, 1.5: 9, 2.5: 6, 4: 4, 6: 2 },
  },
  {
    designacion: 'RSP 22', familia: 'rigida', diametroNominalMm: 22,
    seccionInternaMm2: 302, paredLisa: true, comercial: '7/8"',
    maxCables: { 1: 14, 1.5: 10, 2.5: 7, 4: 5, 6: 2 },
  },
  {
    designacion: 'RP 25', familia: 'rigida', diametroNominalMm: 25,
    seccionInternaMm2: 347, paredLisa: true, comercial: '1"',
    maxCables: { 1.5: 13, 2.5: 9, 4: 6, 6: 3, 10: 2 },
  },
  {
    designacion: 'RSP 25', familia: 'rigida', diametroNominalMm: 25,
    seccionInternaMm2: 388, paredLisa: true, comercial: '1"',
    maxCables: { 1.5: 13, 2.5: 9, 4: 6, 6: 3, 10: 2 },
  },
  {
    designacion: 'RP 32', familia: 'rigida', diametroNominalMm: 32,
    seccionInternaMm2: 613, paredLisa: true, comercial: '1 1/4"',
    maxCables: { 2.5: 15, 4: 11, 6: 6, 10: 4, 16: 3 },
  },
  {
    designacion: 'RSP 32', familia: 'rigida', diametroNominalMm: 32,
    seccionInternaMm2: 649, paredLisa: true, comercial: '1 1/4"',
    maxCables: { 2.5: 15, 4: 12, 6: 7, 10: 4, 16: 3 },
  },
  {
    designacion: 'RP 40', familia: 'rigida', diametroNominalMm: 40,
    seccionInternaMm2: 1012, paredLisa: true, comercial: '1 1/2"',
    maxCables: { 6: 10, 10: 7, 16: 5, 25: 3, 35: 2 },
  },
  {
    designacion: 'RSP 40', familia: 'rigida', diametroNominalMm: 40,
    seccionInternaMm2: 1034, paredLisa: true, comercial: '1 1/2"',
    maxCables: { 6: 11, 10: 7, 16: 5, 25: 3, 35: 2 },
  },
  {
    designacion: 'RP 50', familia: 'rigida', diametroNominalMm: 50,
    seccionInternaMm2: 1643, paredLisa: true, comercial: '2"',
    maxCables: { 6: 17, 10: 12, 16: 8, 25: 5, 35: 4, 50: 2 },
  },
  {
    designacion: 'RSP 50', familia: 'rigida', diametroNominalMm: 50,
    seccionInternaMm2: 1668, paredLisa: true, comercial: '2"',
    maxCables: { 6: 18, 10: 12, 16: 9, 25: 5, 35: 4, 50: 3 },
  },
]

// ---------------------------------------------------------------------------
// Tabla 770.10.IX — Canalización aislante curvable y curvable transversalmente
// autorrecuperable (corrugado), IRAM 62386-22
// CSP: curvable semipesado (33XX) · CL: curvable liviano (23XX)
// ---------------------------------------------------------------------------

const CURVABLES: Cano[] = [
  {
    designacion: 'CSP 16', familia: 'curvable', diametroNominalMm: 16,
    seccionInternaMm2: 98, paredLisa: false, comercial: '5/8"',
    maxCables: { 1: 1, 1.5: 3 },
  },
  {
    designacion: 'CL 16', familia: 'curvable', diametroNominalMm: 16,
    seccionInternaMm2: 102, paredLisa: false, comercial: '5/8"',
    maxCables: { 1: 1, 1.5: 3, 2.5: 2 },
  },
  {
    designacion: 'CSP 19', familia: 'curvable', diametroNominalMm: 19,
    seccionInternaMm2: 158, paredLisa: false, comercial: '3/4"',
    maxCables: { 1: 4, 1.5: 5, 2.5: 3, 4: 2 },
  },
  {
    designacion: 'CL 19', familia: 'curvable', diametroNominalMm: 19,
    seccionInternaMm2: 164, paredLisa: false, comercial: '3/4"',
    maxCables: { 1: 4, 1.5: 5, 2.5: 3, 4: 2 },
  },
  {
    designacion: 'CSP 22', familia: 'curvable', diametroNominalMm: 22,
    seccionInternaMm2: 213, paredLisa: false, comercial: '7/8"',
    maxCables: { 1: 8, 1.5: 7, 2.5: 4, 4: 3 },
  },
  {
    designacion: 'CL 22', familia: 'curvable', diametroNominalMm: 22,
    seccionInternaMm2: 223, paredLisa: false, comercial: '7/8"',
    maxCables: { 1: 9, 1.5: 7, 2.5: 5, 4: 3, 6: 2 },
  },
  {
    designacion: 'CSP 25', familia: 'curvable', diametroNominalMm: 25,
    seccionInternaMm2: 293, paredLisa: false, comercial: '1"',
    maxCables: { 1.5: 10, 2.5: 6, 4: 5, 6: 2 },
  },
  {
    designacion: 'CL 25', familia: 'curvable', diametroNominalMm: 25,
    seccionInternaMm2: 309, paredLisa: false, comercial: '1"',
    maxCables: { 1.5: 10, 2.5: 7, 4: 5, 6: 2 },
  },
  {
    designacion: 'CSP 32', familia: 'curvable', diametroNominalMm: 32,
    seccionInternaMm2: 509, paredLisa: false, comercial: '1 1/4"',
    maxCables: { 2.5: 12, 4: 9, 6: 5, 10: 3, 16: 2 },
  },
  {
    designacion: 'CL 32', familia: 'curvable', diametroNominalMm: 32,
    seccionInternaMm2: 527, paredLisa: false, comercial: '1 1/4"',
    maxCables: { 2.5: 12, 4: 9, 6: 5, 10: 3, 16: 2 },
  },
  {
    designacion: 'CSP 38', familia: 'curvable', diametroNominalMm: 38,
    seccionInternaMm2: 767, paredLisa: false, comercial: '1 1/2"',
    maxCables: { 6: 8, 10: 5, 16: 3, 25: 2 },
  },
  {
    designacion: 'CL 38', familia: 'curvable', diametroNominalMm: 38,
    seccionInternaMm2: 814, paredLisa: false, comercial: '1 1/2"',
    maxCables: { 6: 8, 10: 5, 16: 4, 25: 2 },
  },
  {
    designacion: 'CSP 51', familia: 'curvable', diametroNominalMm: 51,
    seccionInternaMm2: 1507, paredLisa: false, comercial: '2"',
    maxCables: { 6: 16, 10: 11, 16: 8, 25: 5, 35: 3, 50: 2 },
  },
  {
    designacion: 'CL 51', familia: 'curvable', diametroNominalMm: 51,
    seccionInternaMm2: 1545, paredLisa: false, comercial: '2"',
    maxCables: { 6: 16, 10: 11, 16: 8, 25: 5, 35: 3, 50: 2 },
  },
]

/** Todos los caños de las tres tablas, ordenados por sección interna creciente. */
export const CANOS: readonly Cano[] = [...METALICAS, ...RIGIDAS, ...CURVABLES]

/** Caños de una familia, ordenados de menor a mayor sección interna. */
export function canosDeFamilia(familia: FamiliaCano): Cano[] {
  return CANOS.filter((c) => c.familia === familia).sort(
    (a, b) => a.seccionInternaMm2 - b.seccionInternaMm2,
  )
}

export function buscarCano(designacion: string): Cano | undefined {
  return CANOS.find((c) => c.designacion === designacion)
}

/**
 * Serie a la que pertenece un caño, para poder saltar "una medida" cuando la
 * canalización no es de pared lisa (770.10.3.3.4 e.2).
 *
 * Dentro de una familia conviven dos series (p. ej. RS y RL) con diámetros
 * nominales iguales pero secciones distintas, así que el salto se hace dentro
 * de la misma serie, no dentro de toda la familia.
 */
export function serieDeCano(cano: Cano): string {
  return cano.designacion.split(' ')[0] ?? cano.designacion
}

/** Caños de la misma serie, de menor a mayor diámetro nominal. */
export function serieDe(cano: Cano): Cano[] {
  const serie = serieDeCano(cano)
  return CANOS.filter((c) => serieDeCano(c) === serie).sort(
    (a, b) => a.diametroNominalMm - b.diametroNominalMm,
  )
}
