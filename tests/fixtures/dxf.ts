/**
 * Fixtures DXF mínimos, escritos a mano.
 *
 * Un DXF ASCII es una secuencia de pares (código de grupo, valor), uno por
 * línea. Estos archivos traen lo justo para ejercitar el importador: cabecera
 * con $INSUNITS, tabla de capas, entidades y bloques.
 */

interface OpcionesDxf {
  /** Valor del grupo 70 de $INSUNITS. 0 = sin definir, 4 = mm, 5 = cm, 6 = m. */
  insUnits?: number
  entidades?: string
  bloques?: string
  capas?: string[]
}

function tabla(capas: string[]): string {
  const filas = capas
    .map(
      (nombre) => `0
LAYER
2
${nombre}
70
0
62
7`,
    )
    .join('\n')

  return `0
SECTION
2
TABLES
0
TABLE
2
LAYER
${filas}
0
ENDTAB
0
ENDSEC`
}

export function dxf({ insUnits = 0, entidades = '', bloques = '', capas = ['0'] }: OpcionesDxf): string {
  // Un DXF ASCII se lee de a PARES de líneas (código, valor). Una línea vacía
  // desalinea todo lo que viene después, así que las secciones vacías no deben
  // dejar rastro: se arma la lista y se filtran los tramos vacíos.
  const partes = [
    '0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n' + insUnits + '\n0\nENDSEC',
    tabla(capas),
    '0\nSECTION\n2\nBLOCKS',
    bloques,
    '0\nENDSEC',
    '0\nSECTION\n2\nENTITIES',
    entidades,
    '0\nENDSEC',
    '0\nEOF',
  ]

  return partes.filter((p) => p.length > 0).join('\n')
}

/** Polilínea cerrada rectangular, en la capa indicada. */
export function rectangulo(
  x: number,
  y: number,
  ancho: number,
  alto: number,
  capa = '0',
): string {
  const v = (px: number, py: number) => `10
${px}
20
${py}`

  return `0
LWPOLYLINE
8
${capa}
90
4
70
1
${v(x, y)}
${v(x + ancho, y)}
${v(x + ancho, y + alto)}
${v(x, y + alto)}`
}

/** Polilínea cerrada en forma de L. */
export function poligonoL(escala: number, capa = '0'): string {
  const pts: Array<[number, number]> = [
    [0, 0],
    [2 * escala, 0],
    [2 * escala, escala],
    [escala, escala],
    [escala, 2 * escala],
    [0, 2 * escala],
  ]

  const vertices = pts.map(([px, py]) => `10
${px}
20
${py}`).join('\n')

  return `0
LWPOLYLINE
8
${capa}
90
${pts.length}
70
1
${vertices}`
}

export function linea(x1: number, y1: number, x2: number, y2: number, capa = '0'): string {
  return `0
LINE
8
${capa}
10
${x1}
20
${y1}
11
${x2}
21
${y2}`
}

export function texto(x: number, y: number, contenido: string, capa = '0', altura = 100): string {
  return `0
TEXT
8
${capa}
10
${x}
20
${y}
40
${altura}
1
${contenido}`
}

/** Bloque con un rectángulo adentro, para probar la denormalización de INSERT. */
export function bloqueRectangulo(nombre: string, ancho: number, alto: number): string {
  return `0
BLOCK
2
${nombre}
10
0
20
0
${rectangulo(0, 0, ancho, alto)}
0
ENDBLK`
}

export function insert(nombre: string, x: number, y: number, escala = 1, capa = '0'): string {
  return `0
INSERT
8
${capa}
2
${nombre}
10
${x}
20
${y}
41
${escala}
42
${escala}`
}
