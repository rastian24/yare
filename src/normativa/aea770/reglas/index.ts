/**
 * Reglas de validación de AEA 90364-7-770.
 *
 * Cada regla es una función pura que recibe el proyecto calculado y devuelve
 * los hallazgos que encuentra. Todo hallazgo cita la cláusula que lo funda:
 * un mensaje sin cláusula no es una validación normativa, es una opinión.
 */

import type { Hallazgo } from '@/dominio/tipos'
import type { ProyectoCalculado } from '@/dominio/calculo/proyecto'

export type Regla = (p: ProyectoCalculado) => Hallazgo[]

export { minimoCircuitos } from './minimoCircuitos'
export { puntosMinimos } from './puntosMinimos'
export { bocasPorCircuito } from './bocasPorCircuito'
export { seccionMinima } from './seccionMinima'
export { corrienteAdmisible } from './corrienteAdmisible'
export { caidaTension } from './caidaTension'
export { diametroCaneria } from './diametroCaneria'
export { conductorProteccion } from './conductorProteccion'
export { equilibrioFases } from './equilibrioFases'
export { suministroTrifasico } from './suministroTrifasico'
export { curvasPorTramo } from './curvasPorTramo'
export { calibracionPlano } from './calibracionPlano'
