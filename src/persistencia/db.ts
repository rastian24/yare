/**
 * Persistencia local en IndexedDB.
 *
 * Los proyectos y las imágenes de plano viven en el navegador del usuario: no
 * hay backend. Se guardan por separado porque un DXF o una foto de plano pesa
 * mucho más que el proyecto, y no hace falta traerlos al listar.
 */

import Dexie, { type Table } from 'dexie'
import type { Proyecto } from '@/dominio/tipos'

export interface ProyectoGuardado {
  id: string
  nombre: string
  actualizadoEn: string
  datos: Proyecto
}

export interface BlobGuardado {
  id: string
  proyectoId: string
  nombre: string
  tipo: string
  datos: Blob
}

class BaseDatos extends Dexie {
  proyectos!: Table<ProyectoGuardado, string>
  blobs!: Table<BlobGuardado, string>

  constructor() {
    super('circuitos-aea')
    this.version(1).stores({
      proyectos: 'id, nombre, actualizadoEn',
      blobs: 'id, proyectoId',
    })
  }
}

export const db = new BaseDatos()

export async function guardarProyecto(proyecto: Proyecto): Promise<void> {
  await db.proyectos.put({
    id: proyecto.id,
    nombre: proyecto.nombre,
    actualizadoEn: proyecto.actualizadoEn,
    datos: proyecto,
  })
}

export async function cargarProyecto(id: string): Promise<Proyecto | null> {
  const fila = await db.proyectos.get(id)
  return fila?.datos ?? null
}

export async function listarProyectos(): Promise<Array<Omit<ProyectoGuardado, 'datos'>>> {
  const filas = await db.proyectos.orderBy('actualizadoEn').reverse().toArray()
  return filas.map(({ id, nombre, actualizadoEn }) => ({ id, nombre, actualizadoEn }))
}

export async function borrarProyecto(id: string): Promise<void> {
  await db.transaction('rw', db.proyectos, db.blobs, async () => {
    await db.proyectos.delete(id)
    await db.blobs.where('proyectoId').equals(id).delete()
  })
}

export async function guardarBlob(blob: BlobGuardado): Promise<void> {
  await db.blobs.put(blob)
}

export async function borrarBlob(id: string): Promise<void> {
  await db.blobs.delete(id)
}

export async function cargarBlob(id: string): Promise<Blob | null> {
  const fila = await db.blobs.get(id)
  return fila?.datos ?? null
}

/**
 * URL temporal para mostrar un blob guardado. Quien la use debe revocarla con
 * `URL.revokeObjectURL` al desmontar, o se filtra memoria.
 */
export async function urlDeBlob(id: string): Promise<string | null> {
  const blob = await cargarBlob(id)
  return blob ? URL.createObjectURL(blob) : null
}
