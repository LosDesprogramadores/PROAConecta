/**
 * Modelo para Contenido de una Unidad
 * Representa un recurso (documento, video, enlace) que el profesor carga
 */
export interface ContenidoUnidad {
  id: string;
  titulo: string;
  descripcion?: string;
  tipo: 'documento' | 'video' | 'enlace';
  url: string; // URL externa (Drive, YouTube, etc)
  fechaCreacion: Date;
  profesor_id?: string;
}

/**
 * Modelo para una Unidad de una Materia
 * Agrupa un conjunto de contenidos relacionados
 */
export interface UnidadMateria {
  id: string;
  numero: number; // 1, 2, 3, 4...
  nombre: string; // "Números reales y operaciones"
  descripcion?: string;
  contenidos: ContenidoUnidad[];
}

/**
 * Modelo para la Portada de una Materia
 * Contiene presentación y todas las unidades
 */
export interface MateriaPortada {
  nombre: string;
  docente: string;
  presentacion: string;
  unidades: UnidadMateria[];
}