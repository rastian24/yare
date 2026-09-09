/**
 * Panel de hallazgos normativos.
 *
 * Cada hallazgo muestra la cláusula que lo funda. Es la diferencia entre una
 * herramienta de dibujo y una de verificación: sin la cita, un mensaje de error
 * es una opinión.
 */

import { useState } from 'react'
import { useCalculo } from '@/estado/useCalculo'
import { useApp } from '@/estado/store'
import type { Hallazgo, Severidad } from '@/dominio/tipos'

const ESTILO: Record<
  Severidad,
  { chip: string; texto: string; etiqueta: string; singular: string; plural: string }
> = {
  error: {
    chip: 'bg-red-100 text-red-800',
    texto: 'text-red-900',
    etiqueta: 'Error',
    singular: 'error',
    // "error" + "s" da "errors": el plural en castellano necesita la tabla.
    plural: 'errores',
  },
  advertencia: {
    chip: 'bg-amber-100 text-amber-800',
    texto: 'text-amber-900',
    etiqueta: 'Advertencia',
    singular: 'advertencia',
    plural: 'advertencias',
  },
  info: {
    chip: 'bg-slate-100 text-slate-700',
    texto: 'text-slate-700',
    etiqueta: 'Info',
    singular: 'informativo',
    plural: 'informativos',
  },
}

export function PanelHallazgos() {
  const { validacion } = useCalculo()
  const [mostrarInfo, setMostrarInfo] = useState(false)

  const visibles = mostrarInfo
    ? validacion.hallazgos
    : validacion.hallazgos.filter((h) => h.severidad !== 'info')

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
        <Contador cantidad={validacion.errores} severidad="error" />
        <Contador cantidad={validacion.advertencias} severidad="advertencia" />

        <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={mostrarInfo}
            onChange={(e) => setMostrarInfo(e.target.checked)}
          />
          Ver informativos
        </label>
      </div>

      <div className="flex-1 overflow-y-auto">
        {visibles.length === 0 ? (
          <p className="p-4 text-sm text-emerald-700">
            {validacion.conforme
              ? 'Sin observaciones. El proyecto cumple las verificaciones implementadas de la Sección 770.'
              : 'Sin observaciones visibles.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visibles.map((h) => (
              <FilaHallazgo key={h.id} hallazgo={h} />
            ))}
          </ul>
        )}
      </div>

      <p className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
        Verificación asistida según AEA 90364-7-770. No reemplaza la firma de un profesional
        matriculado.
      </p>
    </div>
  )
}

function Contador({ cantidad, severidad }: { cantidad: number; severidad: Severidad }) {
  const e = ESTILO[severidad]
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${e.chip}`}>
      {cantidad} {cantidad === 1 ? e.singular : e.plural}
    </span>
  )
}

function FilaHallazgo({ hallazgo }: { hallazgo: Hallazgo }) {
  const { setSeleccion, setCircuitoActivo } = useApp()
  const e = ESTILO[hallazgo.severidad]

  const irAlAfectado = () => {
    if (hallazgo.alcance.tipo === 'circuito') setCircuitoActivo(hallazgo.alcance.id)
    if (hallazgo.alcance.tipo === 'boca') setSeleccion([hallazgo.alcance.id])
  }

  const navegable = hallazgo.alcance.tipo === 'circuito' || hallazgo.alcance.tipo === 'boca'

  return (
    <li className="px-3 py-2.5 hover:bg-slate-50">
      <div className="mb-1 flex items-center gap-2">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${e.chip}`}>
          {e.etiqueta}
        </span>
        <span className="font-mono text-xs text-slate-500">{hallazgo.clausula}</span>
      </div>

      <p className={`text-sm ${e.texto}`}>{hallazgo.mensaje}</p>

      {hallazgo.sugerencia && (
        <p className="mt-1 text-xs text-slate-600">→ {hallazgo.sugerencia}</p>
      )}

      {navegable && (
        <button
          type="button"
          onClick={irAlAfectado}
          className="mt-1 text-xs text-sky-600 hover:underline"
        >
          Ver el elemento afectado
        </button>
      )}
    </li>
  )
}
