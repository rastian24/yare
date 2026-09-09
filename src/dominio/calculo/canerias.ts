/**
 * Selección del diámetro mínimo de cañería (770.10.3.8.4).
 *
 * La norma resuelve el problema en dos niveles:
 *
 *  1. Tablas 770.10.VII a IX, indexadas por UNA sección de cable. Aplican a un
 *     haz homogéneo y, según 770.10.3.3.4 e.1, sólo a caños de pared interna
 *     lisa o uniforme.
 *  2. Para los casos no previstos en esas tablas, la regla general: el área
 *     total ocupada por los cables, incluida la aislación, no debe superar el
 *     35 % de la sección interna del caño.
 *
 * Un tramo real casi siempre lleva secciones mezcladas, así que el camino (2)
 * es el habitual y el (1) es el atajo exacto cuando el haz es homogéneo.
 */

import {
  areaCable,
  buscarCano,
  canosDeFamilia,
  FACTOR_LLENADO_MAX,
  PISO_NOMINAL_MM,
  serieDe,
  serieDeCano,
  type Cano,
  type FamiliaCano,
} from '@/normativa/aea770/canerias'

/** Un cable que atraviesa la canalización. */
export interface CableEnCano {
  seccionMm2: number
  cantidad: number
}

export interface EntradaCaneria {
  /** Cables de fase y neutro que pasan por el tramo. El PE va aparte. */
  cables: CableEnCano[]
  /** Secciones de los conductores de protección que acompañan al haz. */
  pe: CableEnCano[]
  familia: FamiliaCano
  /** Un circuito principal o seccional tiene un piso de diámetro mayor. */
  esPrincipalOSeccional?: boolean
  /**
   * Tramo entre el tablero principal y el primer tablero seccional: 770.7.1 p
   * exige como mínimo R19/R20 (3/4") y recomienda R25 (1").
   */
  esTableroPrincipalASeccional?: boolean
}

export type MetodoCaneria = 'tabla' | 'llenado_35' | 'piso_normativo'

export interface ResultadoCaneria {
  cano: Cano
  metodo: MetodoCaneria
  /** Área total ocupada por los cables, incluida la aislación, en mm². */
  areaOcupadaMm2: number
  /** Porcentaje de ocupación respecto de la sección interna del caño. */
  ocupacionPct: number
  /** Cantidad total de cables, PE incluido. */
  totalCables: number
  /** Explicación corta de por qué se eligió ese caño. Se muestra en la UI. */
  justificacion: string
}

/**
 * ¿El caño alcanza el piso de diámetro que le corresponde al circuito?
 *
 * Se compara por diámetro nominal contra `PISO_NOMINAL_MM`, no derivando el
 * diámetro interno del área libre: esas áreas son orientativas y no reproducen
 * la enumeración explícita de 770.10.3.8.4 (ver el comentario de esa constante).
 */
function alcanzaPiso(cano: Cano, piso: 'terminal' | 'principal'): boolean {
  const minimo = PISO_NOMINAL_MM[piso][serieDeCano(cano)]
  if (minimo === undefined) return true
  return cano.diametroNominalMm >= minimo
}

/** Área total ocupada por un conjunto de cables, en mm². */
export function areaOcupada(cables: CableEnCano[]): number {
  return cables.reduce((sum, c) => sum + areaCable(c.seccionMm2) * c.cantidad, 0)
}

function totalCables(cables: CableEnCano[]): number {
  return cables.reduce((sum, c) => sum + c.cantidad, 0)
}

/**
 * ¿El haz es homogéneo? Lo es cuando todos los cables cargados tienen la misma
 * sección. El PE puede diferir: las tablas ya lo contemplan como "+PE".
 */
function seccionHomogenea(cables: CableEnCano[]): number | null {
  const secciones = new Set(cables.filter((c) => c.cantidad > 0).map((c) => c.seccionMm2))
  if (secciones.size !== 1) return null
  return [...secciones][0] ?? null
}

/**
 * Piso aplicable según el tipo de circuito (770.10.3.8.4).
 *
 * El tramo entre tablero principal y primer seccional cae en el piso de
 * principal: 770.7.1 p exige allí como mínimo R19/R20 (3/4"), que es
 * exactamente la enumeración del piso de 15 mm.
 */
function pisoDe(e: EntradaCaneria): 'terminal' | 'principal' {
  return e.esTableroPrincipalASeccional || e.esPrincipalOSeccional ? 'principal' : 'terminal'
}

/**
 * Diámetro mínimo de cañería para un haz de cables.
 *
 * Devuelve `null` si ningún caño de la familia alcanza, lo que en la práctica
 * significa que hay que dividir el tramo en dos cañerías.
 */
