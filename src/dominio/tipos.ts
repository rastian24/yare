/**
 * Tipos del dominio. Sin dependencias de React ni del navegador: todo esto se
 * testea en Node.
 *
 * Referencia normativa: AEA 90364-7-770, Edición 2017 — "Viviendas unifamiliares
 * hasta 63 A; clasificaciones BA2 y BD1".
 */

// ---------------------------------------------------------------------------
// Geometría
// ---------------------------------------------------------------------------

export interface Punto {
  x: number
  y: number
}

export interface BBox {
  min: Punto
  max: Punto
}

// ---------------------------------------------------------------------------
// Circuitos (770.6.6 y Tabla 770.6.I)
// ---------------------------------------------------------------------------

/**
 * Siglas de la Tabla 770.6.I. La Sección 770 sólo define estos tres para usos
 * generales y especiales; los usos específicos (ACU, ATE, OCE, IUE...) remiten
 * a AEA 90364-7-771, que queda fuera del alcance de esta app.
 */
export type TipoCircuito = 'IUG' | 'TUG' | 'TUE'

/** Grados de electrificación de la Tabla 770.7.I. */
export type GradoElectrificacion = 'minimo' | 'medio' | 'elevado' | 'superior'

export type Fases = 'monofasica' | 'trifasica'

/** Fase a la que se conecta un circuito monofásico en un suministro trifásico. */
export type Fase = 'R' | 'S' | 'T'

// ---------------------------------------------------------------------------
// Ambientes (Tabla 770.7.III)
// ---------------------------------------------------------------------------

/**
 * Tipos de ambiente reconocidos por la Tabla 770.7.III. Los nombres siguen la
 * redacción de la norma; `estar` cubre "sala de estar, comedor, comedor diario,
 * escritorio, estudio, biblioteca o similares".
 */
export type TipoAmbiente =
  | 'estar'
  | 'dormitorio'
  | 'cocina'
  | 'bano'
  | 'toilette'
  | 'vestibulo'
  | 'pasillo'
  | 'lavadero'
  | 'semicubierto'

export interface Ambiente {
  id: string
  nombre: string
  tipo: TipoAmbiente
  /** Superficie en m². Para `pasillo` y `semicubierto` manda `longitudM`. */
  superficieM2: number
  /** Longitud en metros. Sólo se usa en pasillos y espacios semicubiertos. */
  longitudM?: number
  /**
   * Polígono en coordenadas del plano. Se completa solo al importar un DXF
   * (ver `cad/ambientes.ts`); en un plano raster es opcional.
   */
  poligono?: Punto[]
  /** Si el ambiente se limpia por baldeado, las tomas suben a 0,30 m (770.7.2). */
  conBaldeado?: boolean
}

// ---------------------------------------------------------------------------
// Planos: raster (foto) y vectorial (DXF)
// ---------------------------------------------------------------------------

/**
 * Unidades de dibujo de $INSUNITS (grupo 70 de la cabecera DXF). Sólo se listan
 * las que tienen sentido en un plano de arquitectura.
 */
export type UnidadDXF = 'sin_definir' | 'pulgadas' | 'pies' | 'mm' | 'cm' | 'm'

export interface CapaDXF {
  nombre: string
  color: string
  visible: boolean
}

/** Entidad CAD ya denormalizada: los INSERT vienen con su transformación aplicada. */
export type EntidadCAD =
  | { tipo: 'linea'; capa: string; a: Punto; b: Punto }
  | { tipo: 'polilinea'; capa: string; puntos: Punto[]; cerrada: boolean }
  | { tipo: 'arco'; capa: string; centro: Punto; radio: number; desdeGrados: number; hastaGrados: number }
  | { tipo: 'circulo'; capa: string; centro: Punto; radio: number }
  | { tipo: 'texto'; capa: string; posicion: Punto; texto: string; alturaTexto: number }

export interface Calibracion {
  p1: Punto
  p2: Punto
  /** Distancia real entre p1 y p2, en metros. */
  metrosReales: number
}

export type FuentePlano =
  | { tipo: 'raster'; blobId: string; anchoPx: number; altoPx: number; calibracion: Calibracion | null }
  | {
      tipo: 'dxf'
      blobId: string
      unidades: UnidadDXF
      capas: CapaDXF[]
      entidades: EntidadCAD[]
      bbox: BBox
      /** Presente sólo si $INSUNITS venía sin definir y el usuario calibró a mano. */
      calibracion?: Calibracion | null
    }

export interface Plano {
  id: string
  nombre: string
  fuente: FuentePlano
}

/**
 * Resultado de resolver la escala de un plano. `metrosPorUnidad` convierte
 * coordenadas del plano a metros reales; el resto de la app no necesita saber
 * si el fondo es una foto o un CAD.
 */
export interface Escala {
  metrosPorUnidad: number
  calibrado: boolean
  origen: 'archivo' | 'manual' | 'sin_calibrar'
}

// ---------------------------------------------------------------------------
// Elementos sobre el plano
// ---------------------------------------------------------------------------

export interface Elemento {
  id: string
  simboloId: string
  planoId: string
  posicion: Punto
  ambienteId?: string
  circuitoId?: string
  /**
   * Carga en VA. Si se deja en `undefined` se usa la del símbolo. Sólo importa
   * para el cálculo de DPMS cuando los consumos son conocidos y superan los
   * mínimos de la Tabla 770.8.I.
   */
  cargaVA?: number
  /** Altura de montaje en metros. Alimenta el cálculo de longitud 3D. */
  alturaM?: number
  etiqueta?: string
}

/** Altura a la que corre una canalización. Define el tramo vertical hasta cada boca. */
export type NivelTramo = 'losa' | 'piso' | 'pared'

