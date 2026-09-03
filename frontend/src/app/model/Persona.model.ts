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
  rol: number;
}

export enum RolId {
  ADMINISTRADOR = 1,
  PROFESOR = 2,
  ESTUDIANTE = 3
}