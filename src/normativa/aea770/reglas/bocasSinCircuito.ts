/**
 * 770.6.5 — Toda boca pertenece a un circuito terminal.
 *
 * La cláusula define el circuito terminal como el que vincula los bornes de
 * salida de un dispositivo de maniobra y protección con los puntos de
 * utilización. Una boca sin circuito asignado no está alimentada por ninguno,
 * así que el proyecto está incompleto: no tiene protección asociada, no computa
 * en ninguna DPMS y no arrastra cable al cómputo de materiales.
 */

import { buscarSimbolo } from '@/simbologia/catalogo'
import type { Hallazgo } from '@/dominio/tipos'
import type { ProyectoCalculado } from '@/dominio/calculo/proyecto'

export function bocasSinCircuito(p: ProyectoCalculado): Hallazgo[] {
  const huerfanas = p.proyecto.elementos.filter((el) => {
    if (el.circuitoId) return false

    const simbolo = buscarSimbolo(el.simboloId)
    if (!simbolo) return false

    // Tableros y puesta a tierra no pertenecen a un circuito terminal.
    return simbolo.circuitosPermitidos.length > 0
  })

  if (huerfanas.length === 0) return []

  // Un hallazgo por boca sería ruido; se informa el conjunto y se apunta a la
  // primera, que es lo que permite navegar hasta el problema.
  const primera = huerfanas[0]!

  return [
    {
      id: 'bocas-sin-circuito',
      severidad: 'error',
      clausula: '770.6.5',
      mensaje:
        huerfanas.length === 1
          ? 'Hay 1 boca sin circuito asignado.'
          : `Hay ${huerfanas.length} bocas sin circuito asignado.`,
      sugerencia:
        'Seleccionalas en el plano, elegí un circuito en el panel y usá "Asignar bocas". ' +
        'Sin circuito no tienen protección ni computan cable.',
      alcance: { tipo: 'boca', id: primera.id },
    },
  ]
}
