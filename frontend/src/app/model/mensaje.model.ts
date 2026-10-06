import { RespuestaPaginada } from '../core/models/api-response.interface';

export type Bandeja = 'recibidos' | 'enviados';

export interface PersonaMensaje {
  /** `Usuario.pk` (the same id the WebSocket groups use). */
  id: number;
  nombre_completo: string | null;
}

export interface MateriaMensaje {
  id: number;
  nombre: string | null;
}

/** Element of `GET /api/mensajes/` (see contracts/mensajeria.md). */
export interface Mensaje {
  id: string;
  materia: MateriaMensaje;
  remitente: PersonaMensaje;
  destinatario: PersonaMensaje;
  asunto: string;
  cuerpo: string;
  /** ISO 8601, UTC. */
  fecha_creacion: string;
  leido: boolean;
}

/** Paginated envelope; `no_leidos` counts every unread message of the user, not only this page. */
export interface RespuestaMensajes extends RespuestaPaginada<Mensaje> {
  no_leidos: number;
}

export interface ConsultaMensajes {
  bandeja: Bandeja;
  page: number;
  page_size?: number;
  materia?: number;
}

/** Element of `GET /api/materias/{id}/destinatarios/`. */
export interface Destinatario {
  id: number;
  nombre_completo: string;
  rol: 'ESTUDIANTE' | 'PROFESOR';
}

/** Body of `POST /api/mensajes/` (asunto 1-120, cuerpo 1-2000). */
export interface NuevoMensaje {
  materia_id: number;
  destinatario_id: number;
  asunto: string;
  cuerpo: string;
}

/** Payload of the `mensaje.leido` event, sent to the sender. */
export interface MensajeLeido {
  id: string;
  leido: true;
}

export const MAX_ASUNTO = 120;
export const MAX_CUERPO = 2000;
/** The sender can delete a message only during this window after sending it. */
export const VENTANA_BORRADO_MS = 15 * 60 * 1000;
