/**
 * Enganche (snapping) a la geometría del CAD.
 *
 * Es lo que hace que un tramo dibujado sobre un DXF mida exactamente lo que
 * mide el plano: los vértices caen sobre puntos reales del dibujo en lugar de
 * donde el mouse haya quedado.
 *
 * El índice es una grilla uniforme sobre la bbox. Para un plano de vivienda
 * (miles de segmentos, no millones) rinde de sobra y evita meter una
 * dependencia de R-tree.
 */

import type { BBox, EntidadCAD, Punto } from '@/dominio/tipos'

export type TipoSnap = 'extremo' | 'medio' | 'interseccion' | 'perpendicular' | 'sobre_entidad'

export interface Snap {
  punto: Punto
  tipo: TipoSnap
  /** Distancia al cursor, en unidades del plano. */
  distancia: number
}

/** Prioridad de cada tipo de enganche: a igual distancia, gana el más preciso. */
const PRIORIDAD: Record<TipoSnap, number> = {
  extremo: 0,
  interseccion: 1,
  medio: 2,
  perpendicular: 3,
  sobre_entidad: 4,
}

interface Segmento {
  a: Punto
  b: Punto
}

export class IndiceEspacial {
  private readonly celdas = new Map<string, Segmento[]>()
  private readonly tamCelda: number
  private readonly segmentos: Segmento[] = []

  constructor(entidades: EntidadCAD[], bbox: BBox, celdasPorLado = 64) {
    const ancho = Math.max(bbox.max.x - bbox.min.x, 1e-9)
    const alto = Math.max(bbox.max.y - bbox.min.y, 1e-9)
    this.tamCelda = Math.max(ancho, alto) / celdasPorLado

    for (const e of entidades) {
      for (const seg of segmentosDe(e)) {
        this.segmentos.push(seg)
        this.indexar(seg)
      }
    }
  }

  private clave(x: number, y: number): string {
    return `${Math.floor(x / this.tamCelda)}:${Math.floor(y / this.tamCelda)}`
  }

  private indexar(seg: Segmento): void {
    // Se registra el segmento en todas las celdas que toca su bbox. Para
    // segmentos cortos (lo habitual en un plano) son una o dos celdas.
    const minX = Math.min(seg.a.x, seg.b.x)
    const maxX = Math.max(seg.a.x, seg.b.x)
    const minY = Math.min(seg.a.y, seg.b.y)
    const maxY = Math.max(seg.a.y, seg.b.y)

    for (let x = minX; x <= maxX + this.tamCelda; x += this.tamCelda) {
      for (let y = minY; y <= maxY + this.tamCelda; y += this.tamCelda) {
        const k = this.clave(x, y)
        const lista = this.celdas.get(k)
        if (lista) lista.push(seg)
        else this.celdas.set(k, [seg])
      }
    }
  }

  /** Segmentos cercanos a un punto, mirando la celda y sus ocho vecinas. */
  cercanos(p: Punto): Segmento[] {
    const vistos = new Set<Segmento>()
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const lista = this.celdas.get(this.clave(p.x + dx * this.tamCelda, p.y + dy * this.tamCelda))
        if (lista) for (const s of lista) vistos.add(s)
      }
    }
    return [...vistos]
  }

  /**
   * Mejor enganche para un punto, dentro de un radio dado.
   *
   * `tiposActivos` permite apagar tipos de snap desde la UI.
   */
  snap(p: Punto, radio: number, tiposActivos?: Set<TipoSnap>): Snap | null {
    const activo = (t: TipoSnap) => !tiposActivos || tiposActivos.has(t)
    const candidatos: Snap[] = []
    const cerca = this.cercanos(p)

    for (const seg of cerca) {
      if (activo('extremo')) {
        for (const extremo of [seg.a, seg.b]) {
          const d = dist(p, extremo)
          if (d <= radio) candidatos.push({ punto: extremo, tipo: 'extremo', distancia: d })
        }
      }

      if (activo('medio')) {
        const medio = { x: (seg.a.x + seg.b.x) / 2, y: (seg.a.y + seg.b.y) / 2 }
        const d = dist(p, medio)
        if (d <= radio) candidatos.push({ punto: medio, tipo: 'medio', distancia: d })
      }

      if (activo('perpendicular') || activo('sobre_entidad')) {
        const proy = proyectarEnSegmento(p, seg)
        const d = dist(p, proy.punto)
        if (d <= radio) {
          // Si la proyección cae dentro del segmento es un pie de
          // perpendicular; si cae en un extremo, ya lo cubre el snap de extremo.
          const tipo: TipoSnap = proy.dentro ? 'perpendicular' : 'sobre_entidad'
          if (activo(tipo)) candidatos.push({ punto: proy.punto, tipo, distancia: d })
        }
      }
    }

    if (activo('interseccion')) {
      for (let i = 0; i < cerca.length; i++) {
        for (let j = i + 1; j < cerca.length; j++) {
          const x = interseccion(cerca[i]!, cerca[j]!)
          if (!x) continue
          const d = dist(p, x)
          if (d <= radio) candidatos.push({ punto: x, tipo: 'interseccion', distancia: d })
        }
      }
    }

    if (candidatos.length === 0) return null

    candidatos.sort((a, b) => {
      const dp = PRIORIDAD[a.tipo] - PRIORIDAD[b.tipo]
      // Un extremo un poco más lejos gana a una proyección más cerca: es el
      // punto que el dibujante realmente marcó.
      if (dp !== 0 && Math.abs(a.distancia - b.distancia) < radio * 0.5) return dp
      return a.distancia - b.distancia
    })

    return candidatos[0]!
  }
}

