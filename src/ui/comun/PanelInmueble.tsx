/** Datos del inmueble y del suministro (770.7.3 y 770.4). */

import { useApp, nuevoId } from '@/estado/store'
import { useCalculo } from '@/estado/useCalculo'
import { nombreGrado } from '@/normativa/aea770/electrificacion'
import { amp, kva, m2 } from '@/dominio/formato'
import type { Ambiente, TipoAmbiente } from '@/dominio/tipos'

const TIPOS: Array<{ valor: TipoAmbiente; etiqueta: string }> = [
  { valor: 'estar', etiqueta: 'Estar / comedor / escritorio' },
  { valor: 'dormitorio', etiqueta: 'Dormitorio' },
  { valor: 'cocina', etiqueta: 'Cocina' },
  { valor: 'bano', etiqueta: 'Baño' },
  { valor: 'toilette', etiqueta: 'Toilette' },
  { valor: 'lavadero', etiqueta: 'Lavadero' },
  { valor: 'vestibulo', etiqueta: 'Vestíbulo / garaje / hall' },
  { valor: 'pasillo', etiqueta: 'Pasillo cubierto' },
  { valor: 'semicubierto', etiqueta: 'Balcón / galería / semicubierto' },
]

export function PanelInmueble() {
  const { proyecto, actualizar, actualizarAmbiente, borrarAmbiente } = useApp()
  const { calculado } = useCalculo()
  const { suministro, inmueble } = proyecto

  const agregarAmbiente = () =>
    actualizar((p) =>
      void p.inmueble.ambientes.push({
        id: nuevoId('amb'),
        nombre: 'Nuevo ambiente',
        tipo: 'estar',
        superficieM2: 12,
      }),
    )

  return (
    <div className="space-y-5 p-3">
      {/* --- Grado de electrificación --- */}
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Grado de electrificación
        </h3>

        <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
          <Numero
            etiqueta="Superficie cubierta (m²)"
            valor={inmueble.superficieCubiertaM2}
            paso={0.5}
            onChange={(v) => actualizar((p) => void (p.inmueble.superficieCubiertaM2 = v))}
          />
          <Numero
            etiqueta="Superficie semicubierta (m²)"
            valor={inmueble.superficieSemicubiertaM2}
            paso={0.5}
            onChange={(v) => actualizar((p) => void (p.inmueble.superficieSemicubiertaM2 = v))}
            ayuda="Balcones, galerías, porches: computan al 50 % (770.7.3)"
          />
        </div>

        <p className="text-2xl font-semibold text-slate-800">{nombreGrado(calculado.grado)}</p>
        <p className="mt-1 text-xs text-slate-600">
          {m2(calculado.superficieM2, 1)} de límite de aplicación (cubierta más el 50 % de la
          semicubierta, 770.7.3). Exige {calculado.minimoCircuitos.totalRequerido} circuitos como
          mínimo.
        </p>
        <p className="mt-2 text-xs text-slate-600">
          Carga total: <strong>{kva(calculado.cargaTotalVA)}</strong> · {amp(calculado.corrienteTotalA)} · simultaneidad {calculado.coefSimultaneidad}
        </p>
      </section>

      {/* --- Suministro --- */}
      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Suministro
        </h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label className="block">
            <span className="mb-0.5 block text-xs text-slate-500">Fases</span>
            <select
              value={suministro.fases}
              onChange={(e) =>
                actualizar((p) => {
                  const trifasica = e.target.value === 'trifasica'
                  p.suministro.fases = trifasica ? 'trifasica' : 'monofasica'
                  p.suministro.tensionV = trifasica ? 380 : 220
                })
              }
              className="w-full rounded border border-slate-300 px-2 py-1"
            >
              <option value="monofasica">Monofásica</option>
              <option value="trifasica">Trifásica</option>
            </select>
          </label>

          <Numero
            etiqueta="Tensión (V)"
            valor={suministro.tensionV}
            onChange={(v) => actualizar((p) => void (p.suministro.tensionV = v))}
          />

          <Numero
            etiqueta="ΔU máxima (%)"
            valor={suministro.caidaTensionMaxPct}
            paso={0.5}
            onChange={(v) => actualizar((p) => void (p.suministro.caidaTensionMaxPct = v))}
            ayuda="770.15.6 fija 3 % para circuitos terminales"
          />

          <Numero
            etiqueta="cos φ"
            valor={suministro.cosPhi}
            paso={0.05}
            onChange={(v) => actualizar((p) => void (p.suministro.cosPhi = v))}
          />
        </div>
      </section>

      {/* --- Alturas de montaje --- */}
      <section>
        <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
          Alturas de montaje
        </h3>
        <p className="mb-2 text-xs text-slate-500">
          Definen los tramos verticales que la planta no muestra, y con ellos los metros de cable y
          la caída de tensión.
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Numero
            etiqueta="Boca de techo (m)"
            valor={proyecto.alturas.bocaTechoM}
            paso={0.1}
            onChange={(v) => actualizar((p) => void (p.alturas.bocaTechoM = v))}
          />
          <Numero
            etiqueta="Toma sobre zócalo (m)"
            valor={proyecto.alturas.tomaSobreZocaloM}
            paso={0.05}
            onChange={(v) => actualizar((p) => void (p.alturas.tomaSobreZocaloM = v))}
            ayuda="770.7.2: entre 0,20 y 0,30 m"
          />
          <Numero
            etiqueta="Interruptor (m)"
            valor={proyecto.alturas.interruptorM}
            paso={0.05}
            onChange={(v) => actualizar((p) => void (p.alturas.interruptorM = v))}
          />
          <Numero
            etiqueta="Tablero (m)"
            valor={proyecto.alturas.tableroM}
            paso={0.05}
            onChange={(v) => actualizar((p) => void (p.alturas.tableroM = v))}
          />
        </div>
      </section>

      {/* --- Ambientes --- */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Ambientes ({inmueble.ambientes.length})
          </h3>
          <button
            type="button"
            onClick={agregarAmbiente}
            className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50"
          >
            + Agregar
          </button>
        </div>

        {inmueble.ambientes.length === 0 && (
          <p className="text-xs text-slate-500">
            Cargá los ambientes a mano, o importá un DXF para detectarlos automáticamente.
          </p>
        )}

        <div className="space-y-2">
          {inmueble.ambientes.map((a) => (
            <FilaAmbiente
              key={a.id}
              ambiente={a}
              exigencia={calculado.exigenciasAmbientes.find((e) => e.ambienteId === a.id)}
              onCambio={(cambios) => actualizarAmbiente(a.id, cambios)}
              onBorrar={() => borrarAmbiente(a.id)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function FilaAmbiente({
  ambiente,
  exigencia,
  onCambio,
  onBorrar,
}: {
  ambiente: Ambiente
  exigencia?: { iugRequeridas: number; tugRequeridas: number; modulosRequeridos: number }
  onCambio: (cambios: Partial<Ambiente>) => void
  onBorrar: () => void
}) {
  const porLongitud = ambiente.tipo === 'pasillo' || ambiente.tipo === 'semicubierto'

  return (
    <div className="rounded border border-slate-200 p-2">
      <div className="mb-1.5 flex items-center gap-1.5">
        <input
          value={ambiente.nombre}
          onChange={(e) => onCambio({ nombre: e.target.value })}
          className="min-w-0 flex-1 rounded border border-transparent px-1 text-sm hover:border-slate-300 focus:border-sky-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={onBorrar}
          className="text-xs text-slate-400 hover:text-red-600"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-xs">
        <select
          value={ambiente.tipo}
          onChange={(e) => onCambio({ tipo: e.target.value as TipoAmbiente })}
          className="rounded border border-slate-300 px-1 py-0.5"
        >
          {TIPOS.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.etiqueta}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <input
            type="number"
            step={0.5}
            value={porLongitud ? (ambiente.longitudM ?? 0) : ambiente.superficieM2}
            onChange={(e) =>
              onCambio(
                porLongitud
                  ? { longitudM: Number(e.target.value) }
                  : { superficieM2: Number(e.target.value) },
              )
            }
            className="w-full rounded border border-slate-300 px-1 py-0.5 tabular-nums"
          />
          <span className="text-slate-500">{porLongitud ? 'm' : 'm²'}</span>
        </div>
      </div>

      {exigencia && (
        <p className="mt-1 text-[11px] text-slate-500">
          Mínimo (770.7.5): {exigencia.iugRequeridas} IUG,{' '}
          {exigencia.tugRequeridas + exigencia.modulosRequeridos} TUG
          {exigencia.modulosRequeridos > 0 && ` (incluye ${exigencia.modulosRequeridos} módulos)`}
        </p>
      )}
    </div>
  )
}

function Numero({
  etiqueta,
  valor,
  onChange,
  paso = 1,
  ayuda,
}: {
  etiqueta: string
  valor: number
  onChange: (v: number) => void
  paso?: number
  ayuda?: string
}) {
  return (
    <label className="block" title={ayuda}>
      <span className="mb-0.5 block text-xs text-slate-500">{etiqueta}</span>
      <input
        type="number"
        step={paso}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded border border-slate-300 px-2 py-1 tabular-nums"
      />
    </label>
  )
}