export interface Tramo {
  id: string
  planoId: string
  /** Polilínea en coordenadas del plano. */
  puntos: Punto[]
  tipoCano: string
  /** Diámetro elegido por el usuario; si falta, se usa el recomendado. */
  diametroElegido?: string
  nivel: NivelTramo
  /** Altura del tramo en metros. Si falta se deriva de `nivel`. */
  alturaM?: number
  /** Elementos que este tramo vincula, en orden de recorrido. */
  elementoIds: string[]
  /** Pisa la longitud calculada, para cuando el plano no refleja la obra. */
  longitudManualM?: number
}

export interface Circuito {
  id: string
  nombre: string
  tipo: TipoCircuito
  /** Sección de los conductores de fase, en mm². */
  seccionMm2: number
  /** Corriente asignada de la protección, en A. */
  proteccionIn: number
  /** Fase asignada. Sólo relevante en suministro trifásico. */
  fase?: Fase
  /**
   * Verdadero si es un circuito de iluminación que además alimenta
   * tomacorrientes derivados: cambia la DPMS (Tabla 770.8.I) y la sección
   * mínima (Tabla 770.11.I).
   */
  conTomasDerivados?: boolean
  /** Cantidad de circuitos que comparten canalización, para el factor de agrupamiento. */
  circuitosAgrupados?: number
}

// ---------------------------------------------------------------------------
// Alturas de montaje (770.7.2 y 770.7.1 m)
// ---------------------------------------------------------------------------

export interface AlturasMontaje {
  /** Arista inferior entre 0,2 y 0,3 m del solado terminado (770.7.2). */
  tomaSobreZocaloM: number
  /** No menos de 0,10 m por encima del nivel de mesada (770.7.2). */
  tomaSobreMesadaM: number
  /** Tomas conectadas al circuito de iluminación: mínimo 0,90 m (770.7.1 m). */
  tomaEnIluminacionM: number
  /** Ambientes con limpieza por baldeado: no menos de 0,30 m (770.7.2). */
  tomaConBaldeadoM: number
  /** Altura del local; la norma no la fija, es dato de obra. */
  bocaTechoM: number
  /** Uso habitual del oficio; la norma no fija altura para interruptores. */
  interruptorM: number
  tableroM: number
}

export const ALTURAS_POR_DEFECTO: AlturasMontaje = {
  tomaSobreZocaloM: 0.25,
  tomaSobreMesadaM: 1.1,
  tomaEnIluminacionM: 0.9,
  tomaConBaldeadoM: 0.3,
  bocaTechoM: 2.6,
  interruptorM: 1.2,
  tableroM: 1.6,
}

// ---------------------------------------------------------------------------
// Proyecto
// ---------------------------------------------------------------------------

export interface Suministro {
  /** Tensión de fase en V. 220 en monofásico, 380 de línea en trifásico. */
  tensionV: number
  fases: Fases
  cosPhi: number
  /** Temperatura ambiente de cálculo. Las tablas 770.12 están a 40 °C. */
  tempAmbienteC: number
  /** Máxima caída de tensión admisible en %. Por defecto 3 (770.15.6). */
  caidaTensionMaxPct: number
  /** Corriente presunta de cortocircuito en el punto de suministro, en kA. */
  iccPresuntaKA?: number
}

export const SUMINISTRO_POR_DEFECTO: Suministro = {
  tensionV: 220,
  fases: 'monofasica',
  cosPhi: 0.85,
  tempAmbienteC: 40,
  caidaTensionMaxPct: 3,
}

export interface Inmueble {
  superficieCubiertaM2: number
  superficieSemicubiertaM2: number
  ambientes: Ambiente[]
}

export interface Proyecto {
  id: string
  nombre: string
  creadoEn: string
  actualizadoEn: string
  inmueble: Inmueble
  suministro: Suministro
  alturas: AlturasMontaje
  planos: Plano[]
  elementos: Elemento[]
  tramos: Tramo[]
  circuitos: Circuito[]
  precios: ListaPrecios
}

// ---------------------------------------------------------------------------
// Hallazgos de validación
// ---------------------------------------------------------------------------

export type Severidad = 'error' | 'advertencia' | 'info'

export type AlcanceHallazgo =
  | { tipo: 'proyecto' }
  | { tipo: 'circuito'; id: string }
  | { tipo: 'tramo'; id: string }
  | { tipo: 'boca'; id: string }
  | { tipo: 'ambiente'; id: string }

export interface Hallazgo {
  id: string
  severidad: Severidad
  /** Cláusula de la norma que fundamenta el hallazgo. Nunca vacía. */
  clausula: string
  mensaje: string
  /** Acción concreta sugerida, cuando existe una. */
  sugerencia?: string
  alcance: AlcanceHallazgo
}

// ---------------------------------------------------------------------------
// Precios y presupuesto
// ---------------------------------------------------------------------------

export type UnidadPrecio = 'unidad' | 'metro' | 'barra_3m' | 'global'

export interface PrecioItem {
  id: string
  descripcion: string
  unidad: UnidadPrecio
  precioARS: number
  categoria: 'cable' | 'cano' | 'caja' | 'modulo' | 'tablero' | 'pat' | 'mano_obra'
}

export interface ListaPrecios {
  /** Fecha de la última actualización, en ISO. Se muestra siempre junto al total. */
  actualizadaEn: string
  items: PrecioItem[]
  /** Porcentajes que se aplican sobre el subtotal, en ese orden. */
  ayudaGremioPct: number
  gastosGeneralesPct: number
  beneficioPct: number
  ivaPct: number
}
