export interface Persona {
  id: number;
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  fecha_nacimiento: string;
  tel_contacto: string;
  rolId?: number;
}

export interface IPersona {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  fecha_nacimiento: string;
  tel_contacto: string;
  rol?: number;
}

export enum RolId {
  ADMINISTRADOR = 1,
  PROFESOR = 2,
  ESTUDIANTE = 3
}

export interface IPersonaResumen {
  id: number;
  dni: string;
  nombre: string;
  apellido: string;
  nombre_completo: string;
  email: string;
  rol_nombre: string;
}