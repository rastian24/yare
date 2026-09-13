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
import {
  areaPoligono,
  escalaDe,
  longitudPolilinea,
  puntoEnPoligono,
} from '@/dominio/calculo/longitudes'
import {
  ambienteDesdePoligono,
  centroide,
  cierraElContorno,
  medirPoligono,
  seCruzaConsigoMismo,
  VERTICES_MINIMOS,
} from '@/dominio/calculo/ambientes'
import { m2 as fmtM2, metros as fmtMetros } from '@/dominio/formato'
import { urlDeBlob } from '@/persistencia/db'
import { nuevoId } from '@/estado/store'
import { severidadMaxima } from '@/normativa/aea770/motor'
import { CapaGeometriaCAD } from './CapaGeometriaCAD'
import { NuevoAmbiente } from './NuevoAmbiente'
import { SimboloSVG } from './SimboloSVG'
import type { Escala, Plano, Punto, TipoAmbiente } from '@/dominio/tipos'

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

/**
 * Ancho de vista, en unidades de plano, para el que los trazos y textos tienen
 * su tamaño nominal en px. Con `vista.ancho` mayor los engrosamos y con uno
 * menor los afinamos, así se mantienen constantes en pantalla al hacer zoom.
 */
const ANCHO_REFERENCIA = 1200

/**
 * Encuadre que muestra el plano entero. Se usa para el arranque y, además,
 * como referencia de tamaño de los símbolos: al ser independiente del zoom,
 * los símbolos quedan anclados al plano en lugar de a la pantalla.
 */
