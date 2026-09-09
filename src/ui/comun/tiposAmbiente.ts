/** Etiquetas de los tipos de ambiente de la Tabla 770.7.III, para los selectores. */

import type { TipoAmbiente } from '@/dominio/tipos'

export const TIPOS_AMBIENTE: ReadonlyArray<{ valor: TipoAmbiente; etiqueta: string }> = [
  { valor: 'estar', etiqueta: 'Estar / comedor / escritorio' },
  { valor: 'dormitorio', etiqueta: 'Dormitorio' },
  { valor: 'cocina', etiqueta: 'Cocina' },
  { valor: 'bano', etiqueta: 'Baño' },
  { valor: 'toilette', etiqueta: 'Toilette' },
  { valor: 'lavadero', etiqueta: 'Lavadero' },
  { valor: 'vestibulo', etiqueta: 'Vestíbulo / garaje / hall' },
  { valor: 'pasillo', etiqueta: 'Pasillo cubierto' },
  { valor: 'semicubierto', etiqueta: 'Balcón / galería / semicubierto' },
]
