/**
 * Medición de ambientes delimitados sobre el plano.
 *
 * El usuario marca los vértices del área y de ahí sale la superficie. Es el
 * dato del que cuelga toda la cadena normativa: superficie → grado de
 * electrificación (770.7.3) → mínimo de circuitos (770.7.4) → bocas por
 * ambiente (Tabla 770.7.III), así que conviene que salga de una medición y no
 * de un número tipeado de memoria.
 *
 * De dónde viene la escala es indiferente acá: llega un `Escala` ya resuelto,
 * que `escalaDe()` sacó de las unidades del DXF o de la calibración manual. Sin
 * escala no hay superficie: se devuelve `null`, nunca un número inventado.
 */

import { areaPoligono, distancia, longitudPolilinea } from './longitudes'
import type { Ambiente, Escala, Punto, TipoAmbiente } from '@/dominio/tipos'

export interface MedidasPoligono {
  superficieM2: number
  perimetroM: number
  /**
   * Lado mayor del rectángulo que envuelve al polígono, en metros. Para un
   * pasillo —que es un rectángulo alargado— aproxima bien su longitud, que es
   * lo que la Tabla 770.7.III pide en pasillos y semicubiertos.
   */
  longitudMayorM: number
}

/** Un contorno necesita al menos tres vértices para encerrar superficie. */
export const VERTICES_MINIMOS = 3

/**
 * Mide un contorno dibujado sobre el plano.
 *
 * Devuelve `null` si el plano no tiene escala o si el contorno no llega a
 * encerrar una superficie.
 */
export function medirPoligono(poligono: Punto[], escala: Escala | null): MedidasPoligono | null {
  if (!escala?.calibrado || escala.metrosPorUnidad <= 0) return null
  if (poligono.length < VERTICES_MINIMOS) return null

  const k = escala.metrosPorUnidad

  return {
    superficieM2: areaPoligono(poligono) * k ** 2,
    perimetroM: perimetroPoligono(poligono) * k,
    longitudMayorM: ladoMayorEnvolvente(poligono) * k,
  }
}

/** Perímetro del contorno cerrado, en unidades del plano. */
export function perimetroPoligono(poligono: Punto[]): number {
  if (poligono.length < 2) return 0
  const primero = poligono[0]!
  return longitudPolilinea([...poligono, primero])
}

/** Lado mayor de la bbox del polígono, en unidades del plano. */
export function ladoMayorEnvolvente(poligono: Punto[]): number {
  if (poligono.length === 0) return 0

  const xs = poligono.map((p) => p.x)
  const ys = poligono.map((p) => p.y)
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
}

/**
 * Centro de masa del polígono, para colgar de ahí la etiqueta del ambiente.
 *
 * En una "L" el promedio de los vértices puede caer fuera de la figura; el
 * centroide por áreas queda adentro en los casos habituales de un plano de
 * arquitectura.
 */
export function centroide(poligono: Punto[]): Punto | null {
  if (poligono.length === 0) return null
  if (poligono.length < VERTICES_MINIMOS) return promedio(poligono)

  let area2 = 0
  let cx = 0
  let cy = 0

  for (let i = 0; i < poligono.length; i++) {
    const a = poligono[i]!
    const b = poligono[(i + 1) % poligono.length]!
    const cruz = a.x * b.y - b.x * a.y
    area2 += cruz
    cx += (a.x + b.x) * cruz
    cy += (a.y + b.y) * cruz
  }

  // Polígono degenerado (todos los vértices alineados): el centroide por áreas
  // se indefine y el promedio es lo mejor que hay.
  if (Math.abs(area2) < 1e-12) return promedio(poligono)

  return { x: cx / (3 * area2), y: cy / (3 * area2) }
}

function promedio(puntos: Punto[]): Punto {
  const n = puntos.length
  return {
    x: puntos.reduce((s, p) => s + p.x, 0) / n,
    y: puntos.reduce((s, p) => s + p.y, 0) / n,
  }
}

/**
 * ¿El contorno se cruza consigo mismo?
 *
 * Importa porque la fórmula de Gauss no se queja de un polígono cruzado: le
 * resta el área del lóbulo invertido y devuelve un número más chico, sin aviso.
 * Vale más advertirlo que dar una superficie que parece razonable y no lo es.
 *
 * `abierto` mira sólo los lados dibujados, sin cerrar el último con el primero:
 * sirve para avisar mientras se marca.
 */
