/**
 * Tablas de AEA 90364-7-770, Edición 2017.
 *
 * Sólo se transcriben los VALORES NUMÉRICOS necesarios para calcular, cada uno
 * citando su cláusula. El texto de la norma no se reproduce: el ejemplar
 * consultado es una copia de cortesía de AEA de uso restringido.
 *
 * Toda constante de este archivo debe poder rastrearse a una tabla del
 * documento. Si un valor no sale de la norma, va comentado como tal.
 */

import type { GradoElectrificacion, TipoAmbiente, TipoCircuito } from '@/dominio/tipos'

// ---------------------------------------------------------------------------
// Tabla 770.7.I — Grados de electrificación
// ---------------------------------------------------------------------------

/**
 * Límites de superficie por grado. La superficie a considerar (llamada "límite
 * de aplicación" en 770.7.3) es la cubierta más el 50 % de la semicubierta.
 */
export const GRADOS_ELECTRIFICACION: ReadonlyArray<{
  grado: GradoElectrificacion
  nombre: string
  hastaM2: number
}> = [
  { grado: 'minimo', nombre: 'Mínimo', hastaM2: 60 },
  { grado: 'medio', nombre: 'Medio', hastaM2: 130 },
  { grado: 'elevado', nombre: 'Elevado', hastaM2: 200 },
  { grado: 'superior', nombre: 'Superior', hastaM2: Infinity },
]

// ---------------------------------------------------------------------------
// Tabla 770.6.I — Resumen de tipos de circuitos
// ---------------------------------------------------------------------------

export const TIPOS_CIRCUITO: Readonly<
  Record<TipoCircuito, { nombre: string; maxBocas: number; maxProteccionA: number }>
> = {
  IUG: { nombre: 'Iluminación uso general', maxBocas: 15, maxProteccionA: 16 },
  TUG: { nombre: 'Tomacorriente uso general', maxBocas: 15, maxProteccionA: 20 },
  TUE: { nombre: 'Tomacorriente uso especial', maxBocas: 15, maxProteccionA: 32 },
}

// ---------------------------------------------------------------------------
// Tabla 770.7.II — Número mínimo de circuitos
// ---------------------------------------------------------------------------

export interface VarianteCircuitos {
  iug: number
  tug: number
  libre: number
}

/**
 * Variantes admitidas por grado. Un proyecto cumple si satisface AL MENOS UNA
 * de las variantes de su grado.
 */
export const MIN_CIRCUITOS: Readonly<
  Record<GradoElectrificacion, { total: number; variantes: VarianteCircuitos[] }>
> = {
  minimo: { total: 2, variantes: [{ iug: 1, tug: 1, libre: 0 }] },
  medio: {
    total: 3,
    variantes: [
      { iug: 2, tug: 1, libre: 0 },
      { iug: 1, tug: 2, libre: 0 },
    ],
  },
  elevado: {
    total: 5,
    variantes: [
      { iug: 2, tug: 3, libre: 0 },
      { iug: 3, tug: 2, libre: 0 },
    ],
  },
  superior: {
    total: 6,
    variantes: [
      { iug: 2, tug: 3, libre: 1 },
      { iug: 3, tug: 2, libre: 1 },
    ],
  },
}

// ---------------------------------------------------------------------------
// Tabla 770.7.III — Puntos mínimos de utilización
// ---------------------------------------------------------------------------

/**
 * Una exigencia de bocas mínimas. Se resuelve como:
 *   max(minimo, ceil(medida / cadaM2 | cadaML))
 * donde `medida` es la superficie o la longitud del ambiente según el caso.
 */
export interface ExigenciaBocas {
  /** Cantidad fija de bocas. Excluyente con `cadaM2` / `cadaML`. */
  fija?: number
  /** Una boca cada N m² de superficie o fracción. */
  cadaM2?: number
  /** Una boca cada N metros de longitud o fracción. */
  cadaML?: number
  /** Piso: nunca menos que esta cantidad. */
  minimo?: number
  /** Módulos para electrodomésticos de ubicación fija (cocina). */
  modulos?: number
  /** Sólo aplica si la longitud supera este valor (pasillos en grado ≥ medio). */
  soloSiLongitudMayorA?: number
}

