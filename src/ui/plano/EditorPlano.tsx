/**
 * Editor de plano.
 *
 * Un solo canvas SVG dibuja los dos orígenes: la foto va como <image> de fondo
 * y el DXF como geometría vectorial. El resto del editor —símbolos, tramos,
 * ambientes— es idéntico en ambos casos, porque lo único que cambia es de dónde
 * sale la escala.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '@/estado/store'
import { useCalculo } from '@/estado/useCalculo'
import { buscarSimbolo } from '@/simbologia/catalogo'
import { IndiceEspacial, forzarOrtogonal, type Snap } from '@/cad/snapping'
import { escalaDe, longitudPolilinea } from '@/dominio/calculo/longitudes'
import { metros as fmtMetros } from '@/dominio/formato'
import { urlDeBlob } from '@/persistencia/db'
import { nuevoId } from '@/estado/store'
import { severidadMaxima } from '@/normativa/aea770/motor'
import { CapaGeometriaCAD } from './CapaGeometriaCAD'
import { SimboloSVG } from './SimboloSVG'
import type { Punto } from '@/dominio/tipos'

const COLOR_CIRCUITO: Record<string, string> = {
  IUG: '#d97706',
  TUG: '#2563eb',
  TUE: '#dc2626',
}

interface Vista {
  x: number
  y: number
  ancho: number
  alto: number
}

export function EditorPlano() {
  const svgRef = useRef<SVGSVGElement>(null)
  const {
    proyecto,
    herramienta,
    simboloActivo,
    circuitoActivo,
    seleccion,
    tramoEnCurso,
    ortogonal,
    snapActivo,
    capasOcultas,
  } = useApp()
  const {
    agregarElemento,
    moverElemento,
    setSeleccion,
    iniciarTramo,
    agregarPuntoTramo,
    cerrarTramo,
    cancelarTramo,
    agregarPlano,
    actualizar,
  } = useApp()

  const { calculado, validacion } = useCalculo()

  const plano = proyecto.planos[0] ?? null
  const [vista, setVista] = useState<Vista>({ x: 0, y: 0, ancho: 1200, alto: 900 })
  const [cursor, setCursor] = useState<Punto | null>(null)
  const [snap, setSnap] = useState<Snap | null>(null)
  const [arrastrando, setArrastrando] = useState<string | null>(null)
  const [paneando, setPaneando] = useState<{ x: number; y: number } | null>(null)
  const [urlImagen, setUrlImagen] = useState<string | null>(null)
  const [calibrando, setCalibrando] = useState<Punto[]>([])

  // --- Fondo raster --------------------------------------------------------
  useEffect(() => {
    if (plano?.fuente.tipo !== 'raster') {
      setUrlImagen(null)
      return
    }
    let url: string | null = null
    let vigente = true

    void urlDeBlob(plano.fuente.blobId).then((u) => {
      if (!vigente) {
        if (u) URL.revokeObjectURL(u)
        return
      }
      url = u
      setUrlImagen(u)
    })

    return () => {
      vigente = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [plano])

  // --- Encuadre inicial ----------------------------------------------------
  useEffect(() => {
    if (!plano) return

    if (plano.fuente.tipo === 'dxf') {
      const { bbox } = plano.fuente
      const margen = Math.max(bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y) * 0.05
      setVista({
        x: bbox.min.x - margen,
        y: bbox.min.y - margen,
        ancho: bbox.max.x - bbox.min.x + margen * 2,
        alto: bbox.max.y - bbox.min.y + margen * 2,
      })
    } else {
      setVista({ x: 0, y: 0, ancho: plano.fuente.anchoPx, alto: plano.fuente.altoPx })
    }
  }, [plano?.id, plano?.fuente.tipo])

  // --- Índice de snapping --------------------------------------------------
  const indice = useMemo(() => {
    if (plano?.fuente.tipo !== 'dxf') return null
    const visibles = plano.fuente.entidades.filter((e) => !capasOcultas.has(e.capa))
    return new IndiceEspacial(visibles, plano.fuente.bbox)
  }, [plano, capasOcultas])

  const escala = plano ? escalaDe(plano) : null

  /** Convierte coordenadas de pantalla a coordenadas del plano. */
  const aCoordenadas = useCallback(
    (ev: React.MouseEvent): Punto => {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }

      const rect = svg.getBoundingClientRect()
      const px = (ev.clientX - rect.left) / rect.width
      const py = (ev.clientY - rect.top) / rect.height

      return { x: vista.x + px * vista.ancho, y: vista.y + py * vista.alto }
    },
    [vista],
  )

  /** Radio de enganche en unidades del plano, constante en pantalla. */
  const radioSnap = vista.ancho * 0.012

  const puntoEfectivo = useCallback(
    (bruto: Punto, anterior?: Punto): { punto: Punto; snap: Snap | null } => {
      let punto = bruto
      let s: Snap | null = null

      if (snapActivo && indice) {
        s = indice.snap(bruto, radioSnap)
        if (s) punto = s.punto
      }

      // La ortogonalidad se aplica después del enganche, salvo que el enganche
      // sea a un extremo: ahí manda el punto real del dibujo.
      if (ortogonal && anterior && (!s || s.tipo !== 'extremo')) {
        punto = forzarOrtogonal(anterior, punto)
      }

      return { punto, snap: s }
    },
    [snapActivo, indice, radioSnap, ortogonal],
  )

  // --- Interacción ---------------------------------------------------------
  const alMover = (ev: React.MouseEvent) => {
    const bruto = aCoordenadas(ev)

    if (paneando) {
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const dx = ((ev.clientX - paneando.x) / rect.width) * vista.ancho
      const dy = ((ev.clientY - paneando.y) / rect.height) * vista.alto
      setVista((v) => ({ ...v, x: v.x - dx, y: v.y - dy }))
      setPaneando({ x: ev.clientX, y: ev.clientY })
      return
    }

    const anterior = tramoEnCurso.at(-1)
    const { punto, snap: s } = puntoEfectivo(bruto, herramienta === 'tramo' ? anterior : undefined)

    setCursor(punto)
    setSnap(s)

    if (arrastrando) moverElemento(arrastrando, punto)
  }

  const alPresionar = (ev: React.MouseEvent) => {
    // Botón del medio o con espacio: paneo.
    if (ev.button === 1 || ev.altKey) {
      setPaneando({ x: ev.clientX, y: ev.clientY })
      return
    }
    if (ev.button !== 0) return

    const bruto = aCoordenadas(ev)
    const anterior = tramoEnCurso.at(-1)
    const { punto } = puntoEfectivo(bruto, herramienta === 'tramo' ? anterior : undefined)

    switch (herramienta) {
      case 'colocar': {
        if (!simboloActivo) return
        const simbolo = buscarSimbolo(simboloActivo)
        if (!simbolo) return

        // Se asigna al circuito activo sólo si el símbolo lo admite.
        const circuito = proyecto.circuitos.find((c) => c.id === circuitoActivo)
        const admite = circuito && simbolo.circuitosPermitidos.includes(circuito.tipo)

        agregarElemento({
          id: nuevoId('el'),
          simboloId: simboloActivo,
          planoId: plano?.id ?? '',
          posicion: punto,
          circuitoId: admite ? circuito.id : undefined,
          ambienteId: ambienteEnPunto(punto),
        })
        break
      }

      case 'tramo': {
        if (tramoEnCurso.length === 0) iniciarTramo(punto)
        else agregarPuntoTramo(punto)
        break
      }

      case 'calibrar': {
        const nuevos = [...calibrando, punto]
        if (nuevos.length === 2) {
          const px = Math.hypot(nuevos[1]!.x - nuevos[0]!.x, nuevos[1]!.y - nuevos[0]!.y)
          const respuesta = window.prompt(
            `Distancia real entre los dos puntos, en metros:\n(${px.toFixed(1)} unidades de plano)`,
            '3',
          )
          const metros = respuesta ? Number(respuesta.replace(',', '.')) : NaN

          if (Number.isFinite(metros) && metros > 0) {
            actualizar((p) => {
              const f = p.planos[0]?.fuente
              if (f) f.calibracion = { p1: nuevos[0]!, p2: nuevos[1]!, metrosReales: metros }
            })
          }
          setCalibrando([])
          useApp.getState().setHerramienta('seleccionar')
        } else {
          setCalibrando(nuevos)
        }
        break
      }

      default:
        setSeleccion([])
    }
  }

  const alSoltar = () => {
    setArrastrando(null)
    setPaneando(null)
  }

  const alRueda = (ev: React.WheelEvent) => {
    ev.preventDefault()
    const factor = ev.deltaY > 0 ? 1.12 : 1 / 1.12
    const foco = aCoordenadas(ev as unknown as React.MouseEvent)

    setVista((v) => ({
      x: foco.x - (foco.x - v.x) * factor,
      y: foco.y - (foco.y - v.y) * factor,
      ancho: v.ancho * factor,
      alto: v.alto * factor,
    }))
  }

  // Doble clic cierra el tramo en curso.
  const alDobleClic = () => {
    if (herramienta !== 'tramo' || tramoEnCurso.length < 2) return

    // Se vinculan los elementos que caen cerca de los vértices del tramo.
    const tolerancia = radioSnap * 2
    const cercanos = proyecto.elementos
      .filter((el) =>
        tramoEnCurso.some(
          (p) => Math.hypot(el.posicion.x - p.x, el.posicion.y - p.y) < tolerancia,
        ),
      )
      .map((el) => el.id)

    cerrarTramo(cercanos, 'RP 20')
  }

  useEffect(() => {
    const alTecla = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        cancelarTramo()
        setCalibrando([])
        setSeleccion([])
      }
      if (ev.key === 'Enter' && tramoEnCurso.length >= 2) alDobleClic()
    }
    window.addEventListener('keydown', alTecla)
    return () => window.removeEventListener('keydown', alTecla)
  })

  function ambienteEnPunto(p: Punto): string | undefined {
    for (const a of proyecto.inmueble.ambientes) {
      if (!a.poligono) continue
      if (dentro(p, a.poligono)) return a.id
    }
    return undefined
  }

  // --- Render --------------------------------------------------------------
  if (!plano) return <SinPlano onCargar={agregarPlano} />

  const tramoPreview =
    tramoEnCurso.length > 0 && cursor ? [...tramoEnCurso, cursor] : tramoEnCurso

  const escalaTexto = vista.ancho / 1200

  return (
    <div className="relative h-full w-full overflow-hidden bg-white">
      <svg
        ref={svgRef}
        className="h-full w-full"
        viewBox={`${vista.x} ${vista.y} ${vista.ancho} ${vista.alto}`}
        onMouseMove={alMover}
        onMouseDown={alPresionar}
        onMouseUp={alSoltar}
        onMouseLeave={alSoltar}
        onWheel={alRueda}
        onDoubleClick={alDobleClic}
        onContextMenu={(e) => e.preventDefault()}
        style={{ cursor: herramienta === 'seleccionar' ? 'default' : 'crosshair' }}
      >
        {/* Fondo raster */}
        {plano.fuente.tipo === 'raster' && urlImagen && (
          <image
            href={urlImagen}
            x={0}
            y={0}
            width={plano.fuente.anchoPx}
            height={plano.fuente.altoPx}
            preserveAspectRatio="none"
          />
        )}

        {/* Geometría CAD */}
        {plano.fuente.tipo === 'dxf' && (
          <CapaGeometriaCAD
            entidades={plano.fuente.entidades}
            capas={plano.fuente.capas}
            capasOcultas={capasOcultas}
            grosor={escalaTexto}
          />
        )}

        {/* Ambientes detectados */}
        {proyecto.inmueble.ambientes.map((a) =>
          a.poligono ? (
            <g key={a.id}>
              <polygon
                points={a.poligono.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="#22c55e"
                fillOpacity={0.06}
                stroke="#22c55e"
                strokeOpacity={0.5}
                strokeWidth={escalaTexto}
              />
            </g>
          ) : null,
        )}

        {/* Tramos */}
        {calculado.tramos.map((t) => {
          const hallazgos = validacion.porTramo.get(t.tramo.id)
          const sev = severidadMaxima(hallazgos)
          const color = sev === 'error' ? '#dc2626' : sev === 'advertencia' ? '#f59e0b' : '#64748b'

          return (
            <g key={t.tramo.id}>
              <polyline
                points={t.tramo.puntos.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={color}
                strokeWidth={2.5 * escalaTexto}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {t.longitudM !== null && (
                <text
                  x={t.tramo.puntos[0]!.x}
                  y={t.tramo.puntos[0]!.y - 6 * escalaTexto}
                  fontSize={11 * escalaTexto}
                  fill={color}
                  className="select-none"
                >
                  {fmtMetros(t.longitudM)}
                  {t.caneria ? ` · ${t.caneria.cano.designacion}` : ''}
                </text>
              )}
            </g>
          )
        })}

        {/* Tramo en curso */}
        {tramoPreview.length >= 2 && (
          <polyline
            points={tramoPreview.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#0ea5e9"
            strokeWidth={2.5 * escalaTexto}
            strokeDasharray={`${6 * escalaTexto} ${4 * escalaTexto}`}
          />
        )}

        {/* Calibración */}
        {calibrando.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4 * escalaTexto} fill="#0ea5e9" />
        ))}
        {calibrando.length === 1 && cursor && (
          <line
            x1={calibrando[0]!.x}
            y1={calibrando[0]!.y}
            x2={cursor.x}
            y2={cursor.y}
            stroke="#0ea5e9"
            strokeWidth={2 * escalaTexto}
            strokeDasharray={`${4 * escalaTexto} ${3 * escalaTexto}`}
          />
        )}

        {/* Elementos */}
        {proyecto.elementos.map((el) => {
          const simbolo = buscarSimbolo(el.simboloId)
          if (!simbolo) return null

          const circuito = proyecto.circuitos.find((c) => c.id === el.circuitoId)
          const color = circuito ? COLOR_CIRCUITO[circuito.tipo] ?? '#334155' : '#94a3b8'
          const activo = seleccion.includes(el.id)

          return (
            <SimboloSVG
              key={el.id}
              simbolo={simbolo}
              posicion={el.posicion}
              color={color}
              escala={escalaTexto}
              seleccionado={activo}
              onMouseDown={(ev) => {
                if (herramienta !== 'seleccionar') return
                ev.stopPropagation()
                setSeleccion(ev.shiftKey ? [...seleccion, el.id] : [el.id])
                setArrastrando(el.id)
              }}
            />
          )
        })}

        {/* Marca de enganche */}
        {snap && herramienta !== 'seleccionar' && (
          <g pointerEvents="none">
            <rect
              x={snap.punto.x - 5 * escalaTexto}
              y={snap.punto.y - 5 * escalaTexto}
              width={10 * escalaTexto}
              height={10 * escalaTexto}
              fill="none"
              stroke="#16a34a"
              strokeWidth={1.5 * escalaTexto}
            />
          </g>
        )}
      </svg>

      <BarraEstado
        escala={escala}
        cursor={cursor}
        snap={snap}
        tramoEnCurso={tramoEnCurso}
        cursorActual={cursor}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------

function dentro(p: Punto, poligono: Punto[]): boolean {
  let d = false
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i]!
    const b = poligono[j]!
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) d = !d
  }
  return d
}

