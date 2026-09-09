/**
 * Longitudes: escala del plano, longitud en planta, tramos verticales y camino
 * desde el tablero hasta la boca más alejada.
 *
 * La longitud es la entrada del cálculo de caída de tensión y del cómputo de
 * cable y caño, así que acá se decide si el proyecto tiene números reales o no.
 * Un plano raster sin calibrar NO produce longitudes: devuelve `null` y la UI
 * lo informa, en lugar de arrojar un número inventado.
 */

import type {
  AlturasMontaje,
  Elemento,
  Escala,
  NivelTramo,
  Plano,
  Punto,
  Tramo,
} from '@/dominio/tipos'

// ---------------------------------------------------------------------------
// Escala
// ---------------------------------------------------------------------------

/** Metros por unidad de dibujo, según $INSUNITS. */
const METROS_POR_UNIDAD_DXF: Record<string, number> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  pulgadas: 0.0254,
  pies: 0.3048,
}

export function distancia(a: Punto, b: Punto): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/**
 * Resuelve la escala de un plano.
 *
 * - DXF con unidades definidas: sale del archivo, sin calibrar nada.
 * - DXF sin unidades ($INSUNITS = 0) o raster: hace falta calibración manual.
 */
export function escalaDe(plano: Plano): Escala {
  const f = plano.fuente

  if (f.tipo === 'dxf' && f.unidades !== 'sin_definir') {
    return {
      metrosPorUnidad: METROS_POR_UNIDAD_DXF[f.unidades] ?? 1,
      calibrado: true,
      origen: 'archivo',
    }
  }

  const cal = f.calibracion
  if (cal) {
    const px = distancia(cal.p1, cal.p2)
    if (px > 0 && cal.metrosReales > 0) {
      return { metrosPorUnidad: cal.metrosReales / px, calibrado: true, origen: 'manual' }
    }
  }

  return { metrosPorUnidad: 0, calibrado: false, origen: 'sin_calibrar' }
}

// ---------------------------------------------------------------------------
// Longitud en planta
// ---------------------------------------------------------------------------

/** Longitud de una polilínea en unidades del plano. */
export function longitudPolilinea(puntos: Punto[]): number {
  let total = 0
  for (let i = 1; i < puntos.length; i++) {
    total += distancia(puntos[i - 1]!, puntos[i]!)
  }
  return total
}

/**
 * Cantidad de curvas de una polilínea, contando los vértices donde la
 * dirección cambia de forma apreciable.
 *
 * 770.10.3.1 admite un máximo de tres curvas entre bocas, cajas o gabinetes.
 */
export function contarCurvas(puntos: Punto[], toleranciaGrados = 10): number {
  let curvas = 0
  for (let i = 1; i < puntos.length - 1; i++) {
    const a = puntos[i - 1]!
    const b = puntos[i]!
    const c = puntos[i + 1]!

    const ang1 = Math.atan2(b.y - a.y, b.x - a.x)
    const ang2 = Math.atan2(c.y - b.y, c.x - b.x)

    let delta = Math.abs((ang2 - ang1) * (180 / Math.PI)) % 360
    if (delta > 180) delta = 360 - delta

    if (delta > toleranciaGrados) curvas++
  }
  return curvas
}

// ---------------------------------------------------------------------------
// Alturas y tramos verticales
// ---------------------------------------------------------------------------

/** Altura a la que corre una canalización según su nivel. */
export function alturaDeTramo(tramo: Tramo, alturas: AlturasMontaje): number {
  if (tramo.alturaM !== undefined) return tramo.alturaM

  const porNivel: Record<NivelTramo, number> = {
    losa: alturas.bocaTechoM,
    piso: 0,
    pared: alturas.interruptorM,
  }
  return porNivel[tramo.nivel]
}

/**
 * Longitud total de un tramo en metros: recorrido en planta más las bajadas y
 * subidas hasta cada elemento que vincula.
 *
 * Una boca de techo alimentando una llave de pared tiene un recorrido vertical
 * que la planta no muestra; ignorarlo subestima el cable y la caída de tensión.
 *
 * Devuelve `null` si el plano no está calibrado.
 */
