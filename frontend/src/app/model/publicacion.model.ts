export interface PublicacionForo {
  id: number;
  temaId: number;
  autor: string;
  avatarUrl?: string;
  inicialesAutor: string;
  fecha: Date;
  contenido: string;
  esRespuesta?: boolean;
}