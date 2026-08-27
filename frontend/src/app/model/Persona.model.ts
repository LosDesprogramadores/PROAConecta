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

export interface IEstudiante {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  fecha_nacimiento: string;
  tel_contacto: string;
  rol: number;
}