function BarraEstado({
  escala,
  snap,
  tramoEnCurso,
  cursorActual,
}: {
  escala: ReturnType<typeof escalaDe> | null
  cursor: Punto | null
  snap: Snap | null
  tramoEnCurso: Punto[]
  cursorActual: Punto | null
}) {
  const longitud =
    escala?.calibrado && tramoEnCurso.length > 0 && cursorActual
      ? longitudPolilinea([...tramoEnCurso, cursorActual]) * escala.metrosPorUnidad
      : null

  return (
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex items-center gap-4 border-t border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-600 backdrop-blur">
      {escala?.calibrado ? (
        <span className="text-emerald-700">
          Escala {escala.origen === 'archivo' ? 'del archivo' : 'calibrada'}
        </span>
      ) : (
        <span className="font-medium text-amber-700">
          Sin calibrar — no se pueden medir longitudes
        </span>
      )}
      {snap && <span className="text-emerald-700">Enganche: {snap.tipo}</span>}
      {longitud !== null && <span>Tramo: {fmtMetros(longitud)}</span>}
      <span className="ml-auto text-slate-400">
        Rueda: zoom · Alt+arrastrar: desplazar · Doble clic o Enter: cerrar tramo · Esc: cancelar
      </span>
    </div>
  )
}

function SinPlano({ onCargar }: { onCargar: (p: never) => void }) {
  void onCargar
  return (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <div className="max-w-md">
        <h2 className="mb-2 text-lg font-medium text-slate-800">No hay plano cargado</h2>
        <p className="text-sm text-slate-600">
          Cargá una foto o escaneo del plano, o un archivo DXF. Si el DXF declara sus unidades, las
          longitudes salen exactas sin necesidad de calibrar.
        </p>
      </div>
    </div>
  )
}