export function calcularCaneria(e: EntradaCaneria): ResultadoCaneria | null {
  const todos = [...e.cables, ...e.pe]
  const area = areaOcupada(todos)
  const nCables = totalCables(todos)
  const piso = pisoDe(e)

  if (nCables === 0) return null

  const candidatos = canosDeFamilia(e.familia).filter((c) => alcanzaPiso(c, piso))

  // --- Camino 1: haz homogéneo, lectura directa de tabla -------------------
  // Las tablas 770.10.VII y VIII sólo valen para caños de pared lisa. Para
  // corrugados, 770.10.3.3.4 e.2 manda usar la tabla de pared lisa y subir una
  // medida; eso se resuelve en `calcularCaneriaCorrugado`.
  const seccionUnica = seccionHomogenea(e.cables)
  const nCargados = totalCables(e.cables)

  if (seccionUnica !== null) {
    for (const cano of candidatos) {
      const max = cano.maxCables[seccionUnica]
      if (max !== undefined && nCargados <= max) {
        return {
          cano,
          metodo: 'tabla',
          areaOcupadaMm2: area,
          ocupacionPct: (area / cano.seccionInternaMm2) * 100,
          totalCables: nCables,
          justificacion:
            `Tabla 770.10.${tablaDe(e.familia)}: ${cano.designacion} admite ` +
            `${max} cables de ${seccionUnica} mm² + PE.`,
        }
      }
    }
  }

  // --- Camino 2: regla del 35 % (770.10.3.8.4) -----------------------------
  for (const cano of candidatos) {
    if (area <= cano.seccionInternaMm2 * FACTOR_LLENADO_MAX) {
      const ocupacion = (area / cano.seccionInternaMm2) * 100
      return {
        cano,
        metodo: 'llenado_35',
        areaOcupadaMm2: area,
        ocupacionPct: ocupacion,
        totalCables: nCables,
        justificacion:
          `770.10.3.8.4: ${nCables} cables ocupan ${area.toFixed(1)} mm², ` +
          `${ocupacion.toFixed(1)} % de los ${cano.seccionInternaMm2} mm² de ` +
          `${cano.designacion} (máximo 35 %).`,
      }
    }
  }

  return null
}

/**
 * Igual que `calcularCaneria`, pero aplicando 770.10.3.3.4 e.2: si la
 * canalización no es de pared interna lisa, se debe adoptar el diámetro
 * inmediatamente superior al que dan las tablas de pared lisa.
 *
 * El ejemplo de la propia norma: dos conductores de 2,5 mm² + PE dan RS 16 /
 * RP 16 (5/8"); con pared no uniforme hay que ir a RS 19 / RP 20 (3/4").
 */
export function calcularCaneriaConSaltoPorCorrugado(
  e: EntradaCaneria & { familiaLisaDeReferencia: FamiliaCano },
): ResultadoCaneria | null {
  const base = calcularCaneria({ ...e, familia: e.familiaLisaDeReferencia })
  if (!base) return null

  const serie = serieDe(base.cano)
  const idx = serie.findIndex((c) => c.designacion === base.cano.designacion)
  const siguiente = idx >= 0 ? serie[idx + 1] : undefined

  if (!siguiente) return base

  return {
    ...base,
    cano: siguiente,
    ocupacionPct: (base.areaOcupadaMm2 / siguiente.seccionInternaMm2) * 100,
    justificacion:
      `${base.justificacion} Por 770.10.3.3.4 e.2 (pared interna no uniforme) ` +
      `se adopta la medida inmediata superior: ${siguiente.designacion}.`,
  }
}

function tablaDe(familia: FamiliaCano): string {
  switch (familia) {
    case 'metalica':
      return 'VII'
    case 'rigida':
      return 'VIII'
    case 'curvable':
      return 'IX'
  }
}

/**
 * Construye el haz de cables de un tramo a partir de los circuitos que lo
 * atraviesan.
 *
 * Detalle de 770.10.3.8.4: para secciones de cable mayores a 2,5 mm² y hasta
 * 16 mm², la sección del PE considerada para el cálculo de la canalización es
 * igual a la de los cables de fase (Tabla 770.14.I).
 */
export function hazDeCircuitos(
  circuitos: Array<{ seccionMm2: number; cablesCargados: number }>,
): { cables: CableEnCano[]; pe: CableEnCano[] } {
  const cables = new Map<number, number>()
  const pe = new Map<number, number>()

  for (const c of circuitos) {
    cables.set(c.seccionMm2, (cables.get(c.seccionMm2) ?? 0) + c.cablesCargados)

    // Sección del PE a efectos del cálculo de la canalización.
    const seccionPE = c.seccionMm2 <= 16 ? c.seccionMm2 : 16
    pe.set(seccionPE, (pe.get(seccionPE) ?? 0) + 1)
  }

  const aLista = (m: Map<number, number>): CableEnCano[] =>
    [...m.entries()]
      .map(([seccionMm2, cantidad]) => ({ seccionMm2, cantidad }))
      .sort((a, b) => a.seccionMm2 - b.seccionMm2)

  return { cables: aLista(cables), pe: aLista(pe) }
}

export { buscarCano, canosDeFamilia }
