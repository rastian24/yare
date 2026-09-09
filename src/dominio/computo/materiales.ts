/**
 * Cómputo de materiales (Anexo 770-A.1.4, que lo exige como contenido mínimo
 * del proyecto).
 *
 * Es una función pura sobre el proyecto calculado: no se persiste nada, así
 * que la lista no puede quedar desincronizada del plano.
 */

import { CANALIZACION } from '@/normativa/aea770/tablas'
import { buscarCano } from '@/normativa/aea770/canerias'
import { buscarSimbolo } from '@/simbologia/catalogo'
import { seccionPAT } from '@/dominio/calculo/electrico'
import { metros, mm2 } from '@/dominio/formato'
import type { ProyectoCalculado } from '@/dominio/calculo/proyecto'

export type CategoriaMaterial = 'cable' | 'cano' | 'caja' | 'modulo' | 'tablero' | 'pat'

export interface ItemMaterial {
  id: string
  descripcion: string
  categoria: CategoriaMaterial
  cantidad: number
  unidad: 'm' | 'u' | 'barra'
  /** Referencia normativa que justifica el ítem, cuando hay una. */
  clausula?: string
  /** Detalle de cómo se llegó a la cantidad, para poder auditarla. */
  detalle?: string
}

/** Nombres legibles de los materiales que arrastran los símbolos. */
const NOMBRE_MATERIAL: Record<string, { descripcion: string; categoria: CategoriaMaterial }> = {
  caja_rectangular: { descripcion: 'Caja rectangular 50 × 100 mm', categoria: 'caja' },
  caja_cuadrada: { descripcion: 'Caja cuadrada 100 × 100 mm', categoria: 'caja' },
  caja_octogonal_chica: { descripcion: 'Caja octogonal chica', categoria: 'caja' },
  caja_octogonal_grande: { descripcion: 'Caja octogonal grande', categoria: 'caja' },
  caja_inspeccion_pat: { descripcion: 'Caja de inspección de puesta a tierra', categoria: 'pat' },
  modulo_toma_10a: { descripcion: 'Módulo tomacorriente 2P+T 10 A (IRAM 2071)', categoria: 'modulo' },
  modulo_toma_20a: { descripcion: 'Módulo tomacorriente 2P+T 20 A (IRAM 2071)', categoria: 'modulo' },
  modulo_llave: { descripcion: 'Módulo interruptor unipolar 10 A', categoria: 'modulo' },
  modulo_combinacion: { descripcion: 'Módulo interruptor de combinación', categoria: 'modulo' },
  modulo_punto_muerto: { descripcion: 'Módulo interruptor de punto muerto', categoria: 'modulo' },
  bastidor_tapa: { descripcion: 'Bastidor y tapa', categoria: 'modulo' },
  portalampara: { descripcion: 'Portalámpara', categoria: 'caja' },
  jabalina: { descripcion: 'Jabalina de puesta a tierra 3/4" × 1,5 m', categoria: 'pat' },
  tomacable: { descripcion: 'Tomacable para jabalina', categoria: 'pat' },
}

/** Colores normalizados de los conductores. */
const COLOR_CONDUCTOR = {
  vivo: 'marrón',
  neutro: 'celeste',
  proteccion: 'verde y amarillo',
} as const

