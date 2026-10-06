import { RespuestaPaginada } from '../core/models/api-response.interface';

/** Announcement of a subject, as returned by `GET /api/materias/{id}/anuncios/`. */
export interface AnuncioMateria {
  id: string;
  titulo: string;
  mensaje: string;
  autor: string | null;
  materia_id: number;
  materia_nombre: string | null;
  /** ISO 8601, UTC. */
  fecha_creacion: string;
  leida: boolean;
}

/** Body of `POST /api/materias/{id}/anuncios/` (titulo max 120, mensaje max 2000). */
export interface NuevoAnuncio {
  titulo: string;
  mensaje: string;
}

export type RespuestaAnuncios = RespuestaPaginada<AnuncioMateria> & { no_leidas: number };
