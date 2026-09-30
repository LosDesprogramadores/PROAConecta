export interface INotificacion {
  id?: string;
  _id?: string;
  titulo: string;
  mensaje: string;
  tipo_notificacion_codigo?: string;
  alcance: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  leida: boolean; // Estado de lectura para el usuario actual
}