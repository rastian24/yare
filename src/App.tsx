import { useEffect, useState } from 'react'
import { useApp, proyectoVacio } from '@/estado/store'
import { useCalculo } from '@/estado/useCalculo'
import { EditorPlano } from '@/ui/plano/EditorPlano'
import { GaleriaSimbolos } from '@/ui/plano/GaleriaSimbolos'
import { CargarPlano } from '@/ui/plano/CargarPlano'
import { PanelCircuitos } from '@/ui/circuitos/PanelCircuitos'
import { PanelHallazgos } from '@/ui/comun/PanelHallazgos'
import { PanelInmueble } from '@/ui/comun/PanelInmueble'
import { PanelMateriales } from '@/ui/materiales/PanelMateriales'
import { PanelPresupuesto } from '@/ui/presupuesto/PanelPresupuesto'
import { Unifilar } from '@/ui/unifilar/Unifilar'
import { Memoria } from '@/ui/memoria/Memoria'
import { listarProyectos, cargarProyecto, guardarProyecto } from '@/persistencia/db'
import { archivoDeProyecto, importarDesdeArchivo, nombreDeArchivo } from '@/persistencia/archivo'

type Vista = 'plano' | 'materiales' | 'presupuesto' | 'unifilar' | 'memoria'
type PanelLateral = 'simbolos' | 'circuitos' | 'inmueble' | 'plano'

const VISTAS: Array<{ id: Vista; etiqueta: string }> = [
  { id: 'plano', etiqueta: 'Plano' },
  { id: 'materiales', etiqueta: 'Materiales' },
  { id: 'presupuesto', etiqueta: 'Presupuesto' },
  { id: 'unifilar', etiqueta: 'Unifilar' },
  { id: 'memoria', etiqueta: 'Memoria' },
]

const PANELES: Array<{ id: PanelLateral; etiqueta: string }> = [
  { id: 'plano', etiqueta: 'Plano' },
  { id: 'inmueble', etiqueta: 'Inmueble' },
  { id: 'simbolos', etiqueta: 'Símbolos' },
  { id: 'circuitos', etiqueta: 'Circuitos' },
]

