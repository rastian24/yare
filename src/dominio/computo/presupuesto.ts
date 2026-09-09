/**
 * Presupuesto: materiales más mano de obra.
 *
 * La convención argentina para cotizar instalaciones eléctricas es "por boca":
 * cada punto útil (boca de luz, tomacorriente, llave) se cobra como una unidad
 * que ya incluye caño, cable, caja y conexión. Acá se usa esa convención para
 * la mano de obra, pero manteniendo el cómputo de materiales por separado, que
 * es lo que da trazabilidad y lo que exige el Anexo 770-A.1.4.
 *
 * Sobre los precios: con la inflación argentina cualquier precio embebido nace
 * viejo. La lista es totalmente editable, lleva fecha de actualización visible
 * y se puede importar y exportar. Los valores sembrados son ORIENTATIVOS, del
 * orden de magnitud de plaza al momento de escribir esto, y no pretenden ser
 * precios vigentes.
 */

import { buscarSimbolo } from '@/simbologia/catalogo'
import { computarMateriales, NOMBRE_CATEGORIA, type ItemMaterial } from './materiales'
import type { ListaPrecios, PrecioItem } from '@/dominio/tipos'
import type { ProyectoCalculado } from '@/dominio/calculo/proyecto'

export interface LineaPresupuesto {
  id: string
  descripcion: string
  rubro: string
  cantidad: number
  unidad: string
  precioUnitarioARS: number
  subtotalARS: number
  /** Verdadero si no hay precio cargado para el ítem. */
  sinPrecio: boolean
}

export interface Presupuesto {
  materiales: LineaPresupuesto[]
  manoDeObra: LineaPresupuesto[]
  subtotalMaterialesARS: number
  subtotalManoObraARS: number
  subtotalARS: number
  ayudaGremioARS: number
  gastosGeneralesARS: number
  beneficioARS: number
  netoARS: number
  ivaARS: number
  totalARS: number
  /** Ítems sin precio cargado. El total es parcial mientras haya alguno. */
  itemsSinPrecio: string[]
  actualizadaEn: string
}

// ---------------------------------------------------------------------------
// Lista de precios sembrada
// ---------------------------------------------------------------------------

/**
 * Identificadores de mano de obra. La unidad es la boca, salvo el tablero y la
 * puesta a tierra, que se cotizan globales, y la cañería, que va por metro.
 */
export const MO = {
  bocaIUG: 'mo_boca_iug',
  bocaTUG: 'mo_boca_tug',
  bocaTUE: 'mo_boca_tue',
  interruptor: 'mo_interruptor',
  tablero: 'mo_tablero',
  puestaTierra: 'mo_puesta_tierra',
  caneria: 'mo_caneria',
  calado: 'mo_calado',
} as const

/**
 * Precios de referencia. Marcados explícitamente como orientativos: hay que
 * reemplazarlos por la lista propia antes de presentar un presupuesto.
 */
