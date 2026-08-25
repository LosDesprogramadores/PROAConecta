export interface Usuario {
    dni: string;
    nombre: string;
    apellido: string;
    rol: 'alumno' | 'docente';
}