export function longitudTramo(
  tramo: Tramo,
  plano: Plano,
  elementos: Elemento[],
  alturas: AlturasMontaje,
): { totalM: number; plantaM: number; verticalM: number } | null {
  if (tramo.longitudManualM !== undefined) {
    return { totalM: tramo.longitudManualM, plantaM: tramo.longitudManualM, verticalM: 0 }
  }

  const escala = escalaDe(plano)
  if (!escala.calibrado) return null

  const plantaM = longitudPolilinea(tramo.puntos) * escala.metrosPorUnidad
  const alturaTramo = alturaDeTramo(tramo, alturas)

  const porId = new Map(elementos.map((e) => [e.id, e]))
  let verticalM = 0
  for (const id of tramo.elementoIds) {
    const el = porId.get(id)
    if (!el) continue
    const alturaEl = el.alturaM ?? alturaTramo
    verticalM += Math.abs(alturaEl - alturaTramo)
  }

  return { totalM: plantaM + verticalM, plantaM, verticalM }
}

// ---------------------------------------------------------------------------
// Camino más largo hasta una boca (para caída de tensión)
// ---------------------------------------------------------------------------

interface Arista {
  hasta: string
  longitudM: number
}

/**
 * Longitud desde el tablero hasta la boca más alejada de un circuito, medida
 * sobre el grafo de tramos.
 *
 * 770.15.6 pide considerar los circuitos cargados con su demanda en el extremo
 * más alejado del tablero, así que lo que interesa es el máximo de los caminos
 * mínimos, no la suma de tramos.
 *
 * Devuelve `null` si no hay camino o si falta calibración.
 */
export function longitudHastaBocaMasAlejada(
  tableroId: string,
  bocaIds: string[],
  tramos: Tramo[],
  plano: Plano,
  elementos: Elemento[],
  alturas: AlturasMontaje,
): number | null {
  const grafo = new Map<string, Arista[]>()

  for (const tramo of tramos) {
    const l = longitudTramo(tramo, plano, elementos, alturas)
    if (!l) return null

    // Un tramo vincula sus elementos en cadena. La longitud se reparte
    // proporcionalmente entre los saltos consecutivos.
    const ids = tramo.elementoIds
    if (ids.length < 2) continue

    const porSalto = l.totalM / (ids.length - 1)
    for (let i = 1; i < ids.length; i++) {
      const a = ids[i - 1]!
      const b = ids[i]!
      if (!grafo.has(a)) grafo.set(a, [])
      if (!grafo.has(b)) grafo.set(b, [])
      grafo.get(a)!.push({ hasta: b, longitudM: porSalto })
      grafo.get(b)!.push({ hasta: a, longitudM: porSalto })
    }
  }

  if (!grafo.has(tableroId)) return null

  // Dijkstra sobre un grafo chico: una cola lineal alcanza y sobra.
  const dist = new Map<string, number>([[tableroId, 0]])
  const visitados = new Set<string>()

  while (visitados.size < grafo.size) {
    let actual: string | null = null
    let mejor = Infinity
    for (const [nodo, d] of dist) {
      if (!visitados.has(nodo) && d < mejor) {
        mejor = d
        actual = nodo
      }
    }
    if (actual === null) break

    visitados.add(actual)
    for (const arista of grafo.get(actual) ?? []) {
      const nueva = mejor + arista.longitudM
      if (nueva < (dist.get(arista.hasta) ?? Infinity)) dist.set(arista.hasta, nueva)
    }
  }

  const alcanzables = bocaIds.map((id) => dist.get(id)).filter((d): d is number => d !== undefined)
  if (alcanzables.length === 0) return null

  return Math.max(...alcanzables)
}

// ---------------------------------------------------------------------------
// Áreas
// ---------------------------------------------------------------------------

/**
 * Área de un polígono por la fórmula del área de Gauss (shoelace), en unidades
 * del plano al cuadrado. Devuelve siempre un valor positivo.
 */
export function areaPoligono(puntos: Punto[]): number {
  if (puntos.length < 3) return 0

  let suma = 0
  for (let i = 0; i < puntos.length; i++) {
    const a = puntos[i]!
    const b = puntos[(i + 1) % puntos.length]!
    suma += a.x * b.y - b.x * a.y
  }
  return Math.abs(suma) / 2
}

/** Área de un polígono en m², aplicando la escala del plano. */
export function areaPoligonoM2(puntos: Punto[], escala: Escala): number | null {
  if (!escala.calibrado) return null
  return areaPoligono(puntos) * escala.metrosPorUnidad ** 2
}

/** ¿El punto cae dentro del polígono? Ray casting. */
export function puntoEnPoligono(p: Punto, poligono: Punto[]): boolean {
  let dentro = false
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i]!
    const b = poligono[j]!
    const cruza = a.y > p.y !== b.y > p.y
    if (cruza && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      dentro = !dentro
    }
  }
  return dentro
}
