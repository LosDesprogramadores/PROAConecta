export interface ContenidoUnidad {
  id: string;
  titulo: string;
  descripcion?: string;
  tipo: 'documento' | 'video' | 'enlace';
  url: string;
  fechaCreacion: Date;
  profesor_id?: string;
  visible?: boolean;
}

export interface UnidadMateria {
  id: string;
  numero: number;
  nombre: string;
  descripcion?: string;
  contenidos: ContenidoUnidad[];
}

export interface RecursoClase {
  id: string;
  titulo: string;
  tipo: 'documento' | 'video' | 'enlace';
  url: string;
  fechaCreacion: Date;
}

export interface MateriaPortada {
  nombre: string;
  docente: string;
  presentacion: string;
  anio: number;
  curso: string;
  unidades: UnidadMateria[];
  recursosClase?: RecursoClase[];
}
