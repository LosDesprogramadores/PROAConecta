import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-notificaciones',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notificaciones.html',
})
export class NotificacionesComponent {
  notificaciones = signal([
    { id: 1, tipo: 'entrega', titulo: 'Nueva entrega', descripcion: 'Juan Pérez subió la actividad de Backend.', tiempo: 'Hace 5 min', leida: false },
    { id: 2, tipo: 'recordatorio', titulo: 'Cierre de calificaciones', descripcion: 'El periodo de carga finaliza en 3 días.', tiempo: 'Hace 2 horas', leida: false },
    { id: 3, tipo: 'sistema', titulo: 'Mantenimiento programado', descripcion: 'El servidor se actualizará el sábado a la madrugada.', tiempo: 'Ayer', leida: true }
  ]);

  marcarTodasComoLeidas() {
    this.notificaciones.update(lista => lista.map(n => ({ ...n, leida: true })));
  }

  eliminarNotificacion(id: number) {
    this.notificaciones.update(lista => lista.filter(n => n.id !== id));
  }
}