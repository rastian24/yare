/**
 * Importación de archivos DXF.
 *
 * Se apoya en la librería `dxf` (MIT), que resuelve los INSERT anidados
 * aplicando sus transformaciones y entrega la geometría ya en coordenadas de
 * modelo. Eso es justo lo que necesitan el snapping y la detección de ambientes.
 *
 * DWG no se soporta: es binario y propietario, no hay parser JS viable, y la
 * única implementación real (LibreDWG a WASM) es GPL-3. Se detecta y se explica
 * cómo exportar DXF, en vez de fallar de forma opaca.
 */

// @ts-expect-error -- la librería `dxf` no publica tipos.
import { denormalise, parseString, toPolylines } from 'dxf'
import { unidadDeCodigo, unidadDeclaradaEsPlausible, unidadMasProbable } from './unidades'
import type { BBox, CapaDXF, EntidadCAD, Punto, UnidadDXF } from '@/dominio/tipos'

export interface ResultadoImportacion {
  entidades: EntidadCAD[]
  capas: CapaDXF[]
  bbox: BBox
  unidades: UnidadDXF
  /** Cómo se resolvió la unidad, para poder explicárselo al usuario. */
  origenUnidad: 'declarada' | 'inferida' | 'indeterminada'
  /** Avisos no fatales de la importación. */
  avisos: string[]
}

export class ErrorDWG extends Error {
  constructor() {
    super(
      'Los archivos DWG no se pueden leer directamente. Exportá el plano a DXF desde tu ' +
        'programa de CAD (AutoCAD, BricsCAD, LibreCAD o QCAD lo hacen sin plugins) y volvé a ' +
        'cargarlo.',
    )
    this.name = 'ErrorDWG'
  }
}

/** ¿El contenido es un DWG? Los DWG arrancan con "AC" seguido de la versión. */
export function pareceDWG(nombre: string, primerosBytes: string): boolean {
  if (nombre.toLowerCase().endsWith('.dwg')) return true
  return /^AC10\d\d/.test(primerosBytes.slice(0, 6))
}

