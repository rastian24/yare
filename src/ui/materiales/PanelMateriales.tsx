/** Listado de materiales (Anexo 770-A.1.4). */

import { useCalculo } from '@/estado/useCalculo'
import { NOMBRE_CATEGORIA, type CategoriaMaterial } from '@/dominio/computo/materiales'

const ORDEN: CategoriaMaterial[] = ['cable', 'cano', 'caja', 'modulo', 'tablero', 'pat']

export function PanelMateriales() {
  const { materiales, calculado } = useCalculo()

  const sinLongitudes = calculado.escala !== null && !calculado.escala.calibrado

  const exportarCSV = () => {
    const filas = [
      ['Categoría', 'Descripción', 'Cantidad', 'Unidad', 'Cláusula', 'Detalle'],
      ...materiales.map((m) => [
        NOMBRE_CATEGORIA[m.categoria],
        m.descripcion,
        String(m.cantidad),
        m.unidad,
        m.clausula ?? '',
        m.detalle ?? '',
      ]),
    ]
    descargarCSV(filas, 'materiales.csv')
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-2">
        <h2 className="font-medium text-slate-800">Listado de materiales</h2>
        <span className="text-xs text-slate-500">{materiales.length} ítems</span>
        <button
          type="button"
          onClick={exportarCSV}
          className="ml-auto rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
        >
          Exportar CSV
        </button>
      </div>

      {sinLongitudes && (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          El plano no está calibrado, así que no se computan cable ni cañería. El resto de los
          materiales sí sale del conteo de símbolos.
        </p>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {materiales.length === 0 ? (
          <p className="text-sm text-slate-500">
            Todavía no hay materiales. Se computan solos a medida que se colocan elementos y se
            dibujan las canalizaciones.
          </p>
        ) : (
          ORDEN.map((categoria) => {
            const items = materiales.filter((m) => m.categoria === categoria)
            if (items.length === 0) return null

            return (
              <section key={categoria} className="mb-6">
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  {NOMBRE_CATEGORIA[categoria]}
                </h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                      <th className="py-1 font-normal">Descripción</th>
                      <th className="w-24 py-1 text-right font-normal">Cantidad</th>
                      <th className="w-20 py-1 font-normal">Unidad</th>
                      <th className="w-24 py-1 font-normal">Cláusula</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((m) => (
                      <tr key={m.id} className="border-b border-slate-100">
                        <td className="py-1.5">
                          {m.descripcion}
                          {m.detalle && (
                            <span className="block text-xs text-slate-500">{m.detalle}</span>
                          )}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">{m.cantidad}</td>
                        <td className="py-1.5 text-slate-600">{m.unidad}</td>
                        <td className="py-1.5 font-mono text-xs text-slate-500">
                          {m.clausula ?? ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}

export function descargarCSV(filas: string[][], nombre: string): void {
  const csv = filas
    .map((f) => f.map((c) => `"${c.replace(/"/g, '""')}"`).join(';'))
    .join('\n')

  // El BOM hace que Excel en español abra el archivo con la codificación correcta.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}