export function listaPreciosPorDefecto(): ListaPrecios {
  const items: PrecioItem[] = [
    // Mano de obra — convención "por boca"
    { id: MO.bocaIUG, descripcion: 'Boca de iluminación (IUG)', unidad: 'unidad', precioARS: 18000, categoria: 'mano_obra' },
    { id: MO.bocaTUG, descripcion: 'Boca de tomacorriente (TUG)', unidad: 'unidad', precioARS: 18000, categoria: 'mano_obra' },
    { id: MO.bocaTUE, descripcion: 'Boca de tomacorriente especial (TUE)', unidad: 'unidad', precioARS: 26000, categoria: 'mano_obra' },
    { id: MO.interruptor, descripcion: 'Interruptor de efecto', unidad: 'unidad', precioARS: 12000, categoria: 'mano_obra' },
    { id: MO.tablero, descripcion: 'Armado y conexionado de tablero', unidad: 'global', precioARS: 180000, categoria: 'mano_obra' },
    { id: MO.puestaTierra, descripcion: 'Puesta a tierra (jabalina y conexionado)', unidad: 'global', precioARS: 95000, categoria: 'mano_obra' },
    { id: MO.caneria, descripcion: 'Tendido de cañería', unidad: 'metro', precioARS: 4500, categoria: 'mano_obra' },
    { id: MO.calado, descripcion: 'Calado de canaleta en mampostería', unidad: 'metro', precioARS: 5500, categoria: 'mano_obra' },

    // Conductores
    { id: 'cable-vivo-1.5', descripcion: 'Cable 1,5 mm² marrón', unidad: 'metro', precioARS: 750, categoria: 'cable' },
    { id: 'cable-neutro-1.5', descripcion: 'Cable 1,5 mm² celeste', unidad: 'metro', precioARS: 750, categoria: 'cable' },
    { id: 'cable-pe-1.5', descripcion: 'Cable 1,5 mm² verde y amarillo', unidad: 'metro', precioARS: 750, categoria: 'cable' },
    { id: 'cable-vivo-2.5', descripcion: 'Cable 2,5 mm² marrón', unidad: 'metro', precioARS: 1150, categoria: 'cable' },
    { id: 'cable-neutro-2.5', descripcion: 'Cable 2,5 mm² celeste', unidad: 'metro', precioARS: 1150, categoria: 'cable' },
    { id: 'cable-pe-2.5', descripcion: 'Cable 2,5 mm² verde y amarillo', unidad: 'metro', precioARS: 1150, categoria: 'cable' },
    { id: 'cable-vivo-4', descripcion: 'Cable 4 mm² marrón', unidad: 'metro', precioARS: 1850, categoria: 'cable' },
    { id: 'cable-neutro-4', descripcion: 'Cable 4 mm² celeste', unidad: 'metro', precioARS: 1850, categoria: 'cable' },
    { id: 'cable-pe-4', descripcion: 'Cable 4 mm² verde y amarillo', unidad: 'metro', precioARS: 1850, categoria: 'cable' },
    { id: 'cable-vivo-6', descripcion: 'Cable 6 mm² marrón', unidad: 'metro', precioARS: 2700, categoria: 'cable' },
    { id: 'cable-neutro-6', descripcion: 'Cable 6 mm² celeste', unidad: 'metro', precioARS: 2700, categoria: 'cable' },
    { id: 'cable-pe-6', descripcion: 'Cable 6 mm² verde y amarillo', unidad: 'metro', precioARS: 2700, categoria: 'cable' },
    { id: 'cable-pat-4', descripcion: 'Cable de puesta a tierra 4 mm²', unidad: 'metro', precioARS: 1850, categoria: 'cable' },
    { id: 'cable-pat-6', descripcion: 'Cable de puesta a tierra 6 mm²', unidad: 'metro', precioARS: 2700, categoria: 'cable' },

    // Cañerías, por barra de 3 m
    { id: 'cano-RP 16', descripcion: 'Caño rígido pesado 16 mm × 3 m', unidad: 'barra_3m', precioARS: 5200, categoria: 'cano' },
    { id: 'cano-RP 20', descripcion: 'Caño rígido pesado 20 mm × 3 m', unidad: 'barra_3m', precioARS: 6800, categoria: 'cano' },
    { id: 'cano-RP 25', descripcion: 'Caño rígido pesado 25 mm × 3 m', unidad: 'barra_3m', precioARS: 8900, categoria: 'cano' },
    { id: 'cano-RS 16', descripcion: 'Caño acero semipesado 16 mm × 3 m', unidad: 'barra_3m', precioARS: 11500, categoria: 'cano' },
    { id: 'cano-RS 19', descripcion: 'Caño acero semipesado 19 mm × 3 m', unidad: 'barra_3m', precioARS: 14200, categoria: 'cano' },
    { id: 'cano-CL 19', descripcion: 'Caño corrugado liviano 19 mm × 3 m', unidad: 'barra_3m', precioARS: 3100, categoria: 'cano' },
    { id: 'cano-CL 22', descripcion: 'Caño corrugado liviano 22 mm × 3 m', unidad: 'barra_3m', precioARS: 3900, categoria: 'cano' },

    // Cajas y módulos
    { id: 'mat-caja_rectangular', descripcion: 'Caja rectangular 50 × 100 mm', unidad: 'unidad', precioARS: 1400, categoria: 'caja' },
    { id: 'mat-caja_cuadrada', descripcion: 'Caja cuadrada 100 × 100 mm', unidad: 'unidad', precioARS: 2100, categoria: 'caja' },
    { id: 'mat-caja_octogonal_chica', descripcion: 'Caja octogonal chica', unidad: 'unidad', precioARS: 1500, categoria: 'caja' },
    { id: 'mat-caja_octogonal_grande', descripcion: 'Caja octogonal grande', unidad: 'unidad', precioARS: 2200, categoria: 'caja' },
    { id: 'mat-portalampara', descripcion: 'Portalámpara', unidad: 'unidad', precioARS: 1900, categoria: 'caja' },
    { id: 'mat-modulo_toma_10a', descripcion: 'Módulo toma 2P+T 10 A', unidad: 'unidad', precioARS: 4200, categoria: 'modulo' },
    { id: 'mat-modulo_toma_20a', descripcion: 'Módulo toma 2P+T 20 A', unidad: 'unidad', precioARS: 7800, categoria: 'modulo' },
    { id: 'mat-modulo_llave', descripcion: 'Módulo interruptor unipolar', unidad: 'unidad', precioARS: 3600, categoria: 'modulo' },
    { id: 'mat-modulo_combinacion', descripcion: 'Módulo interruptor de combinación', unidad: 'unidad', precioARS: 4800, categoria: 'modulo' },
    { id: 'mat-modulo_punto_muerto', descripcion: 'Módulo interruptor de punto muerto', unidad: 'unidad', precioARS: 6200, categoria: 'modulo' },
    { id: 'mat-bastidor_tapa', descripcion: 'Bastidor y tapa', unidad: 'unidad', precioARS: 3400, categoria: 'modulo' },

    // Tablero
    { id: 'termica-10', descripcion: 'Termomagnética bipolar 10 A curva C', unidad: 'unidad', precioARS: 17000, categoria: 'tablero' },
    { id: 'termica-16', descripcion: 'Termomagnética bipolar 16 A curva C', unidad: 'unidad', precioARS: 17000, categoria: 'tablero' },
    { id: 'termica-20', descripcion: 'Termomagnética bipolar 20 A curva C', unidad: 'unidad', precioARS: 17500, categoria: 'tablero' },
    { id: 'termica-25', descripcion: 'Termomagnética bipolar 25 A curva C', unidad: 'unidad', precioARS: 18500, categoria: 'tablero' },
    { id: 'termica-32', descripcion: 'Termomagnética bipolar 32 A curva C', unidad: 'unidad', precioARS: 19500, categoria: 'tablero' },
    { id: 'diferencial', descripcion: 'Interruptor diferencial 2×40 A 30 mA', unidad: 'unidad', precioARS: 62000, categoria: 'tablero' },
    { id: 'seccionador', descripcion: 'Interruptor seccionador de cabecera', unidad: 'unidad', precioARS: 24000, categoria: 'tablero' },
    { id: 'gabinete', descripcion: 'Gabinete para tablero', unidad: 'unidad', precioARS: 45000, categoria: 'tablero' },

    // Puesta a tierra
    { id: 'mat-jabalina', descripcion: 'Jabalina 3/4" × 1,5 m', unidad: 'unidad', precioARS: 32000, categoria: 'pat' },
    { id: 'mat-tomacable', descripcion: 'Tomacable para jabalina', unidad: 'unidad', precioARS: 6500, categoria: 'pat' },
    { id: 'mat-caja_inspeccion_pat', descripcion: 'Caja de inspección de puesta a tierra', unidad: 'unidad', precioARS: 14000, categoria: 'pat' },
  ]

  return {
    actualizadaEn: new Date().toISOString().slice(0, 10),
    items,
    ayudaGremioPct: 0,
    gastosGeneralesPct: 15,
    beneficioPct: 20,
    ivaPct: 21,
  }
}

