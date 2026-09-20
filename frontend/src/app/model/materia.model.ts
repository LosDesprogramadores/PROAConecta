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