import { IPersonaResumen } from "./Persona.model";

export interface Materia {
  nombre: string;
  color: string;
  path: string;
}

export interface IMateria {
  id?: number;
  titulo: string;
  descripcion?: string | null;
  criterios_evaluacion?: string | null;
  anio: number;
  curso: string;
  activo?: boolean;
  profesor?: number | null;
  profesor_detalle?: IPersonaResumen | null;
  total_estudiantes?: number;
  discord_webhook_url?: string | null;
}

export interface IMateriaAsignacion {
  profesor_id: number;
  materia_ids: number[];
}
export type EstadoInscripcion = 'CURSANDO' | 'REGULAR' | 'PROMOCIONADO' | 'LIBRE' | 'BAJA';

export interface IInscripcion {
  id: number;
  materia: number;
  materia_titulo: string;
  materia_curso: string;
  materia_anio: number;
  profesor_nombre?: string;
  estudiante: number;
  estudiante_detalle?: IPersonaResumen;
  estado: EstadoInscripcion;
  fecha_inscripcion: string;
}

/** Element of GET /api/materias/{id}/alumnos/ (no sensitive personal data). */
export interface IAlumnoMateria {
  inscripcion_id: number;
  persona_id: number;
  apellido: string;
  nombre: string;
  email: string;
  estado: EstadoInscripcion;
  fecha_inscripcion: string;
}

/** Body of POST /api/materias/asignar-profesor/ (AsignarProfesorSerializer answer). */
export interface RespuestaAsignacionProfesor {
  mensaje: string;
  profesor_id: number;
  materia_ids: number[];
}

/** Body of POST /api/inscripciones/inscribir/ (InscripcionViewSet.inscribir_lote). */
export interface RespuestaInscripcionLote {
  mensaje: string;
  estudiante_id: number;
  cantidad: number;
}

/** Body of POST /api/inscripciones/inscribir-estudiantes/ (InscripcionViewSet.inscribir_estudiantes). */
export interface RespuestaInscripcionEstudiantes {
  mensaje: string;
  materia_id: number;
  cantidad: number;
  /** Ids of the students the server skipped (already enrolled). */
  omitidos: number[];
}