export function computarMateriales(p: ProyectoCalculado): ItemMaterial[] {
  const items = new Map<string, ItemMaterial>()

  const sumar = (item: Omit<ItemMaterial, 'cantidad'> & { cantidad: number }) => {
    const existente = items.get(item.id)
    if (existente) existente.cantidad += item.cantidad
    else items.set(item.id, { ...item })
  }

  // -------------------------------------------------------------------------
  // Cable, por circuito y sección
  // -------------------------------------------------------------------------
  // La longitud de cable de un circuito es la suma de los tramos que recorre,
  // multiplicada por la cantidad de conductores que lleva. El PE se computa
  // aparte porque su sección puede diferir (Tabla 770.14.I).
  const conductoresPorCircuito = p.proyecto.suministro.fases === 'trifasica' ? 4 : 2

  const metrosPorCircuito = new Map<string, number>()
  for (const t of p.tramos) {
    if (t.longitudM === null) continue
    for (const cid of t.circuitoIds) {
      metrosPorCircuito.set(cid, (metrosPorCircuito.get(cid) ?? 0) + t.longitudM)
    }
  }

  for (const c of p.circuitos) {
    const metrosDelCircuito = metrosPorCircuito.get(c.circuito.id)
    if (!metrosDelCircuito) continue

    const s = c.circuito.seccionMm2

    sumar({
      id: `cable-vivo-${s}`,
      descripcion: `Cable unipolar ${mm2(s)} ${COLOR_CONDUCTOR.vivo} (IRAM-NM 247-3)`,
      categoria: 'cable',
      cantidad: metrosDelCircuito * (conductoresPorCircuito - 1),
      unidad: 'm',
      clausula: '770.10.2',
    })

    sumar({
      id: `cable-neutro-${s}`,
      descripcion: `Cable unipolar ${mm2(s)} ${COLOR_CONDUCTOR.neutro} (IRAM-NM 247-3)`,
      categoria: 'cable',
      cantidad: metrosDelCircuito,
      unidad: 'm',
      clausula: '770.10.2',
    })

    sumar({
      id: `cable-pe-${c.seccionPEMm2}`,
      descripcion: `Cable unipolar ${mm2(c.seccionPEMm2)} ${COLOR_CONDUCTOR.proteccion} (conductor de protección)`,
      categoria: 'cable',
      cantidad: metrosDelCircuito,
      unidad: 'm',
      clausula: '770.14.4.5',
    })
  }

  // -------------------------------------------------------------------------
  // Cañería, redondeada a barras de 3 m
  // -------------------------------------------------------------------------
  const metrosPorCano = new Map<string, number>()
  for (const t of p.tramos) {
    if (t.longitudM === null) continue
    const designacion = t.caneriaElegida ?? t.caneria?.cano.designacion ?? t.tramo.tipoCano
    metrosPorCano.set(designacion, (metrosPorCano.get(designacion) ?? 0) + t.longitudM)
  }

  for (const [designacion, metrosDelCano] of metrosPorCano) {
    const cano = buscarCano(designacion)
    const barras = Math.ceil(metrosDelCano / CANALIZACION.largoBarraM)

    sumar({
      id: `cano-${designacion}`,
      descripcion: `Caño ${designacion}${cano?.comercial ? ` (${cano.comercial})` : ''}`,
      categoria: 'cano',
      cantidad: barras,
      unidad: 'barra',
      clausula: '770.10.3',
      detalle: `${metros(metrosDelCano)} en barras de ${CANALIZACION.largoBarraM} m`,
    })
  }

  // -------------------------------------------------------------------------
  // Cajas, módulos y accesorios, desde los símbolos colocados
  // -------------------------------------------------------------------------
  for (const el of p.proyecto.elementos) {
    const simbolo = buscarSimbolo(el.simboloId)
    if (!simbolo) continue

    for (const ref of simbolo.materiales) {
      const info = NOMBRE_MATERIAL[ref.materialId]
      if (!info) continue

      sumar({
        id: `mat-${ref.materialId}`,
        descripcion: info.descripcion,
        categoria: info.categoria,
        cantidad: ref.cantidad,
        unidad: 'u',
      })
    }
  }

  // -------------------------------------------------------------------------
  // Tablero
  // -------------------------------------------------------------------------
  if (p.circuitos.length > 0) {
    for (const c of p.circuitos) {
      const inA = c.circuito.proteccionIn
      sumar({
        id: `termica-${inA}`,
        descripcion: `Interruptor termomagnético bipolar ${inA} A, curva C`,
        categoria: 'tablero',
        cantidad: 1,
        unidad: 'u',
        clausula: '770.15.2',
      })
    }

    // 770.14.2: el diferencial de alta sensibilidad es obligatorio como
    // protección complementaria contra contactos directos.
    sumar({
      id: 'diferencial',
      descripcion: 'Interruptor diferencial 2×40 A, 30 mA, tipo AC',
      categoria: 'tablero',
      cantidad: p.proyecto.suministro.fases === 'trifasica' ? 2 : 1,
      unidad: 'u',
      clausula: '770.14.2',
      detalle: 'Obligatorio: In ≤ 30 mA de actuación instantánea',
    })

    sumar({
      id: 'seccionador',
      descripcion: 'Interruptor seccionador de cabecera',
      categoria: 'tablero',
      cantidad: 1,
      unidad: 'u',
      clausula: '770.16.5',
    })

    // Dos módulos DIN por térmica bipolar, más el diferencial y el seccionador,
    // y un 25 % de reserva de espacio.
    const modulos = p.circuitos.length * 2 + 4
    const gabinete = Math.ceil((modulos * 1.25) / 2) * 2

    sumar({
      id: 'gabinete',
      descripcion: `Gabinete para tablero, ${gabinete} módulos DIN`,
      categoria: 'tablero',
      cantidad: 1,
      unidad: 'u',
      clausula: '770.16',
      detalle: `${modulos} módulos ocupados más reserva`,
    })
  }

  // -------------------------------------------------------------------------
  // Puesta a tierra
  // -------------------------------------------------------------------------
  const seccionMayor = p.circuitos.reduce((max, c) => Math.max(max, c.circuito.seccionMm2), 0)
  if (seccionMayor > 0) {
    const sPAT = seccionPAT(seccionMayor)
    sumar({
      id: `cable-pat-${sPAT}`,
      descripcion: `Cable de puesta a tierra ${mm2(sPAT)} ${COLOR_CONDUCTOR.proteccion}`,
      categoria: 'pat',
      cantidad: 10,
      unidad: 'm',
      clausula: '770.14.I',
      detalle: 'Estimado en 10 m; ajustar según el recorrido real hasta la jabalina',
    })
  }

  return [...items.values()]
    .map((i) => ({ ...i, cantidad: redondear(i.cantidad, i.unidad) }))
    .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.descripcion.localeCompare(b.descripcion))
}

function redondear(cantidad: number, unidad: ItemMaterial['unidad']): number {
  // Los metros de cable se redondean hacia arriba al metro: no se compra
  // fraccionado.
  if (unidad === 'm') return Math.ceil(cantidad)
  return cantidad
}

export const NOMBRE_CATEGORIA: Record<CategoriaMaterial, string> = {
  cable: 'Conductores',
  cano: 'Canalizaciones',
  caja: 'Cajas',
  modulo: 'Módulos y accesorios',
  tablero: 'Tablero',
  pat: 'Puesta a tierra',
}
