/**
 * Presupuesto: materiales y mano de obra por boca, con lista de precios
 * editable.
 */

import { useState } from 'react'
import { useApp } from '@/estado/store'
import { useCalculo } from '@/estado/useCalculo'
import { formatoARS } from '@/dominio/computo/presupuesto'
import { descargarCSV } from '@/ui/materiales/PanelMateriales'
import type { LineaPresupuesto } from '@/dominio/computo/presupuesto'

export function PanelPresupuesto() {
  const { presupuesto } = useCalculo()
  const { proyecto, actualizar } = useApp()
  const [editandoPrecios, setEditandoPrecios] = useState(false)

  const exportar = () => {
    const filas: string[][] = [
      ['Rubro', 'Descripción', 'Cantidad', 'Unidad', 'Precio unitario', 'Subtotal'],
      ...[...presupuesto.materiales, ...presupuesto.manoDeObra].map((l) => [
        l.rubro,
        l.descripcion,
        String(l.cantidad),
        l.unidad,
        String(l.precioUnitarioARS),
        String(l.subtotalARS),
      ]),
      [],
      ['', 'Subtotal materiales', '', '', '', String(presupuesto.subtotalMaterialesARS)],
      ['', 'Subtotal mano de obra', '', '', '', String(presupuesto.subtotalManoObraARS)],
      ['', 'Gastos generales', '', '', '', String(presupuesto.gastosGeneralesARS)],
      ['', 'Beneficio', '', '', '', String(presupuesto.beneficioARS)],
      ['', 'IVA', '', '', '', String(presupuesto.ivaARS)],
      ['', 'TOTAL', '', '', '', String(presupuesto.totalARS)],
    ]
    descargarCSV(filas, 'presupuesto.csv')
  }

  if (editandoPrecios) {
    return <EditorPrecios onCerrar={() => setEditandoPrecios(false)} />
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-2">
        <h2 className="font-medium text-slate-800">Presupuesto</h2>
        <button
          type="button"
          onClick={() => setEditandoPrecios(true)}
          className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
        >
          Editar precios
        </button>
        <button
          type="button"
          onClick={exportar}
          className="ml-auto rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
        >
          Exportar CSV
        </button>
      </div>

      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
        Precios orientativos, actualizados al {presupuesto.actualizadaEn}. Cargá tu propia lista
        antes de presentar el presupuesto.
      </div>

      {presupuesto.itemsSinPrecio.length > 0 && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          {presupuesto.itemsSinPrecio.length} ítem(s) sin precio cargado; el total es parcial:{' '}
          {presupuesto.itemsSinPrecio.slice(0, 3).join(', ')}
          {presupuesto.itemsSinPrecio.length > 3 && '…'}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        <Seccion titulo="Materiales" lineas={presupuesto.materiales} />
        <Seccion titulo="Mano de obra" lineas={presupuesto.manoDeObra} />

        <div className="mt-6 ml-auto max-w-sm space-y-1 text-sm">
          <Total etiqueta="Subtotal materiales" valor={presupuesto.subtotalMaterialesARS} />
          <Total etiqueta="Subtotal mano de obra" valor={presupuesto.subtotalManoObraARS} />
          <Total etiqueta="Subtotal" valor={presupuesto.subtotalARS} borde />

          {proyecto.precios.ayudaGremioPct > 0 && (
            <Total
              etiqueta={`Ayuda de gremio (${proyecto.precios.ayudaGremioPct} %)`}
              valor={presupuesto.ayudaGremioARS}
            />
          )}
          <Total
            etiqueta={`Gastos generales (${proyecto.precios.gastosGeneralesPct} %)`}
            valor={presupuesto.gastosGeneralesARS}
          />
          <Total
            etiqueta={`Beneficio (${proyecto.precios.beneficioPct} %)`}
            valor={presupuesto.beneficioARS}
          />
          <Total etiqueta="Neto" valor={presupuesto.netoARS} borde />
          <Total etiqueta={`IVA (${proyecto.precios.ivaPct} %)`} valor={presupuesto.ivaARS} />
          <Total etiqueta="TOTAL" valor={presupuesto.totalARS} destacado />
        </div>

        <div className="mt-6 grid max-w-sm grid-cols-2 gap-2 text-xs">
          {(
            [
              ['ayudaGremioPct', 'Ayuda de gremio %'],
              ['gastosGeneralesPct', 'Gastos generales %'],
              ['beneficioPct', 'Beneficio %'],
              ['ivaPct', 'IVA %'],
            ] as const
          ).map(([campo, etiqueta]) => (
            <label key={campo} className="block">
              <span className="mb-0.5 block text-slate-500">{etiqueta}</span>
              <input
                type="number"
                step={0.5}
                value={proyecto.precios[campo]}
                onChange={(e) =>
                  actualizar((p) => void (p.precios[campo] = Number(e.target.value)))
                }
                className="w-full rounded border border-slate-300 px-2 py-1 tabular-nums"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

function Seccion({ titulo, lineas }: { titulo: string; lineas: LineaPresupuesto[] }) {
  if (lineas.length === 0) return null

  return (
    <section className="mb-6">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            <th className="py-1 font-normal">Descripción</th>
            <th className="w-20 py-1 text-right font-normal">Cant.</th>
            <th className="w-20 py-1 font-normal">Unidad</th>
            <th className="w-28 py-1 text-right font-normal">P. unitario</th>
            <th className="w-28 py-1 text-right font-normal">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((l) => (
            <tr key={l.id} className="border-b border-slate-100">
              <td className="py-1.5">
                {l.descripcion}
                {l.sinPrecio && (
                  <span className="ml-1.5 rounded bg-amber-100 px-1 text-[10px] text-amber-800">
                    sin precio
                  </span>
                )}
              </td>
              <td className="py-1.5 text-right tabular-nums">{l.cantidad}</td>
              <td className="py-1.5 text-slate-600">{l.unidad}</td>
              <td className="py-1.5 text-right tabular-nums text-slate-600">
                {formatoARS(l.precioUnitarioARS)}
              </td>
              <td className="py-1.5 text-right tabular-nums">{formatoARS(l.subtotalARS)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function Total({
  etiqueta,
  valor,
  borde,
  destacado,
}: {
  etiqueta: string
  valor: number
  borde?: boolean
  destacado?: boolean
}) {
  return (
    <div
      className={[
        'flex justify-between',
        borde ? 'border-t border-slate-300 pt-1' : '',
        destacado ? 'border-t-2 border-slate-800 pt-1.5 text-base font-semibold' : '',
      ].join(' ')}
    >
      <span className={destacado ? '' : 'text-slate-600'}>{etiqueta}</span>
      <span className="tabular-nums">{formatoARS(valor)}</span>
    </div>
  )
}

function EditorPrecios({ onCerrar }: { onCerrar: () => void }) {
  const { proyecto, actualizar } = useApp()
  const [filtro, setFiltro] = useState('')

  const visibles = proyecto.precios.items.filter((i) =>
    i.descripcion.toLowerCase().includes(filtro.toLowerCase()),
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-2">
        <h2 className="font-medium text-slate-800">Lista de precios</h2>
        <input
          placeholder="Buscar…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <label className="ml-auto text-xs text-slate-600">
          Actualizada el{' '}
          <input
            type="date"
            value={proyecto.precios.actualizadaEn}
            onChange={(e) => actualizar((p) => void (p.precios.actualizadaEn = e.target.value))}
            className="rounded border border-slate-300 px-1 py-0.5"
          />
        </label>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded bg-sky-600 px-3 py-1 text-sm font-medium text-white hover:bg-sky-700"
        >
          Listo
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-1 font-normal">Descripción</th>
              <th className="w-24 py-1 font-normal">Unidad</th>
              <th className="w-36 py-1 text-right font-normal">Precio (ARS)</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((item, i) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="py-1">{item.descripcion}</td>
                <td className="py-1 text-slate-600">{item.unidad}</td>
                <td className="py-1 text-right">
                  <input
                    type="number"
                    value={item.precioARS}
                    onChange={(e) =>
                      actualizar((p) => {
                        const original = p.precios.items.findIndex((x) => x.id === item.id)
                        const fila = p.precios.items[original]
                        if (fila) fila.precioARS = Number(e.target.value)
                      })
                    }
                    className="w-32 rounded border border-slate-300 px-2 py-0.5 text-right tabular-nums"
                  />
                  {void i}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
