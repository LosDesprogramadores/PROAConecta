export interface Anuncio {
    id: string;
    titulo: string;
    mensaje: string;
    alcance?: string;
    tipo_notificacion_codigo?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
    leida?: boolean;
}