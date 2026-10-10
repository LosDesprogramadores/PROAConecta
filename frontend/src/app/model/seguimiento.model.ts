/** Delivery status of one student in an activity (`GET /api/actividades/<id>/seguimiento/`). */
export type EstadoSeguimiento = 'PENDIENTE' | 'NO_ENTREGADO' | 'ENTREGADO' | 'FUERA_DE_TERMINO' | 'CORREGIDO';

export interface NotaSeguimiento {
  /** Decimal string, for example "8.50". */
  calificacion: string;
  descripcion: string;
}

export interface FilaSeguimiento {
  estudiante_id: number;
  apellido: string;
  nombre: string;
  dni: string;
  estado: EstadoSeguimiento;
  entrega_id: number | null;
  fecha_entrega: string | null;
  nota: NotaSeguimiento | null;
}

export interface Seguimiento {
  actividad: { id: number; titulo: string; fecha_limite: string | null };
  materia: { id: number; titulo: string };
  resumen: Partial<Record<EstadoSeguimiento, number>>;
  estudiantes: FilaSeguimiento[];
}

/** Spanish label and badge style of each status. */
export const ESTADOS_SEGUIMIENTO: readonly { estado: EstadoSeguimiento; etiqueta: string; clase: string }[] = [
  { estado: 'ENTREGADO', etiqueta: 'Entregado', clase: 'bg-blue-50 text-blue-700' },
  { estado: 'CORREGIDO', etiqueta: 'Corregido', clase: 'bg-green-50 text-green-700' },
  { estado: 'FUERA_DE_TERMINO', etiqueta: 'Fuera de término', clase: 'bg-amber-50 text-amber-700' },
  { estado: 'PENDIENTE', etiqueta: 'Pendiente', clase: 'bg-slate-100 text-slate-600' },
  { estado: 'NO_ENTREGADO', etiqueta: 'No entregado', clase: 'bg-red-50 text-red-700' },
];
