import { Persona } from "../../model/Persona.model";

export enum UserRole {

    ADMIN = 1,
    DOCENTE = 2,
    ESTUDIANTE = 3
}

export const RoleLabel : Record<UserRole, string > = {
  
  [UserRole.ADMIN]: 'Administrador',
  [UserRole.DOCENTE]: 'Profesor',
  [UserRole.ESTUDIANTE]: 'Estudiante'

}

export interface User {
    id: number;
    userName : string;
    rolId: UserRole;
    persona:Persona;
}

export interface AuthResponse {
    access: string;
    refresh: string;
    user?: User; // Opcional
}