export function App() {
  const [vista, setVista] = useState<Vista>('plano')
  const [panel, setPanel] = useState<PanelLateral>('plano')
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null)
  const { proyecto, herramienta, setHerramienta, ortogonal, setOrtogonal, snapActivo, setSnapActivo } =
    useApp()
  const { reemplazarProyecto } = useApp()
  const { validacion, calculado } = useCalculo()

  // Se recupera el último proyecto al abrir la app.
  useEffect(() => {
    void (async () => {
      const guardados = await listarProyectos()
      const ultimo = guardados[0]
      if (!ultimo) return
      const p = await cargarProyecto(ultimo.id)
      if (p) reemplazarProyecto(p)
    })()
  }, [reemplazarProyecto])

  const nuevo = () => {
    const p = proyectoVacio()
    reemplazarProyecto(p)
    void guardarProyecto(p)
  }

  const exportarJSON = async () => {
    setErrorArchivo(null)
    try {
      const blob = await archivoDeProyecto(proyecto)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = nombreDeArchivo(proyecto)
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setErrorArchivo(e instanceof Error ? e.message : String(e))
    }
  }

  const importarJSON = async (archivo: File) => {
    setErrorArchivo(null)
    try {
      reemplazarProyecto(await importarDesdeArchivo(archivo))
      setVista('plano')
    } catch (e) {
      setErrorArchivo(e instanceof Error ? e.message : String(e))
    }
  }

  const esDXF = proyecto.planos[0]?.fuente.tipo === 'dxf'

  return (
    <div className="flex h-screen flex-col bg-slate-100 text-slate-900">
      {/* --- Barra superior --- */}
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <h1 className="text-sm font-semibold">
          Circuitos AEA
          <span className="ml-2 font-normal text-slate-500">90364-7-770</span>
        </h1>

        <nav className="ml-4 flex gap-1">
          {VISTAS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setVista(v.id)}
              className={[
                'rounded px-2.5 py-1 text-sm transition',
                vista === v.id
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-600 hover:bg-slate-100',
              ].join(' ')}
            >
              {v.etiqueta}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3 text-xs">
          <span
            className={
              validacion.errores > 0
                ? 'font-medium text-red-600'
                : validacion.advertencias > 0
                  ? 'text-amber-600'
                  : 'text-emerald-600'
            }
          >
            {validacion.errores > 0
              ? `${validacion.errores} ${validacion.errores === 1 ? 'error' : 'errores'}`
              : validacion.advertencias > 0
                ? `${validacion.advertencias} ${validacion.advertencias === 1 ? 'advertencia' : 'advertencias'}`
                : 'Sin observaciones'}
          </span>

          <button
            type="button"
            onClick={() => void exportarJSON()}
            title="Descargar el proyecto en un archivo, con el plano adentro"
            className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50"
          >
            Exportar
          </button>
          <label
            title="Abrir un proyecto exportado antes, desde esta u otra máquina"
            className="cursor-pointer rounded border border-slate-300 px-2 py-1 hover:bg-slate-50"
          >
            <input
              type="file"
              className="hidden"
              accept="application/json,.json"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void importarJSON(f)
                // Sin esto, volver a elegir el mismo archivo no dispara nada.
                e.target.value = ''
              }}
            />
            Importar
          </label>
          <button
            type="button"
            onClick={nuevo}
            className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50"
          >
            Nuevo
          </button>
        </div>
      </header>

      {/* Importar o exportar puede fallar por el archivo elegido, no por un
          error de programa: se explica en pantalla en vez de en la consola. */}
      {errorArchivo && (
        <div className="flex items-start gap-3 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          <span className="flex-1">{errorArchivo}</span>
          <button
            type="button"
            onClick={() => setErrorArchivo(null)}
            className="shrink-0 rounded px-2 text-red-700 hover:bg-red-100"
          >
            Cerrar
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* --- Panel izquierdo --- */}
        {vista === 'plano' && (
          <aside className="flex w-72 flex-col border-r border-slate-200 bg-white">
            <div className="flex border-b border-slate-200">
              {PANELES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPanel(p.id)}
                  className={[
                    'flex-1 border-b-2 px-1 py-2 text-xs transition',
                    panel === p.id
                      ? 'border-sky-500 font-medium text-sky-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800',
                  ].join(' ')}
                >
                  {p.etiqueta}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {panel === 'plano' && (
                <div className="space-y-4 p-3">
                  <CargarPlano />
                  {esDXF && <ControlCapas />}
                </div>
              )}
              {panel === 'inmueble' && <PanelInmueble />}
              {panel === 'simbolos' && (
                <div className="p-3">
                  <GaleriaSimbolos />
                </div>
              )}
              {panel === 'circuitos' && <PanelCircuitos />}
            </div>
          </aside>
        )}

        {/* --- Centro --- */}
        <main className="flex min-w-0 flex-1 flex-col">
          {vista === 'plano' && (
            <div className="flex items-center gap-1.5 border-b border-slate-200 bg-white px-3 py-1.5">
              {(
                [
                  ['seleccionar', 'Seleccionar'],
                  ['colocar', 'Colocar'],
                  ['tramo', 'Cañería'],
                  ['ambiente', 'Ambiente'],
                  ['calibrar', 'Calibrar'],
                ] as const
              ).map(([id, etiqueta]) => {
                // Delimitar sin escala daría una superficie inventada, y de la
                // superficie cuelga el grado de electrificación (770.7.3).
                const sinEscala = id === 'ambiente' && !calculado.escala?.calibrado

                return (
                  <button
                    key={id}
                    type="button"
                    disabled={sinEscala}
                    title={
                      sinEscala
                        ? 'Calibrá el plano, o cargá un DXF con unidades, para poder medir superficies'
                        : id === 'ambiente'
                          ? 'Marcar los vértices de un ambiente y medir su superficie'
                          : undefined
                    }
                    onClick={() => setHerramienta(id)}
                    className={[
                      'rounded px-2 py-1 text-xs transition',
                      sinEscala
                        ? 'cursor-not-allowed text-slate-300'
                        : herramienta === id
                          ? 'bg-sky-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100',
                    ].join(' ')}
                  >
                    {etiqueta}
                  </button>
                )
              })}

              <span className="mx-2 h-4 w-px bg-slate-200" />

              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={ortogonal}
                  onChange={(e) => setOrtogonal(e.target.checked)}
                />
                <span title="770.10.3.1 exige respetar la ortogonalidad de los ambientes">
                  Ortogonal
                </span>
              </label>

              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={snapActivo}
                  onChange={(e) => setSnapActivo(e.target.checked)}
                  disabled={!esDXF}
                />
                <span title={esDXF ? '' : 'Sólo disponible con un plano CAD'}>Enganche</span>
              </label>

              <span className="ml-auto text-xs text-slate-500">
                {calculado.escala?.calibrado
                  ? calculado.escala.origen === 'archivo'
                    ? 'Escala del archivo DXF'
                    : 'Escala calibrada'
                  : 'Sin escala'}
              </span>
            </div>
          )}

          <div className="min-h-0 flex-1">
            {vista === 'plano' && <EditorPlano />}
            {vista === 'materiales' && <PanelMateriales />}
            {vista === 'presupuesto' && <PanelPresupuesto />}
            {vista === 'unifilar' && <Unifilar />}
            {vista === 'memoria' && <Memoria />}
          </div>
        </main>

        {/* --- Panel derecho: hallazgos --- */}
        {vista === 'plano' && (
          <aside className="w-80 border-l border-slate-200 bg-white">
            <PanelHallazgos />
          </aside>
        )}
      </div>
    </div>
  )
}

function ControlCapas() {
  const { proyecto, capasOcultas, toggleCapa } = useApp()
  const fuente = proyecto.planos[0]?.fuente
  if (fuente?.tipo !== 'dxf') return null

  return (
    <div>
      <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
        Capas del CAD
      </h3>
      <p className="mb-2 text-xs text-slate-500">
        Apagá amoblamiento y cotas para dejar sólo los muros.
      </p>
      <div className="max-h-52 space-y-0.5 overflow-y-auto">
        {fuente.capas.map((c) => (
          <label key={c.nombre} className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={!capasOcultas.has(c.nombre)}
              onChange={() => toggleCapa(c.nombre)}
            />
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm border border-slate-300"
              style={{ backgroundColor: c.color }}
            />
            <span className="truncate">{c.nombre}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
