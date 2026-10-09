export interface Actividad {
    id: number;
    materia: number;
    materia_titulo: string;
    unidad: number | null;
    unidad_titulo: string | null;
    titulo: string;
    descripcion: string | null;
    enlace: string | null;
    archivo_adjunto: string | null;
    fecha_limite: string;
    permitir_entrega_tardia: boolean;
    estado: 'BORRADOR' | 'PUBLICADA';
    estado_display: string;
    cantidad_entregas: number;
    fecha_creacion: string;
    fecha_baja: string | null;
}

/** Writable fields of ActividadSerializer (POST/PUT `/api/actividades/`). */
export interface ActividadPayload {
  materia: number;
  unidad?: number | null;
  titulo: string;
  descripcion?: string | null;
  enlace?: string | null;
  fecha_limite: string;
  permitir_entrega_tardia?: boolean;
  estado?: Actividad['estado'];
}
