import { RespuestaPaginada } from '../core/models/api-response.interface';

export interface INotificacion {
  id?: string;
  _id?: string;
  titulo: string;
  mensaje: string;
  tipo_notificacion_codigo?: string;
  alcance: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  /** Creation date set by the server (ISO 8601, UTC). */
  fecha_creacion?: string;
  leida: boolean;
  materia_id?: string | number | null;
  materia_nombre?: string | null;
  autor?: string | null;
}

/** Paginated envelope of `GET /api/notificaciones/?page=` (adds the unread counter). */
export interface RespuestaNotificaciones extends RespuestaPaginada<INotificacion> {
  no_leidas: number;
}

/** Body accepted by POST/PUT `/api/notificaciones/` (NotificacionEntradaSerializer). */
export interface NotificacionEntrada {
  titulo: string;
  mensaje: string;
  tipo_notificacion_codigo?: string;
  alcance?: string;
  materia_id?: number | null;
  usuario_destino_id?: number | null;
  fecha_desde?: string | null;
  fecha_hasta?: string | null;
}

/** Answer of POST `/api/notificaciones/`. */
export interface RespuestaNotificacionCreada {
  id: string;
  mensaje: string;
}
