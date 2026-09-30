import { Component, OnInit } from '@angular/core';
import { NotificacionService } from '../../../services/notificaciones.service';
import { INotificacion } from '../../../model/notificacion.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-notificacion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notificacion.html',
  styleUrl: './notificacion.css',
})
export class Notificacion implements OnInit {
  notificaciones: INotificacion[] = [];
  cargando: boolean = true;

  mensajeExito: string = '';
  mensajeError: string = '';

  mostrarFormulario: boolean = false;

  notificacionAEliminar: string | null = null;
  editandoId: string | null = null;

  // Inicializamos tipado correctamente cumpliendo con el modelo existente
  nuevaNoti: Partial<INotificacion> = {
    titulo: '',
    mensaje: '',
    tipo_notificacion_codigo: 'GENERAL',
    alcance: 'AMBOS',
    fecha_desde: '',
    fecha_hasta: '',
    leida: false
  };

  constructor(private notificacionService: NotificacionService) { }

  ngOnInit(): void {
    this.cargarNotificaciones();
  }

  cargarNotificaciones(): void {
    this.cargando = true;
    this.notificacionService.obtenerNotificaciones().subscribe({
      next: (data) => {
        this.notificaciones = data;
        this.cargando = false;
        console.log('Notificaciones cargadas desde el backend:', data);
      },
      error: (err) => {
        console.error('Error al cargar notificaciones:', err);
        this.cargando = false;
        this.mostrarError('No se pudieron cargar las notificaciones.');
      }
    });
  }

guardarNotificacion(): void {
    if (!this.nuevaNoti.titulo || !this.nuevaNoti.mensaje || !this.nuevaNoti.alcance || !this.nuevaNoti.tipo_notificacion_codigo || !this.nuevaNoti.fecha_desde || !this.nuevaNoti.fecha_hasta) {
      this.mostrarError('Todos los campos son obligatorios.');
      return;
    }

    const notificacionData = {
      titulo: this.nuevaNoti.titulo!,
      mensaje: this.nuevaNoti.mensaje!,
      tipo_notificacion_codigo: this.nuevaNoti.tipo_notificacion_codigo || 'GENERAL',
      alcance: this.nuevaNoti.alcance || 'AMBOS',
      fecha_desde: this.nuevaNoti.fecha_desde && this.nuevaNoti.fecha_desde.trim() !== '' ? this.nuevaNoti.fecha_desde : null,
      fecha_hasta: this.nuevaNoti.fecha_hasta && this.nuevaNoti.fecha_hasta.trim() !== '' ? this.nuevaNoti.fecha_hasta : null,
      leida: false
    };

    console.log('DATOS QUE SE ENVIÁN AL BACKEND:', notificacionData);

    if (this.editandoId) {
      this.notificacionService.actualizarNotificacion(this.editandoId, notificacionData as any).subscribe({
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
      this.notificacionService.crearNotificacion(notificacionData as any).subscribe({
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
    this.nuevaNoti = {
      titulo: noti.titulo,
      mensaje: noti.mensaje,
      tipo_notificacion_codigo: noti.tipo_notificacion_codigo || 'GENERAL',
      alcance: noti.alcance || 'AMBOS',
      fecha_desde: noti.fecha_desde ? noti.fecha_desde.slice(0, 16) : '',
      fecha_hasta: noti.fecha_hasta ? noti.fecha_hasta.slice(0, 16) : '',
      leida: noti.leida ?? false
    };
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
    this.nuevaNoti = {
      titulo: '',
      mensaje: '',
      tipo_notificacion_codigo: 'GENERAL',
      alcance: 'AMBOS',
      fecha_desde: '',
      fecha_hasta: '',
      leida: false
    };
  }

  private mostrarExito(msg: string): void {
    this.mensajeExito = msg;
    this.mensajeError = '';
    setTimeout(() => { this.mensajeExito = ''; }, 4000);
  }

  private mostrarError(msg: string): void {
    this.mensajeError = msg;
    this.mensajeExito = '';
    setTimeout(() => { this.mensajeError = ''; }, 4000);
  }

  actualizarFechaDesde(event: any): void {
    this.nuevaNoti.fecha_desde = event.target.value;
  }

  actualizarFechaHasta(event: any): void {
    this.nuevaNoti.fecha_hasta = event.target.value;
  }
}