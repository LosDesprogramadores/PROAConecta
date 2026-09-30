import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { INotificacion } from '../model/notificacion.model';


@Injectable({
  providedIn: 'root'
})
export class NotificacionService {
  private readonly apiUrl = `${environment.apiUrl}notificaciones/`;

  constructor(private http: HttpClient) {}

  obtenerNotificaciones(): Observable<INotificacion[]> {
    return this.http.get<INotificacion[]>(this.apiUrl);
  }

  crearNotificacion(data: { titulo: string; mensaje: string; tipo_notificacion_codigo: string; alcance: string }): Observable<any> {
    return this.http.post(this.apiUrl, data);
  }

  actualizarNotificacion(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}${id}/`, data);
  }

  eliminarNotificacion(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}${id}/`);
  }
}