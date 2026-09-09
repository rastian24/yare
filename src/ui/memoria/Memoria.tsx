/**
 * Memoria técnica y planilla de circuitos (Anexo 770-A.1.1).
 *
 * El anexo pide "síntesis del proyecto de la instalación, incluyendo los datos
 * que permitan individualizar demanda de potencia, grado de electrificación,
 * superficie total, cantidad y destino de los circuitos, secciones de los
 * cables, corrientes de proyecto, corriente presunta de cortocircuito en el
 * punto de suministro y cantidad de bocas con su distribución ambiental".
 */

import { useApp } from '@/estado/store'
import { useCalculo } from '@/estado/useCalculo'
import { nombreGrado } from '@/normativa/aea770/electrificacion'
import { buscarSimbolo } from '@/simbologia/catalogo'
import { amp, kva, m2, metros, mm2, pct, va } from '@/dominio/formato'

export function Memoria() {
  const { proyecto, actualizar } = useApp()
  const { calculado, validacion } = useCalculo()

  // Distribución ambiental de bocas, que el anexo pide explícitamente.
  const porAmbiente = proyecto.inmueble.ambientes.map((a) => {
    const elementos = proyecto.elementos.filter((e) => e.ambienteId === a.id)
    const bocas = elementos.filter((e) => buscarSimbolo(e.simboloId)?.computaComoBoca)

    const iug = bocas.filter((e) => {
      const c = proyecto.circuitos.find((x) => x.id === e.circuitoId)
      return c?.tipo === 'IUG'
    }).length

    return { ambiente: a, iug, tug: bocas.length - iug, total: bocas.length }
  })

  const totalBocas = porAmbiente.reduce((s, a) => s + a.total, 0)

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="font-medium text-slate-800">Memoria técnica</h2>
          <span className="text-xs text-slate-500">Anexo 770-A.1.1</span>
          <button
            type="button"
            onClick={() => window.print()}
            className="ml-auto rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
          >
            Imprimir / PDF
          </button>
        </div>

        <input
          value={proyecto.nombre}
          onChange={(e) => actualizar((p) => void (p.nombre = e.target.value))}
          className="mb-6 w-full rounded border border-transparent px-1 text-xl font-semibold hover:border-slate-300 focus:border-sky-400 focus:outline-none"
        />

        {/* --- Síntesis --- */}
        <Seccion titulo="Síntesis del proyecto">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
            <Dato
              etiqueta="Superficie (límite de aplicación)"
              valor={m2(calculado.superficieM2, 1)}
              nota="770.7.3"
            />
            <Dato etiqueta="Grado de electrificación" valor={nombreGrado(calculado.grado)} nota="770.7.I" />
            <Dato
              etiqueta="Circuitos"
              valor={`${calculado.circuitos.length} (mínimo ${calculado.minimoCircuitos.totalRequerido})`}
              nota="770.7.II"
            />
            <Dato
              etiqueta="DPMS"
              valor={kva(calculado.dpmsTotalVA)}
              nota="770.8.I"
            />
            <Dato
              etiqueta="Coeficiente de simultaneidad"
              valor={String(calculado.coefSimultaneidad)}
              nota="770.8.II"
            />
            <Dato
              etiqueta="Carga total"
              valor={kva(calculado.cargaTotalVA)}
              nota="770.8.3.1"
            />
            <Dato
              etiqueta="Corriente de línea"
              valor={amp(calculado.corrienteTotalA)}
            />
            <Dato
              etiqueta="Suministro"
              valor={
                proyecto.suministro.fases === 'trifasica'
                  ? `Trifásico ${proyecto.suministro.tensionV} V`
                  : `Monofásico ${proyecto.suministro.tensionV} V`
              }
            />
            <Dato etiqueta="Bocas totales" valor={String(totalBocas)} />
          </dl>

          <label className="mt-4 block max-w-xs text-sm">
            <span className="mb-0.5 block text-xs text-slate-500">
              Corriente presunta de cortocircuito en el punto de suministro (kA)
            </span>
            <input
              type="number"
              step={0.1}
              value={proyecto.suministro.iccPresuntaKA ?? ''}
              placeholder="dato de la distribuidora"
              onChange={(e) =>
                actualizar((p) => {
                  const v = Number(e.target.value)
                  p.suministro.iccPresuntaKA = Number.isFinite(v) && v > 0 ? v : undefined
                })
              }
              className="w-full rounded border border-slate-300 px-2 py-1 tabular-nums"
            />
            <span className="mt-1 block text-xs text-slate-500">
              770-A.1.1 lo exige. Es un dato de la empresa distribuidora: la app no lo estima.
            </span>
          </label>
        </Seccion>

        {/* --- Planilla de circuitos --- */}
        <Seccion titulo="Planilla de circuitos">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs text-slate-500">
                <th className="py-1.5 font-normal">Circuito</th>
                <th className="py-1.5 font-normal">Tipo</th>
                <th className="py-1.5 text-right font-normal">Bocas</th>
                <th className="py-1.5 text-right font-normal">DPMS</th>
                <th className="py-1.5 text-right font-normal">Ib</th>
                <th className="py-1.5 text-right font-normal">Sección</th>
                <th className="py-1.5 text-right font-normal">Iz</th>
                <th className="py-1.5 text-right font-normal">In</th>
                <th className="py-1.5 text-right font-normal">Long.</th>
                <th className="py-1.5 text-right font-normal">ΔU</th>
                <th className="py-1.5 text-right font-normal">PE</th>
              </tr>
            </thead>
            <tbody>
              {calculado.circuitos.map((c) => (
                <tr key={c.circuito.id} className="border-b border-slate-100">
                  <td className="py-1.5">{c.circuito.nombre}</td>
                  <td className="py-1.5 text-slate-600">{c.circuito.tipo}</td>
                  <td className="py-1.5 text-right tabular-nums">{c.bocas}</td>
                  <td className="py-1.5 text-right tabular-nums">{va(c.dpmsVA)}</td>
                  <td className="py-1.5 text-right tabular-nums">{amp(c.ibA)}</td>
                  <td className="py-1.5 text-right tabular-nums">{mm2(c.circuito.seccionMm2)}</td>
                  <td className="py-1.5 text-right tabular-nums">{amp(c.izA)}</td>
                  <td className="py-1.5 text-right tabular-nums">{c.circuito.proteccionIn} A</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {c.longitudM !== null ? metros(c.longitudM, 1) : '—'}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {c.caidaPct !== null ? pct(c.caidaPct) : '—'}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{mm2(c.seccionPEMm2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Seccion>

        {/* --- Distribución ambiental --- */}
        <Seccion titulo="Distribución ambiental de bocas">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs text-slate-500">
                <th className="py-1.5 font-normal">Ambiente</th>
                <th className="py-1.5 font-normal">Tipo</th>
                <th className="py-1.5 text-right font-normal">Superficie</th>
                <th className="py-1.5 text-right font-normal">IUG</th>
                <th className="py-1.5 text-right font-normal">TUG</th>
                <th className="py-1.5 text-right font-normal">Mínimo exigido</th>
              </tr>
            </thead>
            <tbody>
              {porAmbiente.map(({ ambiente, iug, tug }) => {
                const ex = calculado.exigenciasAmbientes.find((e) => e.ambienteId === ambiente.id)
                const tugExigido = ex ? ex.tugRequeridas + ex.modulosRequeridos : 0
                const cumple = ex ? iug >= ex.iugRequeridas && tug >= tugExigido : true

                return (
                  <tr key={ambiente.id} className="border-b border-slate-100">
                    <td className="py-1.5">{ambiente.nombre}</td>
                    <td className="py-1.5 text-slate-600">{ambiente.tipo}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {ambiente.longitudM !== undefined
                        ? metros(ambiente.longitudM)
                        : m2(ambiente.superficieM2)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{iug}</td>
                    <td className="py-1.5 text-right tabular-nums">{tug}</td>
                    <td
                      className={`py-1.5 text-right tabular-nums ${cumple ? 'text-slate-500' : 'font-medium text-red-600'}`}
                    >
                      {ex ? `${ex.iugRequeridas} / ${tugExigido}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Seccion>

        {/* --- Conformidad --- */}
        <Seccion titulo="Verificación normativa">
          <p className="text-sm">
            {validacion.conforme ? (
              <span className="text-emerald-700">
                El proyecto cumple las verificaciones implementadas de AEA 90364-7-770.
              </span>
            ) : (
              <span className="text-red-700">
                {validacion.errores} error(es) y {validacion.advertencias} advertencia(s) pendientes.
              </span>
            )}
          </p>

          <p className="mt-3 rounded bg-slate-50 p-3 text-xs text-slate-600">
            Este documento es una ayuda al proyecto, generada automáticamente según AEA 90364-7-770,
            Edición 2017 (viviendas unifamiliares hasta 63 A, clasificaciones BA2 y BD1). No
            reemplaza el proyecto ni la firma de un profesional matriculado, y no cubre las
            verificaciones que dependen de datos externos, como la solicitación térmica al
            cortocircuito.
          </p>
        </Seccion>
      </div>
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h3 className="mb-3 border-b border-slate-200 pb-1 text-sm font-medium text-slate-700">
        {titulo}
      </h3>
      {children}
    </section>
  )
}

function Dato({ etiqueta, valor, nota }: { etiqueta: string; valor: string; nota?: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">
        {etiqueta}
        {nota && <span className="ml-1 font-mono text-[10px] text-slate-400">{nota}</span>}
      </dt>
      <dd className="font-medium tabular-nums text-slate-800">{valor}</dd>
    </div>
  )
}
