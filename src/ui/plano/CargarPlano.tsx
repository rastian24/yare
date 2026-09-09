/**
 * Carga de plano: foto/escaneo o archivo DXF.
 *
 * Cuando el DXF no declara unidades o las declara mal, se le pregunta al
 * usuario en lugar de adivinar en silencio: la unidad determina la superficie,
 * que determina el grado de electrificación, que determina todo lo demás.
 */

import { useState } from 'react'
import { useApp, nuevoId } from '@/estado/store'
import { importarDXF, pareceDWG, ErrorDWG, type ResultadoImportacion } from '@/cad/importar'
import { diagnosticarUnidades, NOMBRE_UNIDAD } from '@/cad/unidades'
import { detectarAmbientes, aAmbiente, type AmbienteDetectado } from '@/cad/ambientes'
import { guardarBlob } from '@/persistencia/db'
import type { UnidadDXF } from '@/dominio/tipos'

export function CargarPlano() {
  const { proyecto, agregarPlano, setAmbientes } = useApp()
  const [error, setError] = useState<string | null>(null)
  const [pendiente, setPendiente] = useState<{
    resultado: ResultadoImportacion
    texto: string
    nombre: string
    blobId: string
  } | null>(null)
  const [detectados, setDetectados] = useState<AmbienteDetectado[] | null>(null)
  const [capaElegida, setCapaElegida] = useState<string>('')

  const yaHayPlano = proyecto.planos.length > 0

  async function alElegirArchivo(archivo: File) {
    setError(null)
    const blobId = nuevoId('blob')

    try {
      // El tipo MIME no sirve para decidir: Chromium mapea .dxf a
      // "image/vnd.dxf", así que un DXF entraría por la rama de imagen. Manda
      // la extensión, y el MIME queda de respaldo para archivos sin extensión.
      const extension = archivo.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? ''
      const esCAD = extension === 'dxf' || extension === 'dwg'
      const esImagen =
        !esCAD && (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(extension) ||
          (extension === '' && archivo.type.startsWith('image/')))

      if (esImagen) {
        await guardarBlob({
          id: blobId,
          proyectoId: proyecto.id,
          nombre: archivo.name,
          tipo: archivo.type,
          datos: archivo,
        })

        const dim = await dimensionesDeImagen(archivo)
        agregarPlano({
          id: nuevoId('plano'),
          nombre: archivo.name,
          fuente: {
            tipo: 'raster',
            blobId,
            anchoPx: dim.ancho,
            altoPx: dim.alto,
            calibracion: null,
          },
        })
        return
      }

      const texto = await archivo.text()

      if (pareceDWG(archivo.name, texto.slice(0, 16))) throw new ErrorDWG()

      const resultado = importarDXF(texto)

      await guardarBlob({
        id: blobId,
        proyectoId: proyecto.id,
        nombre: archivo.name,
        tipo: 'application/dxf',
        datos: archivo,
      })

      setPendiente({ resultado, texto, nombre: archivo.name, blobId })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function confirmarDXF(unidad: UnidadDXF) {
    if (!pendiente) return

    const resultado =
      unidad === pendiente.resultado.unidades
        ? pendiente.resultado
        : importarDXF(pendiente.texto, unidad)

    agregarPlano({
      id: nuevoId('plano'),
      nombre: pendiente.nombre,
      fuente: {
        tipo: 'dxf',
        blobId: pendiente.blobId,
        unidades: resultado.unidades,
        capas: resultado.capas,
        entidades: resultado.entidades,
        bbox: resultado.bbox,
        calibracion: null,
      },
    })

    const encontrados = detectarAmbientes(resultado.entidades, resultado.unidades)
    setDetectados(encontrados.length > 0 ? encontrados : null)
    setPendiente(null)
  }

  function confirmarAmbientes() {
    if (!detectados) return
    const plano = useApp.getState().proyecto.planos[0]
    const unidades = plano?.fuente.tipo === 'dxf' ? plano.fuente.unidades : 'sin_definir'

    const filtrados = capaElegida ? detectados.filter((d) => d.capa === capaElegida) : detectados
    setAmbientes(filtrados.map((d) => aAmbiente(d, unidades)))
    setDetectados(null)
  }

  // -------------------------------------------------------------------------
  if (detectados) {
    const capas = [...new Set(detectados.map((d) => d.capa))]
    const visibles = capaElegida ? detectados.filter((d) => d.capa === capaElegida) : detectados
    const total = visibles.reduce((s, d) => s + d.superficieM2, 0)

    return (
      <Panel titulo="Ambientes detectados">
        <p className="mb-3 text-sm text-slate-600">
          Se encontraron {detectados.length} polígonos cerrados que parecen locales. Revisá la lista
          antes de confirmar: el tipo de ambiente determina los puntos mínimos de la Tabla 770.7.III
          y no se puede inferir con confianza del plano.
        </p>

        {capas.length > 1 && (
          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-slate-600">Filtrar por capa</span>
            <select
              className="w-full rounded border border-slate-300 px-2 py-1"
              value={capaElegida}
              onChange={(e) => setCapaElegida(e.target.value)}
            >
              <option value="">Todas las capas</option>
              {capas.map((c) => (
                <option key={c} value={c}>
                  {c} ({detectados.filter((d) => d.capa === c).length})
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="mb-3 max-h-64 overflow-y-auto rounded border border-slate-200">
          <table className="w-full text-sm">
            <tbody>
              {visibles.map((d) => (
                <tr key={d.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-2 py-1">{d.nombre}</td>
                  <td className="px-2 py-1 text-slate-500">{d.tipoPropuesto}</td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {d.superficieM2.toFixed(2)} m²
                  </td>
                  <td className="px-2 py-1">
                    {d.confianza === 'baja' && (
                      <span className="text-xs text-amber-600">revisar tipo</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mb-3 text-sm text-slate-700">
          Superficie total: <strong>{total.toFixed(2)} m²</strong>
        </p>

        <div className="flex gap-2">
          <Boton onClick={confirmarAmbientes}>Usar estos ambientes</Boton>
          <Boton secundario onClick={() => setDetectados(null)}>
            Cargarlos a mano
          </Boton>
        </div>
      </Panel>
    )
  }

  if (pendiente) {
    const { resultado } = pendiente
    const diagnostico = diagnosticarUnidades(resultado.bbox)

    return (
      <Panel titulo="Unidades del dibujo">
        {resultado.avisos.map((a, i) => (
          <p key={i} className="mb-2 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {a}
          </p>
        ))}

        <p className="mb-3 text-sm text-slate-600">
          Elegí la unidad del dibujo. De esto dependen todas las longitudes y superficies, y con
          ellas el grado de electrificación.
        </p>

        <div className="mb-4 space-y-1">
          {diagnostico.map((d) => (
            <button
              key={d.unidad}
              type="button"
              onClick={() => confirmarDXF(d.unidad)}
              className={[
                'flex w-full items-center justify-between rounded border px-3 py-2 text-left text-sm transition',
                d.unidad === resultado.unidades
                  ? 'border-sky-400 bg-sky-50'
                  : 'border-slate-200 hover:border-slate-400',
                d.plausible ? '' : 'opacity-50',
              ].join(' ')}
            >
              <span className="capitalize">{NOMBRE_UNIDAD[d.unidad]}</span>
              <span className="tabular-nums text-slate-500">
                el plano mediría {formatoDimension(d.dimensionMayorM)}
                {!d.plausible && ' — poco probable'}
              </span>
            </button>
          ))}
        </div>

        <Boton secundario onClick={() => setPendiente(null)}>
          Cancelar
        </Boton>
      </Panel>
    )
  }

  return (
    <div>
      <label className="block cursor-pointer rounded-lg border-2 border-dashed border-slate-300 p-6 text-center transition hover:border-sky-400 hover:bg-sky-50/50">
        <input
          type="file"
          className="hidden"
          accept="image/*,.dxf,.dwg"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void alElegirArchivo(f)
            e.target.value = ''
          }}
        />
        <p className="text-sm font-medium text-slate-700">
          {yaHayPlano ? 'Reemplazar plano' : 'Cargar plano'}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Foto o escaneo (JPG, PNG) o archivo CAD (DXF)
        </p>
      </label>

      <p className="mt-2 text-xs text-slate-500">
        Con un DXF las longitudes salen exactas del archivo. Con una foto hay que calibrar sobre una
        distancia conocida.
      </p>

      {error && (
        <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function formatoDimension(metros: number): string {
  if (metros >= 1000) return `${(metros / 1000).toFixed(1)} km`
  if (metros < 1) return `${(metros * 100).toFixed(0)} cm`
  return `${metros.toFixed(1)} m`
}

function dimensionesDeImagen(archivo: File): Promise<{ ancho: number; alto: number }> {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolver({ ancho: img.naturalWidth, alto: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      rechazar(new Error('No se pudo leer la imagen.'))
    }
    img.src = url
  })
}

function Panel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 font-medium text-slate-800">{titulo}</h3>
      {children}
    </div>
  )
}

function Boton({
  children,
  onClick,
  secundario,
}: {
  children: React.ReactNode
  onClick: () => void
  secundario?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        secundario
          ? 'rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50'
          : 'rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700'
      }
    >
      {children}
    </button>
  )
}
