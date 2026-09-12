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
      {/* Sin esto no se ve a qué circuito va a parar la boca que se coloque, y
          una boca sin circuito no computa cable ni tiene protección. */}
      <p
        className={[
          'rounded px-2 py-1.5 text-xs',
          circuito ? 'bg-sky-50 text-sky-900' : 'bg-amber-50 text-amber-900',
        ].join(' ')}
      >
        {circuito ? (
          <>
            Las bocas se asignan a <strong>{circuito.nombre}</strong>.
          </>
        ) : (
          <>
            No hay circuito activo: las bocas quedan sin asignar. Elegí uno en la pestaña
            Circuitos.
          </>
        )}
      </p>

      {ORDEN.map((categoria) => {
        const simbolos = SIMBOLOS.filter((s) => s.categoria === categoria)
        if (simbolos.length === 0) return null

        return (
          <div key={categoria}>
            <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
              {NOMBRES_CATEGORIA[categoria]}
            </h3>
            <div className="grid grid-cols-3 gap-1">
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
      // El título sigue llevando el nombre completo y la nota normativa, que no
      // entran en la etiqueta.
      title={`${simbolo.nombre}${simbolo.nota ? `\n\n${simbolo.nota}` : ''}`}
      className={[
        'flex flex-col items-center gap-1 rounded border px-1 py-1.5 transition',
        activo
          ? 'border-sky-500 bg-sky-50 text-sky-700'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400',
        incompatible ? 'opacity-40' : '',
      ].join(' ')}
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0">
        <g dangerouslySetInnerHTML={{ __html: simbolo.svg }} />
      </svg>
      <span className="w-full text-center text-[10px] leading-tight hyphens-auto break-words">
        {simbolo.nombreCorto}
      </span>
    </button>
  )
}
