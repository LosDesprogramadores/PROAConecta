import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { NotificacionService } from '../../../services/notificaciones.service';
import { EstadoVigencia, INotificacion, NotificacionEntrada } from '../../../model/notificacion.model';
import { CommonModule } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

const ETIQUETAS_ALCANCE: Record<string, string> = {
  AMBOS: 'Todos',
  PROFESOR: 'Profesores',
  ESTUDIANTE: 'Estudiantes',
};

/** Local date as AAAA-MM-DD (the value of an `<input type="date">`). */
function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** AAAA-MM-DD -> dd/mm/aaaa without going through Date (no timezone shifts). */
function formatearDia(iso: string): string {
  const [anio, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

@Component({
  selector: 'app-notificacion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './notificacion.html',
  styleUrl: './notificacion.css',
})
export class Notificacion implements OnInit {
  private notificacionService = inject(NotificacionService);

  notificaciones: INotificacion[] = [];
  cargando = true;

  mensajeExito = '';
  mensajeError = '';

  mostrarFormulario = false;

  notificacionAEliminar: string | null = null;
  editandoId: string | null = null;

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private timerMensaje: ReturnType<typeof setTimeout> | null = null;

  readonly formulario = this.fb.group({
    titulo: ['', Validators.required],
    mensaje: ['', Validators.required],
    tipo_notificacion_codigo: ['GENERAL', Validators.required],
    alcance: ['AMBOS', Validators.required],
    fecha_desde: [hoyISO(), Validators.required],
    fecha_hasta: [''],
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.timerMensaje) clearTimeout(this.timerMensaje);
    });
  }

  ngOnInit(): void {
    this.cargarNotificaciones();
  }

  cargarNotificaciones(): void {
    this.cargando = true;
    this.notificacionService.listarPropias().subscribe({
      next: (data) => {
        this.notificaciones = data;
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error al cargar notificaciones:', err);
        this.cargando = false;
        this.mostrarError('No se pudieron cargar las notificaciones.');
      }
    });
  }

guardarNotificacion(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.mostrarError('Todos los campos son obligatorios.');
      return;
    }

    const valores = this.formulario.getRawValue();
    const notificacionData: NotificacionEntrada = {
      ...valores,
      fecha_desde: valores.fecha_desde,
      fecha_hasta: valores.fecha_hasta.trim() !== '' ? valores.fecha_hasta : null,
    };

    if (this.editandoId) {
      this.notificacionService.actualizarNotificacion(this.editandoId, notificacionData).subscribe({
        next: () => {
          this.mostrarExito('Notificación actualizada con éxito.');
          this.cancelarEdicion();
          this.cargarNotificaciones();
        },
        error: (err) => {
          console.error('Error al actualizar:', err);
          this.mostrarError('Ocurrió un error al actualizar la notificación.');
        }
      });
    } else {
      this.notificacionService.crearNotificacion(notificacionData).subscribe({
        next: () => {
          this.mostrarExito('Notificación global creada con éxito.');
          this.limpiarFormulario();
          this.mostrarFormulario = false;
          this.cargarNotificaciones();
        },
        error: (err) => {
          console.error('Error al crear:', err);
          this.mostrarError('Ocurrió un error al crear la notificación.');
        }
      });
    }
  }

  
  cargarParaEditar(noti: INotificacion): void {
    this.editandoId = noti.id || noti._id || null;
    this.formulario.setValue({
      titulo: noti.titulo,
      mensaje: noti.mensaje,
      tipo_notificacion_codigo: noti.tipo_notificacion_codigo || 'GENERAL',
      alcance: noti.alcance || 'AMBOS',
      fecha_desde: noti.fecha_desde ? noti.fecha_desde.slice(0, 10) : hoyISO(),
      fecha_hasta: noti.fecha_hasta ? noti.fecha_hasta.slice(0, 10) : '',
    });
    this.mostrarFormulario = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarEdicion(): void {
    this.editandoId = null;
    this.limpiarFormulario();
    this.mostrarFormulario = false;
  }

  confirmarEliminar(id: string): void {
    this.notificacionAEliminar = id;
  }

  cancelarEliminar(): void {
    this.notificacionAEliminar = null;
  }

  ejecutarEliminar(): void {
    if (!this.notificacionAEliminar) return;

    const id = this.notificacionAEliminar;
    this.notificacionService.eliminarNotificacion(id).subscribe({
      next: () => {
        this.notificaciones = this.notificaciones.filter(n => (n.id || n._id) !== id);
        this.notificacionAEliminar = null;
        this.mostrarExito('Notificación eliminada correctamente.');
      },
      error: (err) => {
        console.error('Error al eliminar:', err);
        this.notificacionAEliminar = null;
        this.mostrarError('No se pudo eliminar la notificación.');
      }
    });
  }

  private limpiarFormulario(): void {
    this.formulario.reset({ fecha_desde: hoyISO() });
  }

  /** `dd/mm/aaaa` when the form is set to start in the future, `null` otherwise. */
  programadaPara(): string | null {
    const desde = this.formulario.controls.fecha_desde.value;
    return desde && desde > hoyISO() ? formatearDia(desde) : null;
  }

  /** Date label of a listed notice: "Programada para …" while it has not started. */
  programadaDe(noti: INotificacion): string | null {
    return noti.estado_vigencia === 'PROGRAMADA' && noti.fecha_desde ? formatearDia(noti.fecha_desde) : null;
  }

  dia(valor: string): string {
    return formatearDia(valor);
  }

  etiquetaAlcance(alcance: string): string {
    return ETIQUETAS_ALCANCE[alcance] ?? alcance;
  }

  etiquetaVigencia(estado?: EstadoVigencia): string {
    return estado === 'PROGRAMADA' ? 'Programada' : estado === 'VENCIDA' ? 'Vencida' : 'Vigente';
  }

  claseVigencia(estado?: EstadoVigencia): string {
    switch (estado) {
      case 'PROGRAMADA':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'VENCIDA':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  }

  private mostrarExito(msg: string): void {
    this.mensajeExito = msg;
    this.mensajeError = '';
    this.programarLimpiezaMensajes();
  }

  private mostrarError(msg: string): void {
    this.mensajeError = msg;
    this.mensajeExito = '';
    this.programarLimpiezaMensajes();
  }

  /** Clears both banners after 4s; the pending timer is dropped when the view is destroyed. */
  private programarLimpiezaMensajes(): void {
    if (this.timerMensaje) clearTimeout(this.timerMensaje);
    this.timerMensaje = setTimeout(() => {
      this.mensajeExito = '';
      this.mensajeError = '';
    }, 4000);
  }
}
