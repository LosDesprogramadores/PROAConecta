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
}

export interface AuthResponse {
    token : string;
    user: User;

}