export interface ReglaAmbiente {
  iug: ExigenciaBocas
  tug: ExigenciaBocas
}

/**
 * Reglas por ambiente y grado. Se indexa por tipo de ambiente; cada entrada
 * puede variar por grado. `porDefecto` aplica a los grados no listados.
 *
 * El dormitorio se subdivide por superficie (<10, 10-36, >36 m²), así que se
 * resuelve en `reglaDeAmbiente()` y no acá.
 */
type ReglasPorGrado = Partial<Record<GradoElectrificacion, ReglaAmbiente>> & {
  porDefecto: ReglaAmbiente
}

export const PUNTOS_MINIMOS: Readonly<Record<Exclude<TipoAmbiente, 'dormitorio'>, ReglasPorGrado>> = {
  // Sala de estar, comedor, comedor diario, escritorio, estudio, biblioteca o similares.
  estar: {
    porDefecto: {
      iug: { cadaM2: 18, minimo: 1 },
      tug: { cadaM2: 6, minimo: 2 },
    },
  },

  cocina: {
    minimo: {
      iug: { fija: 1 },
      tug: { fija: 3, modulos: 2 },
    },
    medio: {
      iug: { fija: 2 },
      tug: { fija: 3, modulos: 2 },
    },
    elevado: {
      iug: { fija: 2 },
      tug: { fija: 3, modulos: 3 },
    },
    superior: {
      iug: { fija: 2 },
      tug: { fija: 4, modulos: 3 },
    },
    porDefecto: {
      iug: { fija: 2 },
      tug: { fija: 3, modulos: 2 },
    },
  },

  bano: {
    porDefecto: {
      iug: { fija: 1 },
      tug: { fija: 1 },
    },
  },

  // 770.7.1 k: en toilette el tomacorriente se puede cargar al circuito de
  // iluminación, así que no se exige boca de TUG.
  toilette: {
    porDefecto: {
      iug: { fija: 1 },
      tug: { fija: 0 },
    },
  },

  // Vestíbulo, garaje, hall, vestidor o similares.
  vestibulo: {
    minimo: {
      iug: { fija: 1 },
      tug: { fija: 1 },
    },
    porDefecto: {
      iug: { cadaM2: 12, minimo: 1 },
      tug: { cadaM2: 12, minimo: 1 },
    },
  },

  pasillo: {
    minimo: {
      iug: { cadaML: 5, minimo: 1 },
      tug: { fija: 0 },
    },
    porDefecto: {
      // En grados medio y superiores sólo se exige para pasillos de más de 2 m.
      iug: { cadaML: 5, minimo: 1, soloSiLongitudMayorA: 2 },
      tug: { fija: 0 },
    },
  },

  lavadero: {
    minimo: {
      iug: { fija: 1 },
      tug: { fija: 1 },
    },
    porDefecto: {
      iug: { fija: 1 },
      tug: { fija: 2 },
    },
  },

  // Balcones, galerías, atrios o similares espacios semicubiertos y pasillos
  // descubiertos.
  semicubierto: {
    porDefecto: {
      iug: { cadaML: 5, minimo: 1 },
      tug: { fija: 0 },
    },
  },
}

/** Reglas de dormitorio, que dependen de la superficie además del grado. */
export const PUNTOS_MINIMOS_DORMITORIO: ReadonlyArray<{
  hastaM2: number
  /** Grados en los que aplica esta fila. */
  grados: GradoElectrificacion[]
  regla: ReglaAmbiente
}> = [
  {
    hastaM2: 10,
    grados: ['minimo', 'medio', 'elevado', 'superior'],
    regla: { iug: { fija: 1 }, tug: { fija: 2 } },
  },
  {
    hastaM2: 36,
    grados: ['minimo', 'medio', 'elevado', 'superior'],
    regla: { iug: { fija: 1 }, tug: { fija: 3 } },
  },
  {
    // Nota 1 de 770.7.5: si una vivienda de menos de 130 m² tuviera un
    // dormitorio de más de 36 m², se toman los puntos del grado "elevado".
    hastaM2: Infinity,
    grados: ['elevado', 'superior'],
    regla: { iug: { fija: 2 }, tug: { fija: 3 } },
  },
]

