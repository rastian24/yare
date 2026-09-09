/**
 * Hook que expone todo lo derivado del proyecto.
 *
 * Se recalcula cuando cambia el proyecto y nunca se persiste, así que las
 * tablas de materiales, el presupuesto y los hallazgos no pueden quedar
 * desfasados de lo que hay en el plano.
 */

import { useMemo } from 'react'
import { calcularProyecto, type ProyectoCalculado } from '@/dominio/calculo/proyecto'
import { validar, type ResultadoValidacion } from '@/normativa/aea770/motor'
import { computarMateriales, type ItemMaterial } from '@/dominio/computo/materiales'
import { calcularPresupuesto, type Presupuesto } from '@/dominio/computo/presupuesto'
import { useApp } from './store'

export interface Derivado {
  calculado: ProyectoCalculado
  validacion: ResultadoValidacion
  materiales: ItemMaterial[]
  presupuesto: Presupuesto
}

export function useCalculo(): Derivado {
  const proyecto = useApp((e) => e.proyecto)

  return useMemo(() => {
    const calculado = calcularProyecto(proyecto)
    return {
      calculado,
      validacion: validar(calculado),
      materiales: computarMateriales(calculado),
      presupuesto: calcularPresupuesto(calculado),
    }
  }, [proyecto])
}
