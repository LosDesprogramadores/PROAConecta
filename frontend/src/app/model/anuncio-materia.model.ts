export interface AnuncioMateria {
  id: number;
  titulo: string;
  autor: string;
  avatarUrl?: string;
  fechaCreacion: Date;
  ultimaRespuesta?: {
    autor: string;
    fecha: Date;
    avatarUrl?: string;
  };
  cantidadReplicas: number;
  importante?: boolean;
  bloqueado?: boolean;
}