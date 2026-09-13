export interface ContenidoUnidad {
  id: string;
  titulo: string;
  descripcion?: string;
  tipo: 'documento' | 'video' | 'enlace';
  url: string;
  fechaCreacion: Date;
  profesor_id?: string;
  visible?: boolean; // Agregamos como opcional
}

export interface UnidadMateria {
  id: string;
  numero: number;
  nombre: string;
  descripcion?: string;
  contenidos: ContenidoUnidad[];
}

export interface MateriaPortada {
  nombre: string;
  docente: string;
  presentacion: string;
  unidades: UnidadMateria[];
}