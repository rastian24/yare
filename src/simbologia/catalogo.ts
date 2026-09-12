/**
 * Catálogo de simbología eléctrica, con base en IRAM 4504 (a la que remite
 * 770-A.1.2 para los esquemas).
 *
 * Cada símbolo lleva la metadata que alimenta el cómputo: si computa como boca,
 * qué carga representa, a qué tipos de circuito puede pertenecer, a qué altura
 * se monta y qué materiales arrastra.
 *
 * El campo `computaComoBoca` es el que hace que el conteo del máximo de 15
 * bocas por circuito siga 770.7.1 en vez de contar íconos: los interruptores de
 * efecto y las cajas de paso NO son bocas (Nota 1 de 770.6.6).
 */

import type { TipoCircuito } from '@/dominio/tipos'

export type CategoriaSimbolo =
  | 'iluminacion'
  | 'tomacorriente'
  | 'interruptor'
  | 'tablero'
  | 'puesta_tierra'
  | 'caja'

/** Material que arrastra un símbolo al cómputo. */
export interface RefMaterial {
  materialId: string
  cantidad: number
}

export interface Simbolo {
  id: string
  nombre: string
  /**
   * Nombre breve para la etiqueta de la galería, donde el nombre completo no
   * entra. Se lee junto al título de la categoría, así que no hace falta
   * repetirla: "Techo" bajo Iluminación, "De paso" bajo Cajas.
   */
  nombreCorto: string
  categoria: CategoriaSimbolo
  /**
   * Contenido SVG del símbolo, dibujado en una caja de 24×24 centrada en
   * (12, 12). Se inserta dentro de un <g> con la transformación de posición.
   */
  svg: string
  circuitosPermitidos: TipoCircuito[]
  /**
   * Carga en VA que se le asigna por defecto. Para iluminación son los 60 VA
   * por punto de utilización de 770.8.1; para tomacorrientes se deja en 0
   * porque la DPMS de TUG y TUE es un valor fijo por circuito, no por boca.
   */
  cargaVA: number
  /** Corriente nominal del accesorio, en A. */
  corrienteA?: number
  /** Si computa como boca a efectos del máximo de 15 por circuito (770.7.1). */
  computaComoBoca: boolean
  /** Altura de montaje por defecto; se resuelve contra `AlturasMontaje`. */
  altura: 'bocaTechoM' | 'tomaSobreZocaloM' | 'tomaSobreMesadaM' | 'interruptorM' | 'tableroM' | 'piso'
  materiales: RefMaterial[]
  /** Nota normativa que se muestra al colocarlo, cuando corresponde. */
  nota?: string
}

// Trazos comunes. Se usa `currentColor` para que el símbolo tome el color del
// circuito al que pertenece.
const T = 'fill="none" stroke="currentColor" stroke-width="1.5"'

