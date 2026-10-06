import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { INotificacion, RespuestaNotificaciones } from '../model/notificacion.model';
import { ConsultaPaginada } from '../core/models/api-response.interface';


@Injectable({
  providedIn: 'root'
})
export class NotificacionService {
  private readonly apiUrl = `${environment.apiUrl}notificaciones/`;

  constructor(private http: HttpClient) {}

  obtenerNotificaciones(): Observable<INotificacion[]> {
    return this.http.get<INotificacion[]>(this.apiUrl);
  }

  /** Paginated variant: the server answers `{count, next, previous, results, no_leidas}` when `page` is sent. */
  listarPaginado(consulta: ConsultaPaginada): Observable<RespuestaNotificaciones> {
    return this.http.get<RespuestaNotificaciones>(this.apiUrl, { params: { ...consulta } });
  }

  /** Marks one notification as read for the current user only (idempotent). */
  marcarLeida(id: string): Observable<{ id: string; leida: boolean }> {
    return this.http.post<{ id: string; leida: boolean }>(`${this.apiUrl}${id}/leer/`, {});
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
