/**
 * Detección de ambientes a partir de la geometría del CAD.
 *
 * Es la pieza que más paga del import: la suma de superficies alimenta la
 * superficie cubierta, que determina el grado de electrificación (770.7.3), que
 * a su vez determina el número mínimo de circuitos (770.7.4) y de bocas por
 * ambiente (770.7.5). Toda la cadena normativa arranca de ese dato.
 *
 * La detección es ASISTIDA, nunca silenciosa: la app propone y el usuario
 * confirma. El tipo de ambiente en particular no se puede inferir con
 * confianza de un plano, y es justo el dato del que dependen los mínimos.
 */

import { areaPoligono, puntoEnPoligono } from '@/dominio/calculo/longitudes'
import { ladoMayorEnvolvente, midePorLongitud } from '@/dominio/calculo/ambientes'
import { METROS_POR_UNIDAD } from './unidades'
import type { Ambiente, EntidadCAD, Punto, TipoAmbiente, UnidadDXF } from '@/dominio/tipos'

export interface AmbienteDetectado {
  id: string
  /** Nombre leído del plano, o uno genérico si no había texto adentro. */
  nombre: string
  /** Tipo propuesto por el mapeo de nombres. Siempre confirmable. */
  tipoPropuesto: TipoAmbiente
  /** Qué tan confiable es la propuesta de tipo. */
  confianza: 'alta' | 'baja'
  superficieM2: number
  poligono: Punto[]
  capa: string
  /** Textos encontrados dentro del polígono. */
  textos: string[]
}

/**
 * Palabras que aparecen en los rótulos de local de un plano de arquitectura
 * argentino, mapeadas al tipo de ambiente de la Tabla 770.7.III.
 *
 * El orden importa: se prueba en secuencia y gana la primera que coincide, así
 * que las más específicas van antes ("comedor diario" antes que "comedor").
 */
const MAPEO_NOMBRES: ReadonlyArray<{ patron: RegExp; tipo: TipoAmbiente }> = [
  { patron: /toilette|toilet\b|\btoil\b/i, tipo: 'toilette' },
  { patron: /ba(ñ|n)o|sanitario|\bbñ\b/i, tipo: 'bano' },
  { patron: /cocina|kitchenette|kitchinette/i, tipo: 'cocina' },
  { patron: /lavadero|lavander|laundry/i, tipo: 'lavadero' },
  { patron: /dormitorio|dorm\b|habitaci(ó|o)n|cuarto|suite/i, tipo: 'dormitorio' },
  { patron: /pasillo|circulaci(ó|o)n|corredor/i, tipo: 'pasillo' },
  { patron: /balc(ó|o)n|galer(í|i)a|terraza|patio|atrio|semicubierto/i, tipo: 'semicubierto' },
  { patron: /garage|garaje|cochera|vestidor|vest(í|i)bulo|hall|recibidor|placard/i, tipo: 'vestibulo' },
  { patron: /estar|comedor|living|escritorio|estudio|biblioteca|\bsum\b/i, tipo: 'estar' },
]

export function tipoDesdeNombre(nombre: string): { tipo: TipoAmbiente; confianza: 'alta' | 'baja' } {
  for (const { patron, tipo } of MAPEO_NOMBRES) {
    if (patron.test(nombre)) return { tipo, confianza: 'alta' }
  }
  // Sin coincidencia se propone "estar", que es el caso más común, pero se
  // marca como baja confianza para que la UI pida confirmación.
  return { tipo: 'estar', confianza: 'baja' }
}

/**
 * Superficie mínima para considerar que un polígono cerrado es un ambiente.
 *
 * Filtra la carpintería, los símbolos de mobiliario y los recuadros de rótulo,
 * que en un plano de arquitectura son muchos más que los locales.
 */
export const SUPERFICIE_MINIMA_M2 = 1.2

/** Superficie por encima de la cual el polígono es probablemente el contorno general. */
export const SUPERFICIE_MAXIMA_M2 = 400

export interface OpcionesDeteccion {
  /** Si se indica, sólo se miran polilíneas de estas capas. */
  capas?: string[]
  superficieMinimaM2?: number
  superficieMaximaM2?: number
}

/**
 * Detecta ambientes a partir de las polilíneas cerradas de la geometría.
 *
 * Los nombres salen de los TEXT/MTEXT que caen dentro de cada polígono.
 */
