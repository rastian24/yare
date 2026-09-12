/**
 * Exportar e importar el proyecto como archivo, del lado del navegador.
 *
 * Acá va todo lo que toca Blobs e IndexedDB; la lectura del contenido vive en
 * `intercambio.ts`, que es pura y se testea aparte.
 */

import type { Proyecto } from '@/dominio/tipos'
import { cargarBlob, guardarBlob, guardarProyecto } from './db'
import {
  ErrorImportacion,
  parsearArchivoProyecto,
  serializarProyecto,
  type AdjuntoExportado,
} from './intercambio'

/** Arma el archivo de exportación, con la foto o el DXF del plano adentro. */
export async function archivoDeProyecto(proyecto: Proyecto): Promise<Blob> {
  const adjuntos: AdjuntoExportado[] = []

  for (const plano of proyecto.planos) {
    const datos = await cargarBlob(plano.fuente.blobId)
    // Un plano cuyo adjunto ya no está en esta máquina no frena la
    // exportación: el proyecto se lleva igual, sin el fondo.
    if (!datos) continue
    adjuntos.push({
      id: plano.fuente.blobId,
      nombre: plano.nombre,
      tipo: datos.type,
      datos: await aBase64(datos),
    })
  }

  return new Blob([serializarProyecto(proyecto, adjuntos)], { type: 'application/json' })
}

/** Nombre de archivo sugerido, derivado del nombre del proyecto. */
export function nombreDeArchivo(proyecto: Proyecto): string {
  const limpio = proyecto.nombre.replace(/[^\w\s-]/g, '').trim()
  return `${limpio || 'proyecto'}.json`
}

/**
 * Lee un archivo exportado, lo guarda como proyecto local —con sus adjuntos— y
 * lo devuelve para que la app lo abra.
 *
 * @throws {ErrorImportacion} si el archivo no se puede leer.
 */
export async function importarDesdeArchivo(archivo: File): Promise<Proyecto> {
  const { proyecto, adjuntos } = parsearArchivoProyecto(await archivo.text())

  for (const adjunto of adjuntos) {
    await guardarBlob({
      id: adjunto.id,
      // Los adjuntos se reasignan al proyecto importado: si no, borrar ese
      // proyecto no los limpiaría nunca.
      proyectoId: proyecto.id,
      nombre: adjunto.nombre,
      tipo: adjunto.tipo,
      datos: desdeBase64(adjunto.datos, adjunto.tipo),
    })
  }

  await guardarProyecto(proyecto)
  return proyecto
}

// ---------------------------------------------------------------------------

/**
 * Blob a base64. Se recorre por trozos porque `String.fromCharCode` con un
 * plano de varios MB de una sola vez desborda la pila de argumentos.
 */
async function aBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const TROZO = 0x8000
  let binario = ''
  for (let i = 0; i < bytes.length; i += TROZO) {
    binario += String.fromCharCode(...bytes.subarray(i, i + TROZO))
  }
  return btoa(binario)
}

function desdeBase64(base64: string, tipo: string): Blob {
  let binario: string
  try {
    binario = atob(base64)
  } catch {
    throw new ErrorImportacion('El archivo tiene un plano adjunto ilegible.')
  }
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return new Blob([bytes], { type: tipo })
}