// ---------------------------------------------------------------------------
// Geometría auxiliar
// ---------------------------------------------------------------------------

function dist(a: Punto, b: Punto): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** Descompone una entidad en segmentos rectos. */
export function segmentosDe(e: EntidadCAD): Segmento[] {
  switch (e.tipo) {
    case 'linea':
      return [{ a: e.a, b: e.b }]

    case 'polilinea': {
      const segs: Segmento[] = []
      for (let i = 1; i < e.puntos.length; i++) {
        segs.push({ a: e.puntos[i - 1]!, b: e.puntos[i]! })
      }
      if (e.cerrada && e.puntos.length > 2) {
        segs.push({ a: e.puntos[e.puntos.length - 1]!, b: e.puntos[0]! })
      }
      return segs
    }

    case 'circulo':
    case 'arco':
      // Se aproximan con 24 segmentos: alcanza para enganchar y evita tratar
      // curvas como caso especial en todo el índice.
      return discretizarArco(e)

    case 'texto':
      return []
  }
}

function discretizarArco(
  e: Extract<EntidadCAD, { tipo: 'arco' | 'circulo' }>,
  pasos = 24,
): Segmento[] {
  const desde = e.tipo === 'arco' ? (e.desdeGrados * Math.PI) / 180 : 0
  const hasta = e.tipo === 'arco' ? (e.hastaGrados * Math.PI) / 180 : Math.PI * 2

  const segs: Segmento[] = []
  let previo: Punto | null = null

  for (let i = 0; i <= pasos; i++) {
    const ang = desde + ((hasta - desde) * i) / pasos
    const p = {
      x: e.centro.x + e.radio * Math.cos(ang),
      y: e.centro.y + e.radio * Math.sin(ang),
    }
    if (previo) segs.push({ a: previo, b: p })
    previo = p
  }
  return segs
}

/** Proyección de un punto sobre un segmento, acotada a sus extremos. */
function proyectarEnSegmento(p: Punto, seg: Segmento): { punto: Punto; dentro: boolean } {
  const dx = seg.b.x - seg.a.x
  const dy = seg.b.y - seg.a.y
  const largo2 = dx * dx + dy * dy

  if (largo2 === 0) return { punto: seg.a, dentro: false }

  const t = ((p.x - seg.a.x) * dx + (p.y - seg.a.y) * dy) / largo2
  const tc = Math.max(0, Math.min(1, t))

  return {
    punto: { x: seg.a.x + tc * dx, y: seg.a.y + tc * dy },
    dentro: t > 0.001 && t < 0.999,
  }
}

/** Intersección de dos segmentos, o `null` si no se cruzan. */
function interseccion(s1: Segmento, s2: Segmento): Punto | null {
  const d1x = s1.b.x - s1.a.x
  const d1y = s1.b.y - s1.a.y
  const d2x = s2.b.x - s2.a.x
  const d2y = s2.b.y - s2.a.y

  const den = d1x * d2y - d1y * d2x
  if (Math.abs(den) < 1e-12) return null // paralelos

  const t = ((s2.a.x - s1.a.x) * d2y - (s2.a.y - s1.a.y) * d2x) / den
  const u = ((s2.a.x - s1.a.x) * d1y - (s2.a.y - s1.a.y) * d1x) / den

  if (t < 0 || t > 1 || u < 0 || u > 1) return null

  return { x: s1.a.x + t * d1x, y: s1.a.y + t * d1y }
}

/**
 * Fuerza un punto a la ortogonal respecto de otro: sólo horizontal o vertical,
 * la que esté más cerca.
 *
 * 770.10.3.1 exige que el recorrido de las canalizaciones respete la
 * ortogonalidad de los ambientes, así que esto no es una comodidad de dibujo.
 */
export function forzarOrtogonal(desde: Punto, hasta: Punto): Punto {
  const dx = Math.abs(hasta.x - desde.x)
  const dy = Math.abs(hasta.y - desde.y)
  return dx >= dy ? { x: hasta.x, y: desde.y } : { x: desde.x, y: hasta.y }
}
