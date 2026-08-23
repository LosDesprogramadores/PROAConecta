export interface Respuesta {
  id: number;
  autor: string;
  avatarUrl?: string;
  contenido: string;
  fecha: Date;
}

export interface TemaForo {
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
  bloqueado?: boolean;
  importante?: boolean;
  respuestas?: Respuesta[];
}