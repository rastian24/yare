/**
 * Esquema unifilar auto-generado (Anexo 770-A.1.2).
 *
 * El anexo exige "esquema unifilar de los tableros, incluyendo las
 * características nominales y de accionamiento de los dispositivos de maniobra
 * y protección [...] sección de la línea principal, de los circuitos
 * seccionales y terminales y de los conductores de protección".
 *
 * El layout es determinista: medidor, línea principal, tablero con seccionador
 * y diferencial, y una rama por circuito. Se dibuja en SVG para que salga
 * nítido al imprimir.
 */

import { useCalculo } from '@/estado/useCalculo'
import { seccionPAT } from '@/dominio/calculo/electrico'
import type { TipoCircuito } from '@/dominio/tipos'

const COLOR: Record<TipoCircuito, string> = {
  IUG: '#d97706',
  TUG: '#2563eb',
  TUE: '#dc2626',
}

const ANCHO_RAMA = 150
const Y_BARRA = 210
const ALTO_RAMA = 200

export function Unifilar() {
  const { calculado } = useCalculo()
  const { circuitos, proyecto } = calculado

  const ancho = Math.max(760, 120 + circuitos.length * ANCHO_RAMA)
  const alto = Y_BARRA + ALTO_RAMA + 90
  const trifasica = proyecto.suministro.fases === 'trifasica'

  if (circuitos.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-slate-500">
        El esquema unifilar se genera solo a partir de los circuitos del proyecto.
      </div>
    )
  }

  const seccionPrincipal = Math.max(4, ...circuitos.map((c) => c.circuito.seccionMm2))

  return (
    <div className="h-full overflow-auto bg-white p-6">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="font-medium text-slate-800">Esquema unifilar</h2>
        <span className="text-xs text-slate-500">Anexo 770-A.1.2</span>
        <button
          type="button"
          onClick={() => window.print()}
          className="ml-auto rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
        >
          Imprimir
        </button>
      </div>

      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        className="w-full"
        style={{ maxWidth: ancho }}
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {/* --- Acometida y medidor --- */}
        <text x={40} y={28} fontSize={11} fill="#64748b">
          {trifasica ? '3F + N + PE · 380 V' : '1F + N + PE · 220 V'}
        </text>
        <line x1={40} y1={52} x2={104} y2={52} stroke="#334155" strokeWidth={2} />
        <circle cx={122} cy={52} r={17} fill="none" stroke="#334155" strokeWidth={2} />
        <text x={122} y={56} textAnchor="middle" fontSize={12} fill="#334155">
          kWh
        </text>

        {/* --- Línea principal --- */}
        <line x1={139} y1={52} x2={250} y2={52} stroke="#334155" strokeWidth={2} />
        {/* El rótulo va debajo de la línea: arriba chocaría con el medidor. */}
        <text x={196} y={70} textAnchor="middle" fontSize={10} fill="#64748b">
          Línea principal {seccionPrincipal} mm²
        </text>

        {/* --- Seccionador de cabecera --- */}
        <Dispositivo
          x={250}
          y={52}
          ancho={96}
          etiqueta="Seccionador"
          detalle={`${Math.max(25, Math.ceil(calculado.corrienteTotalA))} A`}
        />

        <line x1={346} y1={52} x2={400} y2={52} stroke="#334155" strokeWidth={2} />

        {/* --- Interruptor diferencial (770.14.2) --- */}
        <Dispositivo
          x={400}
          y={52}
          ancho={96}
          etiqueta="ID 30 mA"
          detalle="tipo AC · instantáneo"
          resaltado
        />

        {/* --- Bajada a la barra --- */}
        <line x1={496} y1={52} x2={560} y2={52} stroke="#334155" strokeWidth={2} />
        <line x1={560} y1={52} x2={560} y2={Y_BARRA - 46} stroke="#334155" strokeWidth={2} />
        <line
          x1={60}
          y1={Y_BARRA - 46}
          x2={560}
          y2={Y_BARRA - 46}
          stroke="#334155"
          strokeWidth={2}
        />
        <line x1={60} y1={Y_BARRA - 46} x2={60} y2={Y_BARRA} stroke="#334155" strokeWidth={2} />

        {/* --- Barra del tablero --- */}
        <line x1={60} y1={Y_BARRA} x2={ancho - 40} y2={Y_BARRA} stroke="#334155" strokeWidth={3} />
        <text x={72} y={Y_BARRA - 10} fontSize={11} fill="#64748b">
          Tablero principal — barra de distribución
        </text>

        {/* --- Ramas --- */}
        {circuitos.map((c, i) => {
          const x = 100 + i * ANCHO_RAMA
          const color = COLOR[c.circuito.tipo]
          const excedeCaida =
            c.caidaPct !== null && c.caidaPct > proyecto.suministro.caidaTensionMaxPct

          return (
            <g key={c.circuito.id}>
              <line x1={x} y1={Y_BARRA} x2={x} y2={Y_BARRA + 40} stroke={color} strokeWidth={2} />

              {/* Termomagnética */}
              <rect
                x={x - 16}
                y={Y_BARRA + 40}
                width={32}
                height={30}
                fill="white"
                stroke={color}
                strokeWidth={2}
                rx={2}
              />
              <text x={x} y={Y_BARRA + 60} textAnchor="middle" fontSize={11} fill={color}>
                {c.circuito.proteccionIn} A
              </text>

              <line
                x1={x}
                y1={Y_BARRA + 70}
                x2={x}
                y2={Y_BARRA + 110}
                stroke={color}
                strokeWidth={2}
              />

              {/* Marca de sección: tres barritas sobre la línea */}
              <g stroke={color} strokeWidth={1.5}>
                <line x1={x - 6} y1={Y_BARRA + 86} x2={x + 6} y2={Y_BARRA + 80} />
              </g>
              <text x={x + 10} y={Y_BARRA + 86} fontSize={10} fill="#475569">
                {c.circuito.seccionMm2} mm²
              </text>

              {/* Rótulo del circuito */}
              <text
                x={x}
                y={Y_BARRA + 128}
                textAnchor="middle"
                fontSize={12}
                fontWeight={600}
                fill={color}
              >
                {c.circuito.nombre}
              </text>
              <text x={x} y={Y_BARRA + 144} textAnchor="middle" fontSize={10} fill="#64748b">
                {c.bocas} bocas · {c.dpmsVA.toFixed(0)} VA
              </text>
              <text x={x} y={Y_BARRA + 158} textAnchor="middle" fontSize={10} fill="#64748b">
                Ib {c.ibA.toFixed(1)} A · Iz {c.izA.toFixed(1)} A
              </text>
              <text
                x={x}
                y={Y_BARRA + 172}
                textAnchor="middle"
                fontSize={10}
                fill={excedeCaida ? '#dc2626' : '#64748b'}
                fontWeight={excedeCaida ? 600 : 400}
              >
                ΔU {c.caidaPct !== null ? `${c.caidaPct.toFixed(2)} %` : '—'}
              </text>
              <text x={x} y={Y_BARRA + 186} textAnchor="middle" fontSize={10} fill="#16a34a">
                PE {c.seccionPEMm2} mm²
              </text>
            </g>
          )
        })}

        {/* --- Puesta a tierra --- */}
        <g transform={`translate(${ancho - 70}, ${Y_BARRA + 20})`}>
          <line x1={0} y1={-20} x2={0} y2={20} stroke="#16a34a" strokeWidth={2} />
          <line x1={-14} y1={20} x2={14} y2={20} stroke="#16a34a" strokeWidth={2} />
          <line x1={-9} y1={26} x2={9} y2={26} stroke="#16a34a" strokeWidth={2} />
          <line x1={-4} y1={32} x2={4} y2={32} stroke="#16a34a" strokeWidth={2} />
          <text x={0} y={50} textAnchor="middle" fontSize={10} fill="#16a34a">
            PAT {seccionPAT(seccionPrincipal)} mm²
          </text>
        </g>
      </svg>

      <p className="mt-4 text-xs text-slate-500">
        Esquema generado automáticamente a partir de los circuitos del proyecto. La verificación de
        la capacidad de ruptura de las protecciones frente a la corriente presunta de cortocircuito
        (770.15.2) requiere el dato de la distribuidora y queda fuera de este esquema.
      </p>
    </div>
  )
}

function Dispositivo({
  x,
  y,
  ancho,
  etiqueta,
  detalle,
  resaltado,
}: {
  x: number
  y: number
  ancho: number
  etiqueta: string
  detalle: string
  resaltado?: boolean
}) {
  const color = resaltado ? '#16a34a' : '#334155'

  return (
    <g>
      <rect
        x={x}
        y={y - 16}
        width={ancho}
        height={32}
        fill="white"
        stroke={color}
        strokeWidth={2}
        rx={2}
      />
      <text x={x + ancho / 2} y={y + 4} textAnchor="middle" fontSize={11} fill={color}>
        {etiqueta}
      </text>
      <text x={x + ancho / 2} y={y + 30} textAnchor="middle" fontSize={9} fill="#64748b">
        {detalle}
      </text>
    </g>
  )
}
