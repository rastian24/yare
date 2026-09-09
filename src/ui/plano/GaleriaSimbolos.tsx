/** Galería de simbología, para elegir qué colocar sobre el plano. */

import { useApp } from '@/estado/store'
import {
  NOMBRES_CATEGORIA,
  SIMBOLOS,
  type CategoriaSimbolo,
  type Simbolo,
} from '@/simbologia/catalogo'

const ORDEN: CategoriaSimbolo[] = [
  'iluminacion',
  'tomacorriente',
  'interruptor',
  'caja',
  'tablero',
  'puesta_tierra',
]

export function GaleriaSimbolos() {
  const { simboloActivo, setSimboloActivo, circuitoActivo, proyecto } = useApp()
  const circuito = proyecto.circuitos.find((c) => c.id === circuitoActivo)

  return (
    <div className="flex flex-col gap-4">
      {ORDEN.map((categoria) => {
        const simbolos = SIMBOLOS.filter((s) => s.categoria === categoria)
        if (simbolos.length === 0) return null

        return (
          <div key={categoria}>
            <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
              {NOMBRES_CATEGORIA[categoria]}
            </h3>
            <div className="grid grid-cols-4 gap-1">
              {simbolos.map((s) => (
                <BotonSimbolo
                  key={s.id}
                  simbolo={s}
                  activo={simboloActivo === s.id}
                  // Se marca el símbolo que no corresponde al circuito activo,
                  // sin bloquearlo: puede colocarse y asignarse después.
                  incompatible={
                    circuito !== undefined &&
                    s.circuitosPermitidos.length > 0 &&
                    !s.circuitosPermitidos.includes(circuito.tipo)
                  }
                  onClick={() => setSimboloActivo(simboloActivo === s.id ? null : s.id)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function BotonSimbolo({
  simbolo,
  activo,
  incompatible,
  onClick,
}: {
  simbolo: Simbolo
  activo: boolean
  incompatible: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${simbolo.nombre}${simbolo.nota ? `\n\n${simbolo.nota}` : ''}`}
      className={[
        'flex aspect-square items-center justify-center rounded border transition',
        activo
          ? 'border-sky-500 bg-sky-50 text-sky-700'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400',
        incompatible ? 'opacity-40' : '',
      ].join(' ')}
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7">
        <g dangerouslySetInnerHTML={{ __html: simbolo.svg }} />
      </svg>
    </button>
  )
}
