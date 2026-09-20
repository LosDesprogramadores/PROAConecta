export interface Unidad {
    id?: number | string;
    materia: number | string;
    titulo: string;
    descripcion?: string;
    orden?: number;
    visible?: boolean;
    fecha_baja?: string | null;
    contenidos?: Material[];
}

export interface Material {
    id?: number | string;
    materia: number | string;
    unidad?: number | string | null;
    tipo: string;
    titulo: string;
    descripcion?: string;
    archivo?: File | string | null;
    enlace?: string | null;
    visible?: boolean;
    fecha_publicacion?: string;
    fecha_baja?: string | null;
}