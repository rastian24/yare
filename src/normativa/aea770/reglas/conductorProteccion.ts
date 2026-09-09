/** 770.14.4.5 y Tabla 770.14.I — Conductor de protección y puesta a tierra. */

import { buscarSimbolo } from '@/simbologia/catalogo'
import type { Hallazgo } from '@/dominio/tipos'
import type { ProyectoCalculado } from '@/dominio/calculo/proyecto'

export function conductorProteccion(p: ProyectoCalculado): Hallazgo[] {
  const hallazgos: Hallazgo[] = []

  // El PE recorre la instalación entera, así que su sección por circuito es
  // informativa y no un error: se informa para que quede en la planilla.
  for (const c of p.circuitos) {
    hallazgos.push({
      id: `pe-${c.circuito.id}`,
      severidad: 'info',
      clausula: '770.14.4.5',
      mensaje:
        `${c.circuito.nombre}: conductor de protección de ${c.seccionPEMm2} mm² ` +
        `para una fase de ${c.circuito.seccionMm2} mm².`,
      alcance: { tipo: 'circuito', id: c.circuito.id },
    })
  }

  // La puesta a tierra es obligatoria: el esquema de conexión exigido por
  // 770.3.2 requiere el electrodo dispersor.
  const tieneJabalina = p.proyecto.elementos.some(
    (e) => buscarSimbolo(e.simboloId)?.categoria === 'puesta_tierra',
  )

  if (!tieneJabalina && p.proyecto.elementos.length > 0) {
    hallazgos.push({
      id: 'pat-faltante',
      severidad: 'error',
      clausula: '770.14.4',
      mensaje: 'El proyecto no tiene toma de tierra (jabalina) definida.',
      sugerencia: 'Colocar la jabalina y su caja de inspección en el plano.',
      alcance: { tipo: 'proyecto' },
    })
  }

  return hallazgos
}
