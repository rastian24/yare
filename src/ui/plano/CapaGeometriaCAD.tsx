/**
 * Dibuja la geometría importada del DXF.
 *
 * Va en su propio componente y memorizado porque un plano de arquitectura trae
 * miles de entidades y no tiene por qué volver a dibujarse cada vez que el
 * mouse se mueve.
 */

import { memo } from 'react'
import type { CapaDXF, EntidadCAD } from '@/dominio/tipos'

interface Props {
  entidades: EntidadCAD[]
  capas: CapaDXF[]
  capasOcultas: Set<string>
  /** Factor de escala de la vista, para que el trazo no engorde al alejarse. */
  grosor: number
}

/** Gris neutro para las capas cuyo color no se puede usar tal cual. */
const NEUTRO = '#94a3b8'

/**
 * Ajusta el color de una capa para que se vea sobre fondo blanco.
 *
 * El índice ACI 7, que es el que traen casi todas las capas de un plano de
 * arquitectura, significa "el inverso del color de fondo": se dibuja negro
 * sobre fondo claro y blanco sobre fondo oscuro. La librería lo entrega como
 * blanco, así que usarlo tal cual deja el plano invisible sobre el lienzo
 * blanco del editor.
 *
 * Por eso los extremos —muy claro o muy oscuro— se llevan a un gris neutro, y
 * sólo se respetan los colores intermedios, que sí son una decisión del
 * dibujante.
 */
function colorLegible(hex: string | undefined): string {
  if (!hex) return NEUTRO

  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return NEUTRO

  const n = parseInt(m[1]!, 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff

  // Luminancia relativa aproximada.
  const luz = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luz > 0.85 || luz < 0.12 ? NEUTRO : hex
}

export const CapaGeometriaCAD = memo(function CapaGeometriaCAD({
  entidades,
  capas,
  capasOcultas,
  grosor,
}: Props) {
  const colorDeCapa = new Map(capas.map((c) => [c.nombre, c.color]))

  return (
    <g pointerEvents="none">
      {entidades.map((e, i) => {
        if (capasOcultas.has(e.capa)) return null

        const color = colorLegible(colorDeCapa.get(e.capa))
        const ancho = 0.8 * grosor

        switch (e.tipo) {
          case 'linea':
            return (
              <line
                key={i}
                x1={e.a.x}
                y1={e.a.y}
                x2={e.b.x}
                y2={e.b.y}
                stroke={color}
                strokeWidth={ancho}
              />
            )

          case 'polilinea':
            return (
              <polyline
                key={i}
                points={e.puntos.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={color}
                strokeWidth={ancho}
              />
            )

          case 'circulo':
            return (
              <circle
                key={i}
                cx={e.centro.x}
                cy={e.centro.y}
                r={e.radio}
                fill="none"
                stroke={color}
                strokeWidth={ancho}
              />
            )

          case 'arco': {
            const desde = (e.desdeGrados * Math.PI) / 180
            const hasta = (e.hastaGrados * Math.PI) / 180
            const x1 = e.centro.x + e.radio * Math.cos(desde)
            const y1 = e.centro.y + e.radio * Math.sin(desde)
            const x2 = e.centro.x + e.radio * Math.cos(hasta)
            const y2 = e.centro.y + e.radio * Math.sin(hasta)
            const mayor = Math.abs(hasta - desde) > Math.PI ? 1 : 0

            return (
              <path
                key={i}
                d={`M ${x1} ${y1} A ${e.radio} ${e.radio} 0 ${mayor} 1 ${x2} ${y2}`}
                fill="none"
                stroke={color}
                strokeWidth={ancho}
              />
            )
          }

          case 'texto':
            // No hace falta reflejar nada: el eje Y ya se invirtió al importar
            // (ver `importarDXF`), así que las coordenadas llegan en el sentido
            // del SVG.
            return (
              <text
                key={i}
                x={e.posicion.x}
                y={e.posicion.y}
                fontSize={e.alturaTexto}
                fill={color}
                className="select-none"
              >
                {e.texto}
              </text>
            )
        }
      })}
    </g>
  )
})
