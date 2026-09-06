/**
 * Modelo para Contenido de una Unidad
 * Representa un recurso (documento, video, enlace) que el profesor carga
 */
export interface ContenidoUnidad {
  id: string;
  titulo: string;
  descripcion?: string;
  tipo: 'documento' | 'video' | 'enlace';
  url: string;
  fechaCreacion: Date;
  profesor_id?: string;
}

/**
 * Modelo para una Unidad de una Materia
 * Agrupa un conjunto de contenidos relacionados
 */
export interface UnidadMateria {
  id: string;
  numero: number;
  nombre: string;
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