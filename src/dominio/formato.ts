/**
 * Formato de números en español rioplatense.
 *
 * La norma escribe las secciones con coma decimal ("2,5 mm²", "1,5 mm²") y
 * separa los miles con espacio ("2 200 VA"). Usar el formato por defecto de
 * JavaScript daría "2.5 mm²", que en un documento técnico argentino se lee como
 * otra cosa.
 */

const NUM = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 })

/** Número con coma decimal. */
export function num(valor: number, decimales?: number): string {
  if (decimales !== undefined) {
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    }).format(valor)
  }
  return NUM.format(valor)
}

/** Sección de conductor, p. ej. "2,5 mm²". */
export function mm2(valor: number): string {
  return `${num(valor)} mm²`
}

/** Corriente, p. ej. "10,5 A". */
export function amp(valor: number, decimales = 1): string {
  return `${num(valor, decimales)} A`
}

/** Longitud en metros, p. ej. "8,20 m". */
export function metros(valor: number, decimales = 2): string {
  return `${num(valor, decimales)} m`
}

/** Superficie, p. ej. "12,50 m²". */
export function m2(valor: number, decimales = 2): string {
  return `${num(valor, decimales)} m²`
}

/** Porcentaje, p. ej. "2,05 %". */
export function pct(valor: number, decimales = 2): string {
  return `${num(valor, decimales)} %`
}

/** Potencia aparente, p. ej. "2 200 VA". */
export function va(valor: number): string {
  return `${num(valor, 0)} VA`
}

/** Potencia aparente en kVA, p. ej. "7,20 kVA". */
export function kva(valorVA: number): string {
  return `${num(valorVA / 1000, 2)} kVA`
}