/** Convierte un color RGB de la librería a hexadecimal. */
function aHex(rgb: number[] | undefined): string {
  if (!rgb || rgb.length < 3) return '#000000'
  const [r, g, b] = rgb
  const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${hex(r ?? 0)}${hex(g ?? 0)}${hex(b ?? 0)}`
}

/**
 * ¿La polilínea está cerrada? Se decide por geometría y no por el flag del
 * DXF: hay planos donde el local se dibuja cerrando a mano sobre el primer
 * vértice, sin marcar el flag.
 */
function estaCerrada(puntos: Punto[], tolerancia: number): boolean {
  if (puntos.length < 3) return false
  const a = puntos[0]!
  const b = puntos[puntos.length - 1]!
  return Math.hypot(b.x - a.x, b.y - a.y) <= tolerancia
}

/** Aplica la cadena de transformaciones de un INSERT a un punto. */
function transformarPunto(p: Punto, transforms: unknown[]): Punto {
  let { x, y } = p

  for (const t of transforms as Array<Record<string, number | undefined>>) {
    if (t.scaleX) x *= t.scaleX
    if (t.scaleY) y *= t.scaleY

    if (t.rotation) {
      const rad = (t.rotation * Math.PI) / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      const nx = x * cos - y * sin
      const ny = x * sin + y * cos
      x = nx
      y = ny
    }

    x += t.x ?? 0
    y += t.y ?? 0
  }

  return { x, y }
}

/**
 * Parsea un DXF y devuelve la geometría lista para dibujar y medir.
 *
 * `unidadForzada` permite que el usuario imponga la unidad cuando el archivo no
 * la declara o la declara mal.
 */
export function importarDXF(texto: string, unidadForzada?: UnidadDXF): ResultadoImportacion {
  const avisos: string[] = []

  let parsed: {
    header?: { insUnits?: number }
    tables?: { layers?: Record<string, { name?: string; colorNumber?: number }> }
    entities?: unknown[]
    blocks?: unknown[]
  }

  try {
    parsed = parseString(texto)
  } catch (e) {
    throw new Error(
      `No se pudo interpretar el archivo DXF: ${e instanceof Error ? e.message : String(e)}`,
    )
  }

  // --- Geometría ----------------------------------------------------------
  // `toPolylines` denormaliza los bloques y aplica las transformaciones, así
  // que todo llega en coordenadas de modelo.
  const { polylines, bbox: bboxLib } = toPolylines(parsed) as {
    polylines: Array<{ rgb?: number[]; layer?: { name?: string }; vertices: number[][] }>
    bbox: { min: { x: number; y: number }; max: { x: number; y: number } }
  }

  // El eje Y del DXF crece hacia arriba y el del SVG hacia abajo. Se invierte
  // UNA vez, acá, en lugar de arrastrar transformaciones por todo el editor.
  // Negar una coordenada es una isometría: no cambia distancias ni áreas (el
  // área de Gauss se toma en valor absoluto), así que todo el cálculo
  // normativo aguas abajo es indiferente al cambio.
  const bbox: BBox = {
    min: { x: bboxLib.min.x, y: -bboxLib.max.y },
    max: { x: bboxLib.max.x, y: -bboxLib.min.y },
  }

  // Tolerancia de cierre proporcional al tamaño del dibujo: un plano en mm y
  // otro en metros necesitan umbrales muy distintos.
  const diagonal = Math.hypot(bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y)
  const toleranciaCierre = diagonal * 1e-4

  const entidades: EntidadCAD[] = []

  for (const pl of polylines) {
    const puntos: Punto[] = pl.vertices
      .filter((v) => Number.isFinite(v[0]) && Number.isFinite(v[1]))
      .map((v) => ({ x: v[0]!, y: -v[1]! }))

    if (puntos.length < 2) continue

    const capa = pl.layer?.name ?? '0'

    if (puntos.length === 2) {
      entidades.push({ tipo: 'linea', capa, a: puntos[0]!, b: puntos[1]! })
    } else {
      entidades.push({
        tipo: 'polilinea',
        capa,
        puntos,
        cerrada: estaCerrada(puntos, toleranciaCierre),
      })
    }
  }

  // --- Textos -------------------------------------------------------------
  // `toPolylines` descarta TEXT y MTEXT, pero los nombres de local viven ahí,
  // así que se recuperan de las entidades denormalizadas.
  try {
    const crudas = denormalise(parsed) as Array<{
      type?: string
      layer?: string
      x?: number
      y?: number
      string?: string
      text?: string
      textHeight?: number
      nominalTextHeight?: number
      transforms?: unknown[]
    }>

    for (const e of crudas) {
      if (e.type !== 'TEXT' && e.type !== 'MTEXT') continue

      const contenido = (e.string ?? e.text ?? '').trim()
      if (!contenido) continue
      if (e.x === undefined || e.y === undefined) continue

      const bruto = transformarPunto({ x: e.x, y: e.y }, e.transforms ?? [])
      const posicion = { x: bruto.x, y: -bruto.y }

      entidades.push({
        tipo: 'texto',
        capa: e.layer ?? '0',
        posicion,
        texto: limpiarMTexto(contenido),
        alturaTexto: e.textHeight ?? e.nominalTextHeight ?? diagonal * 0.01,
      })
    }
  } catch {
    avisos.push('No se pudieron leer los textos del plano; la geometría se importó igual.')
  }

  // --- Capas --------------------------------------------------------------
  const capasEnUso = new Set(entidades.map((e) => e.capa))
  const tablaCapas = parsed.tables?.layers ?? {}

  const capas: CapaDXF[] = [...capasEnUso].sort().map((nombre) => {
    const info = tablaCapas[nombre]
    const desdeGeometria = polylines.find((p) => p.layer?.name === nombre)
    return {
      nombre,
      color: aHex(desdeGeometria?.rgb) || colorDeIndice(info?.colorNumber),
      visible: true,
    }
  })

  // --- Unidades -----------------------------------------------------------
  const declarada = unidadDeCodigo(parsed.header?.insUnits)
  let unidades: UnidadDXF
  let origenUnidad: ResultadoImportacion['origenUnidad']

  if (unidadForzada) {
    unidades = unidadForzada
    origenUnidad = 'declarada'
  } else if (declarada !== 'sin_definir') {
    unidades = declarada
    origenUnidad = 'declarada'

    if (!unidadDeclaradaEsPlausible(declarada, bbox)) {
      avisos.push(
        `El archivo declara ${declarada}, pero con esa unidad el plano mediría ` +
          `${(Math.max(bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y) * (declarada === 'mm' ? 0.001 : declarada === 'cm' ? 0.01 : 1)).toFixed(1)} m ` +
          'de lado. Conviene verificar la unidad antes de calcular.',
      )
    }
  } else {
    const inferida = unidadMasProbable(bbox)
    if (inferida) {
      unidades = inferida
      origenUnidad = 'inferida'
      avisos.push(
        `El archivo no declara unidades ($INSUNITS = 0). Se propone ${inferida} porque el ` +
          'dibujo da un tamaño de vivienda razonable. Confirmalo antes de calcular longitudes.',
      )
    } else {
      unidades = 'sin_definir'
      origenUnidad = 'indeterminada'
      avisos.push(
        'El archivo no declara unidades y su tamaño no permite inferirlas. Elegí la unidad o ' +
          'calibrá sobre una distancia conocida.',
      )
    }
  }

  if (entidades.length === 0) {
    avisos.push('El archivo no tiene geometría legible. Se puede usar igual como fondo.')
  }

  return { entidades, capas, bbox, unidades, origenUnidad, avisos }
}

/** Quita los códigos de formato de un MTEXT (\pxq, \fArial, {\H2;...} y demás). */
function limpiarMTexto(s: string): string {
  return s
    .replace(/\\[A-Za-z][^;\\]*;/g, '')
    .replace(/[{}]/g, '')
    .replace(/\\P/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Paleta ACI reducida, para capas sin geometría de la que tomar el color. */
function colorDeIndice(indice: number | undefined): string {
  const ACI: Record<number, string> = {
    1: '#ff0000',
    2: '#ffff00',
    3: '#00ff00',
    4: '#00ffff',
    5: '#0000ff',
    6: '#ff00ff',
    7: '#000000',
    8: '#808080',
    9: '#c0c0c0',
  }
  return ACI[indice ?? 7] ?? '#000000'
}
