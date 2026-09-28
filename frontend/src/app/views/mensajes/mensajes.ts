import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-mensajes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mensajes.html',
})
export class MensajesComponent {
  conversaciones = signal([
    { id: 1, remitente: 'Ana López', ultimoMensaje: 'Hola profe, le consulto sobre la consigna...', tiempo: '10 min', noLeido: true, curso: 'Desarrollo Backend' },
    { id: 2, remitente: 'Carlos Ruiz', ultimoMensaje: '¿Hay clases de consulta esta semana?', tiempo: '1 hora', noLeido: false, curso: 'Base de Datos' },
    { id: 3, remitente: 'María Gómez', ultimoMensaje: 'Muchas gracias por la aclaración profe.', tiempo: 'Ayer', noLeido: false, curso: 'Ingeniería de Software' }
  ]);

  conversacionActiva = signal<any>(this.conversaciones()[0]);

  seleccionarConversacion(conv: any) {
    this.conversacionActiva.set(conv);
    conv.noLeido = false;
  }
}