// ---------------------------------------------------------------------------
// Tabla 770.8.I — Demanda de potencia máxima simultánea
// ---------------------------------------------------------------------------

/** VA por punto de utilización de iluminación, para el cálculo de ⅔ (770.8.1). */
export const VA_POR_BOCA_ILUMINACION = 60

/** Fracción de la carga de iluminación que se computa (770.8.1 y 770.15.6). */
export const FRACCION_ILUMINACION = 2 / 3

export const DPMS_MINIMA_VA: Readonly<Record<TipoCircuito, number>> = {
  // IUG sin tomacorrientes derivados no tiene mínimo fijo: se calcula por bocas.
  // El valor de acá es el que corresponde a IUG CON tomacorrientes derivados.
  IUG: 2200,
  TUG: 2200,
  TUE: 3300,
}

// ---------------------------------------------------------------------------
// Tabla 770.8.II — Coeficientes de simultaneidad
// ---------------------------------------------------------------------------

/** Indexado por la cantidad mínima de circuitos que posee el inmueble. */
export const SIMULTANEIDAD: ReadonlyArray<{ circuitos: number; coeficiente: number }> = [
  { circuitos: 2, coeficiente: 1 },
  { circuitos: 3, coeficiente: 0.8 },
  { circuitos: 5, coeficiente: 0.7 },
  { circuitos: 6, coeficiente: 0.6 },
]

// ---------------------------------------------------------------------------
// Tabla 770.11.I — Secciones nominales mínimas de cables [mm²]
// ---------------------------------------------------------------------------

export const SECCIONES_MINIMAS = {
  lineaPrincipal: 4.0,
  circuitoSeccional: 2.5,
  /** Iluminación de usos generales, con conexión fija o por tomacorrientes. */
  iug: 1.5,
  tug: 2.5,
  /** Iluminación de usos generales que incluye tomacorrientes de usos generales. */
  iugConTomas: 2.5,
  /** Líneas de circuito para usos especiales. */
  tue: 2.5,
  conductorProteccion: 2.5,
  /** Alimentaciones y retornos de interruptores de efecto. */
  interruptorEfecto: 1.0,
} as const

/** Serie de secciones comerciales, en mm². */
export const SECCIONES_COMERCIALES = [
  1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300,
] as const

// ---------------------------------------------------------------------------
// Tabla 770.12.I — Intensidad de corriente admisible [A] a 40 °C
// ---------------------------------------------------------------------------

/**
 * Cables sin envoltura de protección (IRAM-NM 247-3 / IRAM 62267) en cañería.
 *
 *   `dos` = 2 cables cargados + PE   (columna "2x", método B52-2 B1)
 *   `tres` = 3 cables cargados + N + PE (columna "3x", método B52-4 B1)
 */
export const CORRIENTE_ADMISIBLE: Readonly<Record<number, { dos: number; tres: number }>> = {
  1.0: { dos: 11, tres: 10 },
  1.5: { dos: 15, tres: 14 },
  2.5: { dos: 21, tres: 18 },
  4: { dos: 28, tres: 25 },
  6: { dos: 36, tres: 32 },
  10: { dos: 50, tres: 44 },
  16: { dos: 66, tres: 59 },
  25: { dos: 88, tres: 77 },
  35: { dos: 109, tres: 96 },
  50: { dos: 131, tres: 117 },
  70: { dos: 167, tres: 149 },
  95: { dos: 202, tres: 180 },
  120: { dos: 234, tres: 208 },
  150: { dos: 261, tres: 228 },
  185: { dos: 297, tres: 258 },
  240: { dos: 348, tres: 301 },
  300: { dos: 398, tres: 343 },
}

