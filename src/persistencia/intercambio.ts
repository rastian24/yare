/**
 * Formato de intercambio: llevarse el proyecto en un archivo y volver a
 * entrarlo, sea para respaldarlo, para pasarlo a otra máquina o para mandárselo
 * a un colega.
 *
 * El archivo incluye los adjuntos —la foto del plano o el DXF original—, porque
 * esos no viven dentro del proyecto sino en IndexedDB: sin ellos la
 * importación abriría las bocas y los tramos flotando sobre un fondo vacío.
 *
 * El parseo es puro: recibe texto y devuelve datos, sin tocar el navegador. Eso
 * permite testear en Node la parte que importa, que es la tolerancia a archivos
 * viejos, recortados o ajenos. Nada de lo que entra se da por válido: un
 * proyecto con `tensionV` en texto o sin lista de precios rompería el cálculo
 * mucho más adentro, donde el error ya no se puede explicar.
 */

import {
  ALTURAS_POR_DEFECTO,
  SUMINISTRO_POR_DEFECTO,
  type Ambiente,
  type AlturasMontaje,
  type Circuito,
  type Elemento,
  type Inmueble,
  type ListaPrecios,
  type Plano,
  type PrecioItem,
  type Proyecto,
  type Suministro,
  type Tramo,
} from '@/dominio/tipos'
import { listaPreciosPorDefecto } from '@/dominio/computo/presupuesto'

/** Marca del archivo. Distingue una exportación nuestra de cualquier otro JSON. */
export const FORMATO = 'circuitos-aea'

/**
 * Versión del formato. Se sube sólo cuando un archivo nuevo deja de poder
 * leerse con el código viejo; los campos agregados no la mueven, porque el
 * parseo completa lo que falte.
 */
export const VERSION_FORMATO = 1

/** Archivo del plano guardado dentro de la exportación, en base64. */
export interface AdjuntoExportado {
  id: string
  nombre: string
  /** Tipo MIME original, para reconstruir el Blob tal cual entró. */
  tipo: string
  /** Contenido en base64, sin el prefijo `data:`. */
  datos: string
}

export interface ArchivoProyecto {
  formato: typeof FORMATO
  version: number
  exportadoEn: string
  proyecto: Proyecto
  adjuntos: AdjuntoExportado[]
}

/** Falla de importación con un mensaje pensado para mostrarle al usuario. */
export class ErrorImportacion extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorImportacion'
  }
}

export function serializarProyecto(
  proyecto: Proyecto,
  adjuntos: AdjuntoExportado[],
): string {
  const archivo: ArchivoProyecto = {
    formato: FORMATO,
    version: VERSION_FORMATO,
    exportadoEn: new Date().toISOString(),
    proyecto,
    adjuntos,
  }
  return JSON.stringify(archivo, null, 2)
}

/**
 * Lee un archivo exportado. Acepta también las exportaciones anteriores, que
 * eran el proyecto pelado y sin adjuntos.
 *
 * @throws {ErrorImportacion} si el texto no es un proyecto reconocible.
 */
export function parsearArchivoProyecto(texto: string): {
  proyecto: Proyecto
  adjuntos: AdjuntoExportado[]
} {
  let datos: unknown
  try {
    datos = JSON.parse(texto)
  } catch {
    throw new ErrorImportacion('El archivo no es un JSON válido.')
  }

  if (!esObjeto(datos)) throw new ErrorImportacion(AJENO)

  if (datos.formato === FORMATO) {
    const version = numero(datos.version, 0)
    if (version > VERSION_FORMATO) {
      throw new ErrorImportacion(
        `El archivo se exportó con una versión más nueva de la aplicación (formato ${version}, ` +
          `esta lee hasta ${VERSION_FORMATO}). Actualizá la página e intentá de nuevo.`,
      )
    }
    return {
      proyecto: normalizarProyecto(datos.proyecto),
      adjuntos: normalizarAdjuntos(datos.adjuntos),
    }
  }

  // Exportaciones anteriores al formato con adjuntos: el proyecto pelado. Se
  // reconoce por su forma, no por una marca, porque no llevaban ninguna.
  if (esObjeto(datos.inmueble) && Array.isArray(datos.circuitos)) {
    return { proyecto: normalizarProyecto(datos), adjuntos: [] }
  }

  throw new ErrorImportacion(AJENO)
}

const AJENO = 'El archivo no es un proyecto de Circuitos AEA.'

// ---------------------------------------------------------------------------
// Normalización
// ---------------------------------------------------------------------------

