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
    rolNombre?: string;
    persona:Persona;
    debe_cambiar_password: boolean;
}

export interface AuthResponse {
    access: string;
    refresh: string;
    debe_cambiar_password: boolean;
    user?: User; // Opcional
}