// ---------------------------------------------------------------------------
// Tabla 770.12.II — Factor de corrección por agrupamiento
// ---------------------------------------------------------------------------

/**
 * Los conductores de protección PE no se contabilizan como cables cargados
 * (Nota 1 de la tabla).
 */
export const AGRUPAMIENTO: ReadonlyArray<{
  fases: 'monofasica' | 'trifasica'
  hastaCircuitos: number
  factor: number
}> = [
  { fases: 'monofasica', hastaCircuitos: 2, factor: 0.8 },
  { fases: 'monofasica', hastaCircuitos: 3, factor: 0.7 },
  { fases: 'trifasica', hastaCircuitos: 2, factor: 0.8 },
  { fases: 'trifasica', hastaCircuitos: 3, factor: 0.7 },
]

// ---------------------------------------------------------------------------
// Tabla 770.15.IV — Caída de tensión [V/A·km]
// ---------------------------------------------------------------------------

/**
 * Cables unipolares en contacto dispuestos en cañerías, para cos φ = 0,80 y
 * sen φ = 0,60. Tabla válida para líneas monofásicas.
 */
export const CAIDA_TENSION_V_A_KM: Readonly<Record<number, number>> = {
  1.5: 26,
  2.5: 15,
  4: 10,
  6: 6.5,
  10: 3.8,
  16: 2.4,
  25: 1.6,
  35: 1.2,
  50: 0.8,
  70: 0.6,
  95: 0.5,
  120: 0.4,
}

/** Máxima caída de tensión admisible, en % (770.15.6). */
export const CAIDA_TENSION_MAX_PCT = {
  /** Circuitos terminales de uso general o especial, iluminación y tomacorrientes. */
  circuitoTerminal: 3,
  /** Circuitos que alimentan sólo motores, en régimen. */
  motoresRegimen: 5,
  /** Circuitos que alimentan sólo motores, durante el arranque. */
  motoresArranque: 15,
  /** Recomendación para la caída parcial en circuitos seccionales. */
  seccionalRecomendado: 1,
} as const

// ---------------------------------------------------------------------------
// Tabla 770.14.I — Sección del conductor de protección
// ---------------------------------------------------------------------------

/** Sección mínima absoluta del conductor de protección PE, en mm² (770.14.4.5). */
export const PE_MINIMO_ABSOLUTO = 2.5

/** Sección mínima absoluta del cable de puesta a tierra PAT, en mm² (770.14.I). */
export const PAT_MINIMO_ABSOLUTO = 4

// ---------------------------------------------------------------------------
// 770.8.3.3 — Umbral para recomendar suministro trifásico
// ---------------------------------------------------------------------------

export const UMBRAL_TRIFASICO = {
  cargaVA: 7000,
  corrienteA: 32,
} as const

/** Máximo desequilibrio recomendado entre fases, en % (770.8.3.4). */
export const MAX_DESEQUILIBRIO_PCT = 30

// ---------------------------------------------------------------------------
// 770.10.3.1 y 770.10.3.6.2 — Reglas de canalización
// ---------------------------------------------------------------------------

export const CANALIZACION = {
  /** Cantidad máxima de curvas entre bocas, cajas o gabinetes (770.10.3.1). */
  maxCurvasEntreCajas: 3,
  /** Separación máxima entre cajas de paso en tramos rectos, en m (770.10.3.6.2). */
  maxMetrosEntreCajas: 15,
  /** Longitud comercial de una barra de caño, en m (Tablas 770.10.I y II). */
  largoBarraM: 3,
} as const

// ---------------------------------------------------------------------------
// Corrientes asignadas de protecciones
// ---------------------------------------------------------------------------

/**
 * Escalera de corrientes asignadas de interruptores automáticos de uso
 * domiciliario. No es una tabla de la Sección 770: son los calibres
 * comerciales habituales (IEC 60898), acotados a 63 A por el dominio de
 * aplicación de esta Sección.
 */
export const CALIBRES_PROTECCION = [6, 10, 16, 20, 25, 32, 40, 50, 63] as const