function normalizarProyecto(datos: unknown): Proyecto {
  if (!esObjeto(datos)) throw new ErrorImportacion(AJENO)

  const ahora = new Date().toISOString()

  return {
    id: cadena(datos.id) ?? nuevoIdProyecto(),
    nombre: cadena(datos.nombre) ?? 'Proyecto importado',
    creadoEn: cadena(datos.creadoEn) ?? ahora,
    actualizadoEn: cadena(datos.actualizadoEn) ?? ahora,
    inmueble: normalizarInmueble(datos.inmueble),
    suministro: normalizarSuministro(datos.suministro),
    alturas: normalizarAlturas(datos.alturas),
    planos: conId<Plano>(datos.planos),
    elementos: conId<Elemento>(datos.elementos),
    tramos: conId<Tramo>(datos.tramos),
    circuitos: conId<Circuito>(datos.circuitos),
    precios: normalizarPrecios(datos.precios),
  }
}

function normalizarInmueble(datos: unknown): Inmueble {
  const i = esObjeto(datos) ? datos : {}
  return {
    superficieCubiertaM2: numero(i.superficieCubiertaM2, 0),
    superficieSemicubiertaM2: numero(i.superficieSemicubiertaM2, 0),
    ambientes: conId<Ambiente>(i.ambientes),
  }
}

function normalizarSuministro(datos: unknown): Suministro {
  const s = esObjeto(datos) ? datos : {}
  const suministro: Suministro = {
    tensionV: numero(s.tensionV, SUMINISTRO_POR_DEFECTO.tensionV),
    fases: s.fases === 'trifasica' ? 'trifasica' : 'monofasica',
    cosPhi: numero(s.cosPhi, SUMINISTRO_POR_DEFECTO.cosPhi),
    tempAmbienteC: numero(s.tempAmbienteC, SUMINISTRO_POR_DEFECTO.tempAmbienteC),
    caidaTensionMaxPct: numero(
      s.caidaTensionMaxPct,
      SUMINISTRO_POR_DEFECTO.caidaTensionMaxPct,
    ),
  }
  if (typeof s.iccPresuntaKA === 'number' && Number.isFinite(s.iccPresuntaKA)) {
    suministro.iccPresuntaKA = s.iccPresuntaKA
  }
  return suministro
}

function normalizarAlturas(datos: unknown): AlturasMontaje {
  const a = esObjeto(datos) ? datos : {}
  const alturas = { ...ALTURAS_POR_DEFECTO }
  for (const clave of Object.keys(ALTURAS_POR_DEFECTO) as Array<keyof AlturasMontaje>) {
    alturas[clave] = numero(a[clave], ALTURAS_POR_DEFECTO[clave])
  }
  return alturas
}

/**
 * Los precios de un archivo viejo se respetan tal cual, con su fecha: pisarlos
 * con los valores sembrados daría un presupuesto distinto al que se exportó.
 * Sólo se cae a la lista por defecto si no vino ninguna.
 */
function normalizarPrecios(datos: unknown): ListaPrecios {
  const porDefecto = listaPreciosPorDefecto()
  if (!esObjeto(datos) || !Array.isArray(datos.items)) return porDefecto

  return {
    actualizadaEn: cadena(datos.actualizadaEn) ?? porDefecto.actualizadaEn,
    items: conId<PrecioItem>(datos.items),
    ayudaGremioPct: numero(datos.ayudaGremioPct, porDefecto.ayudaGremioPct),
    gastosGeneralesPct: numero(datos.gastosGeneralesPct, porDefecto.gastosGeneralesPct),
    beneficioPct: numero(datos.beneficioPct, porDefecto.beneficioPct),
    ivaPct: numero(datos.ivaPct, porDefecto.ivaPct),
  }
}

function normalizarAdjuntos(datos: unknown): AdjuntoExportado[] {
  if (!Array.isArray(datos)) return []

  const adjuntos: AdjuntoExportado[] = []
  for (const item of datos) {
    if (!esObjeto(item)) continue
    const id = cadena(item.id)
    const contenido = typeof item.datos === 'string' ? item.datos : null
    if (id === null || contenido === null) continue
    adjuntos.push({
      id,
      nombre: cadena(item.nombre) ?? id,
      tipo: cadena(item.tipo) ?? 'application/octet-stream',
      datos: contenido,
    })
  }
  return adjuntos
}

// ---------------------------------------------------------------------------
// Utilidades

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function cadena(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null
}

function numero(v: unknown, porDefecto: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : porDefecto
}

/**
 * Filtra una lista a los elementos que al menos tienen `id`. Todo lo que la app
 * hace con planos, bocas, tramos y circuitos los busca por ahí, así que una
 * entrada sin id no es recuperable y arrastraría errores lejos del archivo.
 */
function conId<T extends { id: string }>(v: unknown): T[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is T => esObjeto(x) && cadena(x.id) !== null)
}

function nuevoIdProyecto(): string {
  return `proyecto-${Math.random().toString(36).slice(2, 9)}`
}