function encuadreDe(plano: Plano): Vista {
  if (plano.fuente.tipo === 'dxf') {
    const { bbox } = plano.fuente
    const margen = Math.max(bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y) * 0.05
    return {
      x: bbox.min.x - margen,
      y: bbox.min.y - margen,
      ancho: bbox.max.x - bbox.min.x + margen * 2,
      alto: bbox.max.y - bbox.min.y + margen * 2,
    }
  }
  return { x: 0, y: 0, ancho: plano.fuente.anchoPx, alto: plano.fuente.altoPx }
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
    poligonoEnCurso,
    ortogonal,
    snapActivo,
    capasOcultas,
  } = useApp()
  const {
    agregarElemento,
    moverElemento,
    borrarElementos,
    setSeleccion,
    iniciarTramo,
    agregarPuntoTramo,
    cerrarTramo,
    cancelarTramo,
    iniciarPoligono,
    agregarPuntoPoligono,
    deshacerPuntoPoligono,
    cancelarPoligono,
    agregarAmbiente,
    remedirAmbientes,
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
  /** Contorno ya cerrado, a la espera de que se confirmen nombre y tipo. */
  const [ambientePendiente, setAmbientePendiente] = useState<Punto[] | null>(null)

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
    setVista(encuadreDe(plano))
  }, [plano?.id, plano?.fuente.tipo])

  // --- Índice de snapping --------------------------------------------------
  const indice = useMemo(() => {
    if (plano?.fuente.tipo !== 'dxf') return null
    const visibles = plano.fuente.entidades.filter((e) => !capasOcultas.has(e.capa))
    return new IndiceEspacial(visibles, plano.fuente.bbox)
  }, [plano, capasOcultas])

  const escala = plano ? escalaDe(plano) : null

  /**
   * Convierte coordenadas de pantalla a coordenadas del plano.
   *
   * Vía getScreenCTM(), no a mano con getBoundingClientRect(): el viewBox casi
   * nunca tiene la misma relación de aspecto que el panel, así que el
   * navegador lo letterboxea (preserveAspectRatio por defecto), y una regla de
   * tres simple sobre el rect queda desfasada del punto real bajo el cursor.
   * getScreenCTM() ya incorpora ese letterboxeo.
   */
  const aCoordenadas = useCallback((ev: React.MouseEvent): Punto => {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return { x: 0, y: 0 }

    const p = svg.createSVGPoint()
    p.x = ev.clientX
    p.y = ev.clientY
    const local = p.matrixTransform(ctm.inverse())

    return { x: local.x, y: local.y }
  }, [])

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

    const { punto, snap: s } = puntoEfectivo(bruto, anteriorParaOrtogonal())

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
    const { punto } = puntoEfectivo(bruto, anteriorParaOrtogonal())

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

      case 'ambiente': {
        // Sin escala no hay superficie, y un ambiente sin superficie no sirve
        // para nada aguas abajo: la barra de estado lo explica.
        if (!escala?.calibrado) return

        // Volver al primer vértice cierra el contorno, como en cualquier CAD.
        if (cierraElContorno(poligonoEnCurso, punto, radioSnap * 1.5)) {
          cerrarAmbiente()
          return
        }

        if (poligonoEnCurso.length === 0) iniciarPoligono(punto)
        else agregarPuntoPoligono(punto)
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
            // La escala cambió: los contornos ya marcados valen otra superficie.
            remedirAmbientes()
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

  /**
   * Cierra el contorno del ambiente y pasa a confirmar nombre y tipo.
   *
   * El doble clic deja repetido el último vértice —el segundo clic ya lo
   * agregó—, así que se descartan los consecutivos: no cambian la superficie
   * pero ensucian el contorno guardado.
   */
  const cerrarAmbiente = () => {
    const puntos = sinRepetidos(poligonoEnCurso)
    if (puntos.length < VERTICES_MINIMOS) return

    setAmbientePendiente(puntos)
    cancelarPoligono()
  }

  const crearAmbiente = (nombre: string, tipo: TipoAmbiente) => {
    if (!ambientePendiente) return

    const ambiente = ambienteDesdePoligono({
      id: nuevoId('amb'),
      nombre,
      tipo,
      poligono: ambientePendiente,
      escala,
    })

    if (ambiente) agregarAmbiente(ambiente)
    setAmbientePendiente(null)
  }

  // Doble clic cierra el tramo o el ambiente en curso.
  const alDobleClic = () => {
    if (herramienta === 'ambiente') {
      cerrarAmbiente()
      return
    }
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
      // Con el foco en un campo mandan las teclas del campo: Backspace borra
      // texto, no vértices.
      const destino = ev.target as HTMLElement | null
      if (destino && /^(INPUT|SELECT|TEXTAREA)$/.test(destino.tagName)) {
        if (ev.key === 'Escape') setAmbientePendiente(null)
        return
      }

      if (ev.key === 'Escape') {
        cancelarTramo()
        cancelarPoligono()
        setCalibrando([])
        setAmbientePendiente(null)
        setSeleccion([])
      }
      if (ev.key === 'Enter') {
        if (herramienta === 'ambiente') cerrarAmbiente()
        else if (tramoEnCurso.length >= 2) alDobleClic()
      }
      // Backspace deshace el último vértice, que es más barato que rehacer todo
      // el contorno por un clic mal puesto.
      if (ev.key === 'Backspace' && poligonoEnCurso.length > 0) {
        ev.preventDefault()
        deshacerPuntoPoligono()
      }
      // Suprimir borra los símbolos seleccionados. Vale con cualquier
      // herramienta activa: la selección sobrevive al cambio de herramienta, y
      // si no hay nada seleccionado no pasa nada.
      if (ev.key === 'Delete' && seleccion.length > 0) {
        ev.preventDefault()
        borrarElementos(seleccion)
      }
    }
    window.addEventListener('keydown', alTecla)
    return () => window.removeEventListener('keydown', alTecla)
  })

  /**
   * Ambiente que contiene al punto. Ante contornos anidados gana el más chico,
   * que es el local y no el envolvente.
   */
  function ambienteEnPunto(p: Punto): string | undefined {
    let elegido: { id: string; area: number } | null = null

    for (const a of proyecto.inmueble.ambientes) {
      if (!a.poligono || !puntoEnPoligono(p, a.poligono)) continue

      const area = areaPoligono(a.poligono)
      if (!elegido || area < elegido.area) elegido = { id: a.id, area }
    }

    return elegido?.id
  }

  /** Vértice desde el que se fuerza la ortogonalidad de la herramienta activa. */
  function anteriorParaOrtogonal(): Punto | undefined {
    if (herramienta === 'tramo') return tramoEnCurso.at(-1)
    if (herramienta === 'ambiente') return poligonoEnCurso.at(-1)
    // Calibrar mide sobre una pared, que en el plano es horizontal o vertical:
    // sin ortogonalidad un clic torcido alarga la referencia y la escala sale
    // corta para todo el proyecto.
    if (herramienta === 'calibrar') return calibrando.at(-1)
    return undefined
  }

  // --- Render --------------------------------------------------------------
  if (!plano) return <SinPlano />

  const tramoPreview =
    tramoEnCurso.length > 0 && cursor ? [...tramoEnCurso, cursor] : tramoEnCurso

  const contornoPreview =
    poligonoEnCurso.length > 0 && cursor ? [...poligonoEnCurso, cursor] : poligonoEnCurso
  const medidasContorno = medirPoligono(contornoPreview, escala)
  const contornoCruzado = seCruzaConsigoMismo(contornoPreview, true)
  const puedeCerrarContorno = sinRepetidos(poligonoEnCurso).length >= VERTICES_MINIMOS

  /** Factor para trazos y textos: compensa el zoom y los deja fijos en pantalla. */
  const escalaTexto = vista.ancho / ANCHO_REFERENCIA

  /**
   * Factor de los símbolos: fijo, atado al encuadre del plano y no al zoom.
   *
   * Un símbolo marca un punto de la instalación —una boca, un toma— que ocupa
   * un lugar concreto en la obra, así que tiene que crecer con el plano como
   * crecen los ambientes y el fondo. El encuadre completo da la referencia,
   * para que arranque del mismo tamaño aparente que antes y siga sirviendo en
   * un DXF en metros o en una foto de miles de píxeles.
   */
  const escalaSimbolo = encuadreDe(plano).ancho / ANCHO_REFERENCIA

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

        {/* Ambientes delimitados */}
        {proyecto.inmueble.ambientes.map((a) => {
          if (!a.poligono) return null
          const centro = centroide(a.poligono)

          return (
            <g key={a.id} pointerEvents="none">
              <polygon
                points={a.poligono.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="#22c55e"
                fillOpacity={0.06}
                stroke="#22c55e"
                strokeOpacity={0.5}
                strokeWidth={escalaTexto}
              />
              {centro && (
                <text
                  x={centro.x}
                  y={centro.y}
                  textAnchor="middle"
                  fontSize={12 * escalaTexto}
                  fill="#15803d"
                  className="select-none"
                >
                  <tspan x={centro.x}>{a.nombre}</tspan>
                  <tspan x={centro.x} dy={13 * escalaTexto} fontSize={10 * escalaTexto}>
                    {a.tipo === 'pasillo' || a.tipo === 'semicubierto'
                      ? `${fmtM2(a.superficieM2)} · ${fmtMetros(a.longitudM ?? 0)}`
                      : fmtM2(a.superficieM2)}
                  </tspan>
                </text>
              )}
            </g>
          )
        })}

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

        {/* Ambiente en curso */}
        {contornoPreview.length >= 2 && (
          <g pointerEvents="none">
            <polygon
              points={contornoPreview.map((p) => `${p.x},${p.y}`).join(' ')}
              fill={contornoCruzado ? '#f59e0b' : '#22c55e'}
              fillOpacity={0.14}
              stroke={contornoCruzado ? '#d97706' : '#16a34a'}
              strokeWidth={2 * escalaTexto}
              strokeDasharray={`${6 * escalaTexto} ${4 * escalaTexto}`}
            />
            {poligonoEnCurso.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                // El primer vértice se agranda cuando el contorno ya se puede
                // cerrar: es el blanco al que hay que volver.
                r={(i === 0 && puedeCerrarContorno ? 5 : 3) * escalaTexto}
                fill={i === 0 && puedeCerrarContorno ? '#fff' : '#16a34a'}
                stroke="#16a34a"
                strokeWidth={1.5 * escalaTexto}
              />
            ))}
            {medidasContorno && (
              <text
                x={centroide(contornoPreview)?.x ?? 0}
                y={centroide(contornoPreview)?.y ?? 0}
                textAnchor="middle"
                fontSize={13 * escalaTexto}
                fontWeight={600}
                fill="#15803d"
                className="select-none"
              >
                {fmtM2(medidasContorno.superficieM2)}
              </text>
            )}
          </g>
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
              escala={escalaSimbolo}
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

      {ambientePendiente && (
        <NuevoAmbiente
          poligono={ambientePendiente}
          escala={escala}
          bocasAdentro={
            proyecto.elementos.filter(
              (el) => !el.ambienteId && puntoEnPoligono(el.posicion, ambientePendiente),
            ).length
          }
          onCrear={crearAmbiente}
          onCancelar={() => setAmbientePendiente(null)}
        />
      )}

      <BarraEstado
        escala={escala}
        cursor={cursor}
        snap={snap}
        tramoEnCurso={tramoEnCurso}
        cursorActual={cursor}
        herramienta={herramienta}
        superficieContorno={medidasContorno?.superficieM2 ?? null}
        verticesContorno={poligonoEnCurso.length}
        contornoCruzado={contornoCruzado}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------

/** Descarta vértices consecutivos repetidos, que no aportan al contorno. */
function sinRepetidos(puntos: Punto[]): Punto[] {
  return puntos.filter((p, i) => {
    const previo = puntos[i - 1]
    return !previo || Math.hypot(p.x - previo.x, p.y - previo.y) > 1e-9
  })
}

const AYUDA_POR_HERRAMIENTA: Record<string, string> = {
  seleccionar: 'Clic: seleccionar · Shift+clic: sumar · Arrastrar: mover · Supr: borrar',
  ambiente: 'Clic: vértice · Doble clic, Enter o volver al primer vértice: cerrar · Backspace: deshacer · Esc: cancelar',
  tramo: 'Doble clic o Enter: cerrar tramo · Esc: cancelar',
}

function BarraEstado({
  escala,
  snap,
  tramoEnCurso,
  cursorActual,
  herramienta,
  superficieContorno,
  verticesContorno,
  contornoCruzado,
}: {
  escala: Escala | null
  cursor: Punto | null
  snap: Snap | null
  tramoEnCurso: Punto[]
  cursorActual: Punto | null
  herramienta: string
  /** Superficie del contorno que se está marcando, en m². */
  superficieContorno: number | null
  verticesContorno: number
  contornoCruzado: boolean
}) {
  const longitud =
    escala?.calibrado && tramoEnCurso.length > 0 && cursorActual
      ? longitudPolilinea([...tramoEnCurso, cursorActual]) * escala.metrosPorUnidad
      : null

  const ayuda = AYUDA_POR_HERRAMIENTA[herramienta]

  return (
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex items-center gap-4 border-t border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-600 backdrop-blur">
      {escala?.calibrado ? (
        <span className="text-emerald-700">
          Escala {escala.origen === 'archivo' ? 'del archivo' : 'calibrada'}
        </span>
      ) : (
        <span className="font-medium text-amber-700">
          Sin calibrar — no se pueden medir longitudes ni superficies
        </span>
      )}
      {snap && <span className="text-emerald-700">Enganche: {snap.tipo}</span>}
      {longitud !== null && <span>Tramo: {fmtMetros(longitud)}</span>}

      {herramienta === 'ambiente' && (
        <span className={contornoCruzado ? 'font-medium text-amber-700' : ''}>
          {superficieContorno !== null
            ? `Ambiente: ${fmtM2(superficieContorno)} · ${verticesContorno} vértices`
            : escala?.calibrado
              ? 'Marcá los vértices del ambiente'
              : 'Calibrá el plano para poder medir la superficie'}
          {contornoCruzado && ' · el contorno se cruza consigo mismo'}
        </span>
      )}

      <span className="ml-auto text-slate-400">
        Rueda: zoom · Alt+arrastrar: desplazar{ayuda ? ` · ${ayuda}` : ''}
      </span>
    </div>
  )
}

function SinPlano() {
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