// ---------------------------------------------------------------------------
// Cálculo del presupuesto
// ---------------------------------------------------------------------------

/** Cantidades de mano de obra, en la unidad de cada ítem. */
export interface ComputoManoObra {
  bocasIUG: number
  bocasTUG: number
  bocasTUE: number
  interruptores: number
  tableros: number
  puestasTierra: number
  metrosCaneria: number
}

export function computarManoObra(p: ProyectoCalculado): ComputoManoObra {
  let bocasIUG = 0
  let bocasTUG = 0
  let bocasTUE = 0
  let interruptores = 0
  let tableros = 0
  let puestasTierra = 0

  const tipoPorCircuito = new Map(p.circuitos.map((c) => [c.circuito.id, c.circuito.tipo]))

  for (const el of p.proyecto.elementos) {
    const simbolo = buscarSimbolo(el.simboloId)
    if (!simbolo) continue

    if (simbolo.categoria === 'tablero') {
      tableros++
      continue
    }
    if (simbolo.categoria === 'puesta_tierra') {
      puestasTierra++
      continue
    }
    if (simbolo.categoria === 'interruptor') {
      interruptores++
      continue
    }
    if (!simbolo.computaComoBoca) continue

    const tipo = el.circuitoId ? tipoPorCircuito.get(el.circuitoId) : undefined

    switch (tipo ?? (simbolo.categoria === 'iluminacion' ? 'IUG' : 'TUG')) {
      case 'IUG':
        bocasIUG++
        break
      case 'TUG':
        bocasTUG++
        break
      case 'TUE':
        bocasTUE++
        break
    }
  }

  const metrosCaneria = p.tramos.reduce((sum, t) => sum + (t.longitudM ?? 0), 0)

  return { bocasIUG, bocasTUG, bocasTUE, interruptores, tableros, puestasTierra, metrosCaneria }
}

