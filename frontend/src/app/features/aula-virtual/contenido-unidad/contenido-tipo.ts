import { ContenidoUnidad } from '../../../model/unidad-contenido.model';

export type TipoContenido = ContenidoUnidad['tipo'];

const ETIQUETAS: Record<string, string> = {
  documento: '📄 Documento',
  video: '🎥 Video',
  enlace: '🔗 Enlace',
};

const ETIQUETAS_CORTAS: Record<string, string> = {
  documento: 'Documento',
  video: 'Video',
  enlace: 'Enlace',
};

const ICONOS: Record<string, string> = {
  documento: '📄',
  video: '🎥',
  enlace: '🔗',
};

const AYUDA_TITULO: Record<string, string> = {
  documento: '📄 Para documentos en Google Drive:',
  video: '🎥 Para videos en YouTube/Vimeo:',
  enlace: '🔗 Para enlaces generales:',
};

const AYUDA_PASOS: Record<string, string[]> = {
  documento: [
    'Abre el archivo en Google Drive',
    'Click en "Compartir" → Copiar el link compartible',
    'Pega el link aquí (debe ser accesible)',
  ],
  video: [
    'Copia la URL de YouTube o Vimeo',
    'Puede ser la URL corta o larga',
    'Se visualizará directamente en la plataforma',
  ],
  enlace: [
    'Pega cualquier URL válida (http:// o https://)',
    'Se abrirá en una nueva ventana',
    'Ideal para recursos externos',
  ],
};

export const tipoLabel = (tipo: string): string => ETIQUETAS[tipo] || tipo;
export const tipoLabelCorto = (tipo: string): string => ETIQUETAS_CORTAS[tipo] || tipo;
export const iconoTipo = (tipo: string): string => ICONOS[tipo] || '📎';
export const tituloAyuda = (tipo: string): string => AYUDA_TITULO[tipo] || '';
export const pasosAyuda = (tipo: string): string[] => AYUDA_PASOS[tipo] || [];

/** Short date shown next to each content. */
export function fechaFormato(fecha: Date | string): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}
