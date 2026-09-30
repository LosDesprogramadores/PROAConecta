export interface Anuncio {
    id: string;
    titulo: string;
    mensaje: string;
    dirigido_a?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
    leida?: boolean;
}