export const SIMBOLOS: readonly Simbolo[] = [
  // -------------------------------------------------------------------------
  // Iluminación
  // -------------------------------------------------------------------------
  {
    id: 'luz_techo',
    nombre: 'Boca de iluminación en techo',
    nombreCorto: 'Techo',
    categoria: 'iluminacion',
    svg: `<circle cx="12" cy="12" r="6" ${T}/>
          <line x1="7.8" y1="7.8" x2="16.2" y2="16.2" ${T}/>
          <line x1="16.2" y1="7.8" x2="7.8" y2="16.2" ${T}/>`,
    circuitosPermitidos: ['IUG'],
    cargaVA: 60,
    corrienteA: 10,
    computaComoBoca: true,
    altura: 'bocaTechoM',
    materiales: [
      { materialId: 'caja_octogonal_chica', cantidad: 1 },
      { materialId: 'portalampara', cantidad: 1 },
    ],
  },
  {
    id: 'luz_pared',
    nombre: 'Aplique de pared',
    nombreCorto: 'Aplique',
    categoria: 'iluminacion',
    svg: `<circle cx="12" cy="12" r="5" ${T}/>
          <line x1="8.5" y1="8.5" x2="15.5" y2="15.5" ${T}/>
          <line x1="15.5" y1="8.5" x2="8.5" y2="15.5" ${T}/>
          <line x1="3" y1="12" x2="7" y2="12" ${T}/>`,
    circuitosPermitidos: ['IUG'],
    cargaVA: 60,
    corrienteA: 10,
    computaComoBoca: true,
    altura: 'interruptorM',
    materiales: [{ materialId: 'caja_rectangular', cantidad: 1 }],
  },
  {
    id: 'ventilador',
    nombre: 'Ventilador de techo o extractor',
    nombreCorto: 'Ventilador',
    categoria: 'iluminacion',
    svg: `<circle cx="12" cy="12" r="2" ${T}/>
          <path d="M12 10 C12 5, 17 5, 17 9" ${T}/>
          <path d="M14 12 C19 12, 19 17, 15 17" ${T}/>
          <path d="M10 14 C5 14, 5 9, 9 9" ${T}/>`,
    circuitosPermitidos: ['IUG'],
    cargaVA: 60,
    corrienteA: 10,
    computaComoBoca: true,
    altura: 'bocaTechoM',
    materiales: [{ materialId: 'caja_octogonal_grande', cantidad: 1 }],
    nota: '770.7.1 c: a efectos del cálculo de la demanda se computa como una boca de iluminación.',
  },

  // -------------------------------------------------------------------------
  // Tomacorrientes
  // -------------------------------------------------------------------------
  {
    id: 'toma_10a',
    nombre: 'Tomacorriente 2P+T 10 A',
    nombreCorto: 'Toma 10 A',
    categoria: 'tomacorriente',
    svg: `<path d="M4 12 A8 8 0 0 1 20 12 Z" ${T}/>
          <line x1="4" y1="12" x2="20" y2="12" ${T}/>
          <line x1="12" y1="12" x2="12" y2="17" ${T}/>`,
    circuitosPermitidos: ['TUG'],
    cargaVA: 0,
    corrienteA: 10,
    computaComoBoca: true,
    altura: 'tomaSobreZocaloM',
    materiales: [
      { materialId: 'caja_rectangular', cantidad: 1 },
      { materialId: 'modulo_toma_10a', cantidad: 1 },
      { materialId: 'bastidor_tapa', cantidad: 1 },
    ],
    nota: 'IRAM 2071. Por 770.7.2, hasta 0,90 m debe llevar pantalla de protección (BA2).',
  },
  {
    id: 'toma_20a',
    nombre: 'Tomacorriente 2P+T 20 A (uso especial)',
    nombreCorto: 'Toma 20 A',
    categoria: 'tomacorriente',
    svg: `<path d="M4 12 A8 8 0 0 1 20 12 Z" ${T}/>
          <line x1="4" y1="12" x2="20" y2="12" ${T}/>
          <line x1="12" y1="12" x2="12" y2="17" ${T}/>
          <line x1="4" y1="15" x2="20" y2="15" ${T}/>`,
    circuitosPermitidos: ['TUE'],
    cargaVA: 0,
    corrienteA: 20,
    computaComoBoca: true,
    altura: 'tomaSobreZocaloM',
    materiales: [
      { materialId: 'caja_rectangular', cantidad: 1 },
      { materialId: 'modulo_toma_20a', cantidad: 1 },
      { materialId: 'bastidor_tapa', cantidad: 1 },
    ],
    nota: 'IRAM 2071. Circuito TUE, protección no mayor a 32 A (Tabla 770.6.I).',
  },
  {
    id: 'toma_mesada',
    nombre: 'Tomacorriente sobre mesada',
    nombreCorto: 'Mesada',
    categoria: 'tomacorriente',
    svg: `<path d="M4 12 A8 8 0 0 1 20 12 Z" ${T}/>
          <line x1="4" y1="12" x2="20" y2="12" ${T}/>
          <line x1="12" y1="12" x2="12" y2="17" ${T}/>
          <line x1="2" y1="19" x2="22" y2="19" ${T} stroke-dasharray="2 2"/>`,
    circuitosPermitidos: ['TUG', 'TUE'],
    cargaVA: 0,
    corrienteA: 10,
    computaComoBoca: true,
    altura: 'tomaSobreMesadaM',
    materiales: [
      { materialId: 'caja_rectangular', cantidad: 1 },
      { materialId: 'modulo_toma_10a', cantidad: 1 },
      { materialId: 'bastidor_tapa', cantidad: 1 },
    ],
    nota: '770.7.2: la arista inferior de la caja va a no menos de 0,10 m del nivel de mesada.',
  },
  {
    id: 'toma_fijo',
    nombre: 'Módulo para electrodoméstico de ubicación fija',
    nombreCorto: 'Equipo fijo',
    categoria: 'tomacorriente',
    svg: `<rect x="5" y="7" width="14" height="10" rx="1" ${T}/>
          <line x1="9" y1="10" x2="9" y2="14" ${T}/>
          <line x1="15" y1="10" x2="15" y2="14" ${T}/>`,
    circuitosPermitidos: ['TUG', 'TUE'],
    cargaVA: 0,
    corrienteA: 10,
    computaComoBoca: true,
    altura: 'tomaSobreZocaloM',
    materiales: [
      { materialId: 'modulo_toma_10a', cantidad: 1 },
      { materialId: 'bastidor_tapa', cantidad: 1 },
    ],
    nota: 'Tabla 770.7.III: los módulos para electrodomésticos fijos pueden compartir boca con otros tomacorrientes.',
  },

  // -------------------------------------------------------------------------
  // Interruptores de efecto — no computan como boca (Nota 1 de 770.6.6)
  // -------------------------------------------------------------------------
  {
    id: 'llave_unipolar',
    nombre: 'Interruptor de efecto unipolar',
    nombreCorto: 'Unipolar',
    categoria: 'interruptor',
    svg: `<circle cx="7" cy="17" r="1.5" ${T}/>
          <line x1="8" y1="16" x2="17" y2="7" ${T}/>`,
    circuitosPermitidos: ['IUG'],
    cargaVA: 0,
    corrienteA: 10,
    computaComoBoca: false,
    altura: 'interruptorM',
    materiales: [
      { materialId: 'caja_rectangular', cantidad: 1 },
      { materialId: 'modulo_llave', cantidad: 1 },
      { materialId: 'bastidor_tapa', cantidad: 1 },
    ],
  },
  {
    id: 'llave_combinacion',
    nombre: 'Interruptor de combinación',
    nombreCorto: 'Combinación',
    categoria: 'interruptor',
    svg: `<circle cx="7" cy="17" r="1.5" ${T}/>
          <line x1="8" y1="16" x2="17" y2="7" ${T}/>
          <line x1="8" y1="16" x2="17" y2="12" ${T}/>`,
    circuitosPermitidos: ['IUG'],
    cargaVA: 0,
    corrienteA: 10,
    computaComoBoca: false,
    altura: 'interruptorM',
    materiales: [
      { materialId: 'caja_rectangular', cantidad: 1 },
      { materialId: 'modulo_combinacion', cantidad: 1 },
      { materialId: 'bastidor_tapa', cantidad: 1 },
    ],
    nota: '770.7.2: en pasillos de más de 3 m se deben prever combinaciones en cada extremo.',
  },
  {
    id: 'llave_punto_muerto',
    nombre: 'Interruptor de punto muerto',
    nombreCorto: 'Punto muerto',
    categoria: 'interruptor',
    svg: `<circle cx="7" cy="17" r="1.5" ${T}/>
          <line x1="8" y1="16" x2="17" y2="7" ${T}/>
          <line x1="8" y1="16" x2="17" y2="12" ${T}/>
          <line x1="5" y1="12" x2="14" y2="3" ${T}/>`,
    circuitosPermitidos: ['IUG'],
    cargaVA: 0,
    corrienteA: 10,
    computaComoBoca: false,
    altura: 'interruptorM',
    materiales: [
      { materialId: 'caja_rectangular', cantidad: 1 },
      { materialId: 'modulo_punto_muerto', cantidad: 1 },
      { materialId: 'bastidor_tapa', cantidad: 1 },
    ],
  },

  // -------------------------------------------------------------------------
  // Tableros
  // -------------------------------------------------------------------------
  {
    id: 'tablero_principal',
    nombre: 'Tablero principal',
    nombreCorto: 'Principal',
    categoria: 'tablero',
    svg: `<rect x="3" y="6" width="18" height="12" rx="1" ${T}/>
          <line x1="3" y1="10" x2="21" y2="10" ${T}/>
          <rect x="6" y="12" width="3" height="4" ${T}/>
          <rect x="11" y="12" width="3" height="4" ${T}/>
          <rect x="16" y="12" width="3" height="4" ${T}/>`,
    circuitosPermitidos: [],
    cargaVA: 0,
    computaComoBoca: false,
    altura: 'tableroM',
    materiales: [],
  },
  {
    id: 'tablero_seccional',
    nombre: 'Tablero seccional',
    nombreCorto: 'Seccional',
    categoria: 'tablero',
    svg: `<rect x="4" y="7" width="16" height="10" rx="1" ${T}/>
          <rect x="7" y="11" width="3" height="4" ${T}/>
          <rect x="14" y="11" width="3" height="4" ${T}/>`,
    circuitosPermitidos: [],
    cargaVA: 0,
    computaComoBoca: false,
    altura: 'tableroM',
    materiales: [],
  },

  // -------------------------------------------------------------------------
  // Puesta a tierra
  // -------------------------------------------------------------------------
  {
    id: 'jabalina',
    nombre: 'Jabalina de puesta a tierra',
    nombreCorto: 'Jabalina',
    categoria: 'puesta_tierra',
    svg: `<line x1="12" y1="4" x2="12" y2="14" ${T}/>
          <line x1="6" y1="14" x2="18" y2="14" ${T}/>
          <line x1="8" y1="17" x2="16" y2="17" ${T}/>
          <line x1="10" y1="20" x2="14" y2="20" ${T}/>`,
    circuitosPermitidos: [],
    cargaVA: 0,
    computaComoBoca: false,
    altura: 'piso',
    materiales: [
      { materialId: 'jabalina', cantidad: 1 },
      { materialId: 'tomacable', cantidad: 1 },
      { materialId: 'caja_inspeccion_pat', cantidad: 1 },
    ],
  },

  // -------------------------------------------------------------------------
  // Cajas — no computan como boca salvo el caso de losa de 770.7.1 l
  // -------------------------------------------------------------------------
  {
    id: 'caja_paso',
    nombre: 'Caja de paso',
    nombreCorto: 'De paso',
    categoria: 'caja',
    svg: `<rect x="7" y="7" width="10" height="10" ${T}/>`,
    circuitosPermitidos: ['IUG', 'TUG', 'TUE'],
    cargaVA: 0,
    computaComoBoca: false,
    altura: 'bocaTechoM',
    materiales: [{ materialId: 'caja_cuadrada', cantidad: 1 }],
    nota: 'Nota 1 de 770.6.6: las cajas de paso no se consideran bocas.',
  },
  {
    id: 'caja_derivacion',
    nombre: 'Caja de derivación',
    nombreCorto: 'Derivación',
    categoria: 'caja',
    svg: `<rect x="7" y="7" width="10" height="10" ${T}/>
          <line x1="7" y1="7" x2="17" y2="17" ${T}/>`,
    circuitosPermitidos: ['IUG', 'TUG', 'TUE'],
    cargaVA: 0,
    computaComoBoca: false,
    altura: 'bocaTechoM',
    materiales: [{ materialId: 'caja_cuadrada', cantidad: 1 }],
  },
  {
    id: 'caja_losa',
    nombre: 'Caja en losa 100×100 mm',
    nombreCorto: 'En losa',
    categoria: 'caja',
    svg: `<rect x="6" y="6" width="12" height="12" ${T}/>
          <line x1="6" y1="6" x2="18" y2="18" ${T}/>
          <line x1="18" y1="6" x2="6" y2="18" ${T}/>`,
    circuitosPermitidos: ['IUG', 'TUG', 'TUE'],
    cargaVA: 60,
    computaComoBoca: true,
    altura: 'bocaTechoM',
    materiales: [{ materialId: 'caja_cuadrada', cantidad: 1 }],
    nota: '770.7.1 l: las cajas en losa de hasta 100×100 mm se consideran bocas y cuentan para el grado de electrificación.',
  },
]

const PORID = new Map(SIMBOLOS.map((s) => [s.id, s]))

export function buscarSimbolo(id: string): Simbolo | undefined {
  return PORID.get(id)
}

export function simbolosDeCategoria(categoria: CategoriaSimbolo): Simbolo[] {
  return SIMBOLOS.filter((s) => s.categoria === categoria)
}

export const NOMBRES_CATEGORIA: Record<CategoriaSimbolo, string> = {
  iluminacion: 'Iluminación',
  tomacorriente: 'Tomacorrientes',
  interruptor: 'Interruptores de efecto',
  tablero: 'Tableros',
  puesta_tierra: 'Puesta a tierra',
  caja: 'Cajas',
}