export function calcularPresupuesto(p: ProyectoCalculado): Presupuesto {
  const precios = p.proyecto.precios
  const porId = new Map(precios.items.map((i) => [i.id, i]))
  const sinPrecio: string[] = []

  const linea = (
    id: string,
    descripcionFallback: string,
    rubro: string,
    cantidad: number,
    unidad: string,
  ): LineaPresupuesto => {
    const precio = porId.get(id)
    if (!precio) sinPrecio.push(descripcionFallback)

    const precioUnitarioARS = precio?.precioARS ?? 0
    return {
      id,
      descripcion: precio?.descripcion ?? descripcionFallback,
      rubro,
      cantidad,
      unidad,
      precioUnitarioARS,
      subtotalARS: precioUnitarioARS * cantidad,
      sinPrecio: !precio,
    }
  }

  // --- Materiales ----------------------------------------------------------
  const materialesComputados: ItemMaterial[] = computarMateriales(p)
  const materiales = materialesComputados.map((m) =>
    linea(m.id, m.descripcion, NOMBRE_CATEGORIA[m.categoria], m.cantidad, unidadLegible(m.unidad)),
  )

  // --- Mano de obra --------------------------------------------------------
  const mo = computarManoObra(p)
  const manoDeObra: LineaPresupuesto[] = []

  const agregarMO = (id: string, fallback: string, cantidad: number, unidad: string) => {
    if (cantidad > 0) manoDeObra.push(linea(id, fallback, 'Mano de obra', cantidad, unidad))
  }

  agregarMO(MO.bocaIUG, 'Boca de iluminación (IUG)', mo.bocasIUG, 'boca')
  agregarMO(MO.bocaTUG, 'Boca de tomacorriente (TUG)', mo.bocasTUG, 'boca')
  agregarMO(MO.bocaTUE, 'Boca de tomacorriente especial (TUE)', mo.bocasTUE, 'boca')
  agregarMO(MO.interruptor, 'Interruptor de efecto', mo.interruptores, 'u')
  agregarMO(MO.tablero, 'Armado y conexionado de tablero', mo.tableros, 'global')
  agregarMO(MO.puestaTierra, 'Puesta a tierra', mo.puestasTierra, 'global')
  agregarMO(MO.caneria, 'Tendido de cañería', Math.ceil(mo.metrosCaneria), 'm')

  // --- Totales -------------------------------------------------------------
  const subtotalMaterialesARS = suma(materiales)
  const subtotalManoObraARS = suma(manoDeObra)
  const subtotalARS = subtotalMaterialesARS + subtotalManoObraARS

  const ayudaGremioARS = subtotalARS * (precios.ayudaGremioPct / 100)
  const gastosGeneralesARS = subtotalARS * (precios.gastosGeneralesPct / 100)
  const beneficioARS = subtotalARS * (precios.beneficioPct / 100)
  const netoARS = subtotalARS + ayudaGremioARS + gastosGeneralesARS + beneficioARS
  const ivaARS = netoARS * (precios.ivaPct / 100)

  return {
    materiales,
    manoDeObra,
    subtotalMaterialesARS,
    subtotalManoObraARS,
    subtotalARS,
    ayudaGremioARS,
    gastosGeneralesARS,
    beneficioARS,
    netoARS,
    ivaARS,
    totalARS: netoARS + ivaARS,
    itemsSinPrecio: [...new Set(sinPrecio)],
    actualizadaEn: precios.actualizadaEn,
  }
}

function suma(lineas: LineaPresupuesto[]): number {
  return lineas.reduce((total, l) => total + l.subtotalARS, 0)
}

function unidadLegible(u: ItemMaterial['unidad']): string {
  switch (u) {
    case 'm':
      return 'm'
    case 'barra':
      return 'barra 3 m'
    case 'u':
      return 'u'
  }
}

/** Formatea un importe en pesos argentinos. */
export function formatoARS(valor: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(valor)
}
