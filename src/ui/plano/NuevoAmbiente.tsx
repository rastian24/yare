/**
 * Confirmación del ambiente recién delimitado sobre el plano.
 *
 * La superficie ya está medida y no se discute: sale del contorno marcado y de
 * la escala del plano. Lo que sí se pregunta es el tipo, que no se puede
 * inferir del dibujo y es justo el dato del que dependen los mínimos de la
 * Tabla 770.7.III.
 */

import { useMemo, useState } from 'react'
import {
  medirPoligono,
  midePorLongitud,
  seCruzaConsigoMismo,
} from '@/dominio/calculo/ambientes'
import { m2, metros } from '@/dominio/formato'
import { TIPOS_AMBIENTE } from '@/ui/comun/tiposAmbiente'
import type { Escala, Punto, TipoAmbiente } from '@/dominio/tipos'

export function NuevoAmbiente({
  poligono,
  escala,
  bocasAdentro,
  onCrear,
  onCancelar,
}: {
  poligono: Punto[]
  escala: Escala | null
  /** Bocas sin ambiente que caen dentro del contorno y quedarían asignadas. */
  bocasAdentro: number
  onCrear: (nombre: string, tipo: TipoAmbiente) => void
  onCancelar: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState<TipoAmbiente>('estar')

  const medidas = useMemo(() => medirPoligono(poligono, escala), [poligono, escala])
  const cruzado = useMemo(() => seCruzaConsigoMismo(poligono), [poligono])

  if (!medidas) return null

  const nombreFinal = nombre.trim() || 'Ambiente'

  return (
    <div className="absolute right-3 top-3 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
      <h3 className="mb-2 text-sm font-medium text-slate-800">Nuevo ambiente</h3>

      <p className="text-2xl font-semibold tabular-nums text-slate-800">
        {m2(medidas.superficieM2)}
      </p>
      <p className="mb-3 text-xs text-slate-500">
        {poligono.length} vértices · perímetro {metros(medidas.perimetroM)} · escala{' '}
        {escala?.origen === 'archivo' ? 'del CAD' : 'calibrada'}
      </p>

      {cruzado && (
        <p className="mb-3 rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
          El contorno se cruza consigo mismo, así que la superficie puede no ser la que se ve.
          Conviene rehacerlo.
        </p>
      )}

      <label className="mb-2 block text-xs">
        <span className="mb-0.5 block text-slate-500">Nombre</span>
        <input
          autoFocus
          value={nombre}
          placeholder="Ambiente"
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCrear(nombreFinal, tipo)
          }}
          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </label>

      <label className="mb-2 block text-xs">
        <span className="mb-0.5 block text-slate-500">Tipo (Tabla 770.7.III)</span>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoAmbiente)}
          className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
        >
          {TIPOS_AMBIENTE.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.etiqueta}
            </option>
          ))}
        </select>
      </label>

      {midePorLongitud(tipo) && (
        <p className="mb-2 text-xs text-slate-600">
          Se computa por longitud: {metros(medidas.longitudMayorM)} (una boca cada 5 m o fracción).
        </p>
      )}

      {bocasAdentro > 0 && (
        <p className="mb-2 text-xs text-slate-600">
          {bocasAdentro} {bocasAdentro === 1 ? 'boca queda' : 'bocas quedan'} dentro del contorno y
          se {bocasAdentro === 1 ? 'asigna' : 'asignan'} a este ambiente.
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onCrear(nombreFinal, tipo)}
          className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
        >
          Crear ambiente
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Descartar
        </button>
      </div>
    </div>
  )
}
