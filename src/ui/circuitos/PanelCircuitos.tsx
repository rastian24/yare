/** Gestión de circuitos y planilla de cálculo por circuito (770-A.1.1). */

import { useApp, nuevoId } from '@/estado/store'
import { useCalculo } from '@/estado/useCalculo'
import { SECCIONES_COMERCIALES, TIPOS_CIRCUITO, CALIBRES_PROTECCION } from '@/normativa/aea770/tablas'
import { severidadMaxima } from '@/normativa/aea770/motor'
import { amp, metros, mm2, pct, va } from '@/dominio/formato'
import type { TipoCircuito } from '@/dominio/tipos'

const COLOR: Record<TipoCircuito, string> = {
  IUG: 'bg-amber-500',
  TUG: 'bg-blue-600',
  TUE: 'bg-red-600',
}

export function PanelCircuitos() {
  const { proyecto, circuitoActivo, seleccion } = useApp()
  const { agregarCircuito, actualizarCircuito, borrarCircuito, setCircuitoActivo, asignarACircuito } =
    useApp()
  const { calculado, validacion } = useCalculo()

  const crear = (tipo: TipoCircuito) => {
    const n = proyecto.circuitos.filter((c) => c.tipo === tipo).length + 1
    agregarCircuito({
      id: nuevoId('c'),
      nombre: `${tipo} ${n}`,
      tipo,
      // Se arranca en la sección mínima admisible del tipo (Tabla 770.11.I).
      seccionMm2: tipo === 'IUG' ? 1.5 : 2.5,
      proteccionIn: tipo === 'IUG' ? 10 : tipo === 'TUG' ? 16 : 20,
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1.5 border-b border-slate-200 px-3 py-2">
        <span className="text-xs text-slate-500">Agregar:</span>
        {(['IUG', 'TUG', 'TUE'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => crear(t)}
            className="rounded border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            + {t}
          </button>
        ))}

        {seleccion.length > 0 && circuitoActivo && (
          <button
            type="button"
            onClick={() => asignarACircuito(seleccion, circuitoActivo)}
            className="ml-auto rounded bg-sky-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-sky-700"
          >
            Asignar {seleccion.length} boca(s)
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {calculado.circuitos.length === 0 && (
          <p className="p-4 text-sm text-slate-500">
            Todavía no hay circuitos. El grado {calculado.grado} exige{' '}
            {calculado.minimoCircuitos.totalRequerido} como mínimo (Tabla 770.7.II).
          </p>
        )}

        {calculado.circuitos.map((c) => {
          const hallazgos = validacion.porCircuito.get(c.circuito.id)
          const sev = severidadMaxima(hallazgos?.filter((h) => h.severidad !== 'info'))
          const activo = circuitoActivo === c.circuito.id

          return (
            <div
              key={c.circuito.id}
              className={[
                'cursor-pointer border-b border-slate-100 px-3 py-2.5',
                activo ? 'bg-sky-50' : 'hover:bg-slate-50',
              ].join(' ')}
              onClick={() => setCircuitoActivo(activo ? null : c.circuito.id)}
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${COLOR[c.circuito.tipo]}`} />

                <input
                  value={c.circuito.nombre}
                  onChange={(e) =>
                    actualizarCircuito(c.circuito.id, { nombre: e.target.value })
                  }
                  // El clic no debe alternar la fila (si no, editar el nombre
                  // deselecciona el circuito), pero enfocar el campo sí lo
                  // selecciona: si alguien va a escribir acá, está trabajando
                  // sobre ese circuito.
                  onClick={(e) => e.stopPropagation()}
                  onFocus={() => setCircuitoActivo(c.circuito.id)}
                  className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-sm font-medium hover:border-slate-300 focus:border-sky-400 focus:outline-none"
                />

                {sev && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                      sev === 'error' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {sev}
                  </span>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    borrarCircuito(c.circuito.id)
                  }}
                  className="text-xs text-slate-400 hover:text-red-600"
                  title="Eliminar circuito"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <Campo
                  etiqueta="Sección"
                  onClick={(e) => e.stopPropagation()}
                  control={
                    <select
                      value={c.circuito.seccionMm2}
                      onChange={(e) =>
                        actualizarCircuito(c.circuito.id, { seccionMm2: Number(e.target.value) })
                      }
                      className="w-full rounded border border-slate-300 bg-white px-1 py-0.5"
                    >
                      {SECCIONES_COMERCIALES.filter((s) => s >= 1 && s <= 25).map((s) => (
                        <option key={s} value={s}>
                          {mm2(s)}
                        </option>
                      ))}
                    </select>
                  }
                />

                <Campo
                  etiqueta="Protección"
                  onClick={(e) => e.stopPropagation()}
                  control={
                    <select
                      value={c.circuito.proteccionIn}
                      onChange={(e) =>
                        actualizarCircuito(c.circuito.id, { proteccionIn: Number(e.target.value) })
                      }
                      className="w-full rounded border border-slate-300 bg-white px-1 py-0.5"
                    >
                      {CALIBRES_PROTECCION.filter(
                        (a) => a <= TIPOS_CIRCUITO[c.circuito.tipo].maxProteccionA,
                      ).map((a) => (
                        <option key={a} value={a}>
                          {a} A
                        </option>
                      ))}
                    </select>
                  }
                />
              </div>

              <dl className="mt-1.5 grid grid-cols-4 gap-x-2 text-[11px] text-slate-600">
                <Dato etiqueta="Bocas" valor={`${c.bocas}/${c.maxBocas}`} />
                <Dato etiqueta="DPMS" valor={va(c.dpmsVA)} />
                <Dato etiqueta="Ib" valor={amp(c.ibA)} />
                <Dato
                  etiqueta="Iz"
                  valor={amp(c.izA)}
                  nota={c.factorAgrupamiento < 1 ? `×${c.factorAgrupamiento}` : undefined}
                />
                <Dato
                  etiqueta="Longitud"
                  valor={c.longitudM !== null ? metros(c.longitudM, 1) : '—'}
                />
                <Dato
                  etiqueta="ΔU"
                  valor={c.caidaPct !== null ? pct(c.caidaPct) : '—'}
                  alerta={
                    c.caidaPct !== null && c.caidaPct > proyecto.suministro.caidaTensionMaxPct
                  }
                />
                <Dato etiqueta="PE" valor={mm2(c.seccionPEMm2)} />
                {c.circuito.tipo === 'IUG' && (
                  <label
                    className="col-span-1 flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={c.circuito.conTomasDerivados ?? false}
                      onChange={(e) =>
                        actualizarCircuito(c.circuito.id, {
                          conTomasDerivados: e.target.checked,
                        })
                      }
                    />
                    <span title="Cambia la DPMS y la sección mínima (Tablas 770.8.I y 770.11.I)">
                      c/tomas
                    </span>
                  </label>
                )}
              </dl>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Campo({
  etiqueta,
  control,
  onClick,
}: {
  etiqueta: string
  control: React.ReactNode
  onClick: (e: React.MouseEvent) => void
}) {
  return (
    <label className="block" onClick={onClick}>
      <span className="mb-0.5 block text-slate-500">{etiqueta}</span>
      {control}
    </label>
  )
}

function Dato({
  etiqueta,
  valor,
  nota,
  alerta,
}: {
  etiqueta: string
  valor: string
  nota?: string
  alerta?: boolean
}) {
  return (
    <div>
      <dt className="text-slate-400">{etiqueta}</dt>
      <dd className={`tabular-nums ${alerta ? 'font-medium text-red-600' : ''}`}>
        {valor}
        {nota && <span className="ml-0.5 text-slate-400">{nota}</span>}
      </dd>
    </div>
  )
}
