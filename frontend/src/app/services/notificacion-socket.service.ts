import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { INotificacion } from '../model/notificacion.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class NotificacionSocketService {
  private socket!: WebSocket;
  private notificacionSubject = new Subject<INotificacion>();

  constructor() {
    this.iniciarConexion();
  }

  public iniciarConexion(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return;
    }

    this.socket = new WebSocket(environment.wsUrl);

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data && data.notificacion) {
        this.notificacionSubject.next(data.notificacion);
      }
    };

    this.socket.onerror = (error) => {
      console.error('Error en WebSocket:', error);
    };

    this.socket.onclose = () => {
      console.log('WebSocket cerrado. Reconectando en 5 segundos...');
      setTimeout(() => this.iniciarConexion(), 5000);
    };
  }

  public escucharNotificaciones(): Observable<INotificacion> {
    return this.notificacionSubject.asObservable();
  }
}