export function detectarAmbientes(
  entidades: EntidadCAD[],
  unidades: UnidadDXF,
  opciones: OpcionesDeteccion = {},
): AmbienteDetectado[] {
  if (unidades === 'sin_definir') return []

  const metrosPorUnidad = METROS_POR_UNIDAD[unidades]
  const minM2 = opciones.superficieMinimaM2 ?? SUPERFICIE_MINIMA_M2
  const maxM2 = opciones.superficieMaximaM2 ?? SUPERFICIE_MAXIMA_M2
  const capasFiltro = opciones.capas ? new Set(opciones.capas) : null

  const textos = entidades.filter(
    (e): e is Extract<EntidadCAD, { tipo: 'texto' }> => e.tipo === 'texto',
  )

  const candidatos: AmbienteDetectado[] = []
  let n = 0

  for (const e of entidades) {
    if (e.tipo !== 'polilinea' || !e.cerrada) continue
    if (capasFiltro && !capasFiltro.has(e.capa)) continue

    const superficieM2 = areaPoligono(e.puntos) * metrosPorUnidad ** 2
    if (superficieM2 < minM2 || superficieM2 > maxM2) continue

    const adentro = textos
      .filter((t) => puntoEnPoligono(t.posicion, e.puntos))
      .map((t) => t.texto)

    const nombre = elegirNombre(adentro) ?? `Ambiente ${++n}`
    const { tipo, confianza } = tipoDesdeNombre(nombre)

    candidatos.push({
      id: `det-${candidatos.length}`,
      nombre,
      tipoPropuesto: tipo,
      confianza: adentro.length > 0 ? confianza : 'baja',
      superficieM2,
      poligono: e.puntos,
      capa: e.capa,
      textos: adentro,
    })
  }

  // Los planos suelen traer el local dibujado dos veces (muro interior y
  // exterior, o una capa de hatch encima). Se descartan los polígonos que
  // contienen a otro candidato: interesa el más chico, que es el local.
  const finales = candidatos.filter(
    (a) => !candidatos.some((otro) => otro !== a && contiene(a.poligono, otro.poligono)),
  )

  return finales.sort((a, b) => b.superficieM2 - a.superficieM2)
}

/**
 * Elige el nombre más probable entre los textos de un local.
 *
 * Se descartan los que son sólo números o cotas: en un plano el rótulo del
 * local convive con superficies ("12,50 m²") y numeración de puertas.
 */
function elegirNombre(textos: string[]): string | null {
  const utiles = textos.filter((t) => {
    if (t.length < 3) return false
    if (/^[\d\s.,'"²ºm-]+$/.test(t)) return false
    return true
  })

  if (utiles.length === 0) return null

  // Se prefiere el que coincide con el mapeo de tipos.
  const conTipo = utiles.find((t) => tipoDesdeNombre(t).confianza === 'alta')
  return conTipo ?? utiles[0]!
}

/** ¿El polígono `exterior` contiene enteramente a `interior`? */
function contiene(exterior: Punto[], interior: Punto[]): boolean {
  if (interior.length === 0) return false
  return interior.every((p) => puntoEnPoligono(p, exterior))
}

/**
 * Convierte un ambiente detectado en un `Ambiente` del proyecto.
 *
 * `unidades` hace falta porque el polígono viene en unidades de dibujo y la
 * longitud de los pasillos se guarda en metros.
 */
export function aAmbiente(
  detectado: AmbienteDetectado,
  unidades: UnidadDXF,
  tipo?: TipoAmbiente,
): Ambiente {
  const tipoFinal = tipo ?? detectado.tipoPropuesto

  const ambiente: Ambiente = {
    id: detectado.id,
    nombre: detectado.nombre,
    tipo: tipoFinal,
    superficieM2: Number(detectado.superficieM2.toFixed(2)),
    poligono: detectado.poligono,
  }

  // Pasillos y semicubiertos se miden por longitud, no por superficie
  // (Tabla 770.7.III: "una boca por cada 5 m de longitud o fracción").
  if (midePorLongitud(tipoFinal)) {
    ambiente.longitudM = Number(longitudEnMetros(detectado.poligono, unidades).toFixed(2))
  }

  return ambiente
}

/**
 * Longitud de un pasillo en metros, con la escala aplicada.
 * Se separa de `aAmbiente` porque el polígono viene en unidades de dibujo.
 */
export function longitudEnMetros(poligono: Punto[], unidades: UnidadDXF): number {
  if (unidades === 'sin_definir') return 0
  return ladoMayorEnvolvente(poligono) * METROS_POR_UNIDAD[unidades]
}
