import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { INotificacion, NotificacionEntrada, RespuestaNotificacionCreada, RespuestaNotificaciones } from '../model/notificacion.model';
import { ConsultaPaginada, RespuestaDetalle } from '../core/models/api-response.interface';


@Injectable({
  providedIn: 'root'
})
export class NotificacionService {
  private http = inject(HttpClient);

  private readonly apiUrl = `${environment.apiUrl}notificaciones/`;

  obtenerNotificaciones(): Observable<INotificacion[]> {
    return this.http.get<INotificacion[]>(this.apiUrl);
  }

  /** Admin panel: only the notices the administrator created (`propias=true`), plain list without page. */
  listarPropias(): Observable<INotificacion[]> {
    return this.http.get<INotificacion[]>(this.apiUrl, { params: { propias: 'true' } });
  }

  /** Paginated variant: the server answers `{count, next, previous, results, no_leidas}` when `page` is sent. */
  listarPaginado(consulta: ConsultaPaginada): Observable<RespuestaNotificaciones> {
    return this.http.get<RespuestaNotificaciones>(this.apiUrl, { params: { ...consulta } });
  }

  /** Marks one notification as read for the current user only (idempotent). */
  marcarLeida(id: string): Observable<{ id: string; leida: boolean }> {
    return this.http.post<{ id: string; leida: boolean }>(`${this.apiUrl}${id}/leer/`, {});
  }

  crearNotificacion(data: NotificacionEntrada): Observable<RespuestaNotificacionCreada> {
    return this.http.post<RespuestaNotificacionCreada>(this.apiUrl, data);
  }

  actualizarNotificacion(id: string, data: NotificacionEntrada): Observable<RespuestaDetalle> {
    return this.http.put<RespuestaDetalle>(`${this.apiUrl}${id}/`, data);
  }

  eliminarNotificacion(id: string): Observable<RespuestaDetalle> {
    return this.http.delete<RespuestaDetalle>(`${this.apiUrl}${id}/`);
  }
}
