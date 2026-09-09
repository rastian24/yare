/** Un símbolo colocado sobre el plano. */

import { memo } from 'react'
import type { Simbolo } from '@/simbologia/catalogo'
import type { Punto } from '@/dominio/tipos'

interface Props {
  simbolo: Simbolo
  posicion: Punto
  color: string
  /** Factor de la vista, para que el símbolo mantenga tamaño en pantalla. */
  escala: number
  seleccionado?: boolean
  onMouseDown?: (ev: React.MouseEvent) => void
}

/** Los símbolos se dibujan en una caja de 24 × 24 centrada en (12, 12). */
const LADO = 24

export const SimboloSVG = memo(function SimboloSVG({
  simbolo,
  posicion,
  color,
  escala,
  seleccionado,
  onMouseDown,
}: Props) {
  const s = escala
  const offset = (LADO / 2) * s

  return (
    <g
      transform={`translate(${posicion.x - offset}, ${posicion.y - offset}) scale(${s})`}
      style={{ color, cursor: onMouseDown ? 'move' : 'default' }}
      onMouseDown={onMouseDown}
    >
      {/* Área de captura, para poder agarrar el símbolo sin acertarle al trazo. */}
      <rect width={LADO} height={LADO} fill="white" fillOpacity={0.01} />

      {seleccionado && (
        <rect
          width={LADO}
          height={LADO}
          fill="none"
          stroke="#0ea5e9"
          strokeWidth={1.5}
          strokeDasharray="3 2"
        />
      )}

      <g dangerouslySetInnerHTML={{ __html: simbolo.svg }} />
    </g>
  )
})