export function seCruzaConsigoMismo(poligono: Punto[], abierto = false): boolean {
  const n = poligono.length
  if (n < 4) return false

  const lados: Array<[Punto, Punto]> = []
  const hasta = abierto ? n - 1 : n
  for (let i = 0; i < hasta; i++) {
    lados.push([poligono[i]!, poligono[(i + 1) % n]!])
  }

  for (let i = 0; i < lados.length; i++) {
    for (let j = i + 2; j < lados.length; j++) {
      // Los lados consecutivos comparten un vértice, y en el contorno cerrado
      // el primero y el último también: tocarse ahí no es cruzarse.
      if (!abierto && i === 0 && j === lados.length - 1) continue

      const [a1, a2] = lados[i]!
      const [b1, b2] = lados[j]!
      if (seCortan(a1, a2, b1, b2)) return true
    }
  }

  return false
}

/** Cruce propio de dos segmentos: se ignora el contacto en un extremo. */
function seCortan(a1: Punto, a2: Punto, b1: Punto, b2: Punto): boolean {
  const d1 = orientacion(b1, b2, a1)
  const d2 = orientacion(b1, b2, a2)
  const d3 = orientacion(a1, a2, b1)
  const d4 = orientacion(a1, a2, b2)

  return d1 * d2 < 0 && d3 * d4 < 0
}

function orientacion(p: Punto, q: Punto, r: Punto): number {
  const v = (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
  if (Math.abs(v) < 1e-12) return 0
  return v > 0 ? 1 : -1
}

/** ¿El punto ya marcado cierra el contorno, por caer sobre el primer vértice? */
export function cierraElContorno(poligono: Punto[], punto: Punto, radio: number): boolean {
  const primero = poligono[0]
  if (!primero || poligono.length < VERTICES_MINIMOS) return false
  return distancia(punto, primero) <= radio
}

// ---------------------------------------------------------------------------
// Ambientes
// ---------------------------------------------------------------------------

/** Dos decimales: es la precisión con la que se rotula una superficie en un plano. */
const redondear = (v: number): number => Number(v.toFixed(2))

export interface DatosNuevoAmbiente {
  id: string
  nombre: string
  tipo: TipoAmbiente
  poligono: Punto[]
  escala: Escala | null
}

/**
 * Arma un ambiente a partir del contorno marcado en el plano.
 *
 * Devuelve `null` si no se puede medir: un ambiente sin superficie real no
 * aporta nada al cálculo y ensuciaría la cadena normativa con un cero.
 */
export function ambienteDesdePoligono(datos: DatosNuevoAmbiente): Ambiente | null {
  const medidas = medirPoligono(datos.poligono, datos.escala)
  if (!medidas || medidas.superficieM2 <= 0) return null

  const ambiente: Ambiente = {
    id: datos.id,
    nombre: datos.nombre,
    tipo: datos.tipo,
    superficieM2: redondear(medidas.superficieM2),
    poligono: datos.poligono,
  }

  if (midePorLongitud(datos.tipo)) {
    ambiente.longitudM = redondear(medidas.longitudMayorM)
  }

  return ambiente
}

/**
 * Pasillos y semicubiertos se miden por longitud, no por superficie
 * (Tabla 770.7.III: "una boca por cada 5 m de longitud o fracción").
 */
export function midePorLongitud(tipo: TipoAmbiente): boolean {
  return tipo === 'pasillo' || tipo === 'semicubierto'
}

/**
 * Vuelve a medir un ambiente delimitado con la escala vigente.
 *
 * Hace falta cuando la escala cambia después de haber marcado el contorno: un
 * plano raster que se calibra recién ahora, o un DXF sin unidades al que se le
 * confirma la unidad. Los ambientes cargados a mano —sin polígono— se devuelven
 * intactos.
 */
export function remedirAmbiente(ambiente: Ambiente, escala: Escala | null): Ambiente {
  if (!ambiente.poligono) return ambiente

  const medidas = medirPoligono(ambiente.poligono, escala)
  if (!medidas || medidas.superficieM2 <= 0) return ambiente

  const remedido: Ambiente = { ...ambiente, superficieM2: redondear(medidas.superficieM2) }

  if (midePorLongitud(ambiente.tipo)) remedido.longitudM = redondear(medidas.longitudMayorM)
  else delete remedido.longitudM

  return remedido
}

export interface SuperficiesInmueble {
  cubiertaM2: number
  semicubiertaM2: number
}

/**
 * Superficies del inmueble como suma de sus ambientes.
 *
 * Los semicubiertos van aparte porque computan al 50 % para el límite de
 * aplicación (770.7.3).
 */
export function superficiesDeAmbientes(ambientes: Ambiente[]): SuperficiesInmueble {
  let cubierta = 0
  let semicubierta = 0

  for (const a of ambientes) {
    if (a.tipo === 'semicubierto') semicubierta += a.superficieM2
    else cubierta += a.superficieM2
  }

  return { cubiertaM2: redondear(cubierta), semicubiertaM2: redondear(semicubierta) }
}

/** Igualdad al centímetro cuadrado: alcanza para comparar superficies rotuladas. */
export function mismaSuperficie(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005
}
