import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { ConsultaMensajes, Destinatario, Mensaje, MensajeLeido, NuevoMensaje, RespuestaMensajes } from '../model/mensaje.model';

@Injectable({ providedIn: 'root' })
export class MensajesService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}mensajes/`;

  obtenerMensajes(consulta: ConsultaMensajes): Observable<RespuestaMensajes> {
    let params = new HttpParams().set('bandeja', consulta.bandeja).set('page', consulta.page);
    if (consulta.page_size) {
      params = params.set('page_size', consulta.page_size);
    }
    if (consulta.materia) {
      params = params.set('materia', consulta.materia);
    }
    return this.http.get<RespuestaMensajes>(this.url, { params });
  }

  /** Limited to 30 per minute per user: the server answers 429 beyond that. */
  enviarMensaje(mensaje: NuevoMensaje): Observable<Mensaje> {
    return this.http.post<Mensaje>(this.url, mensaje);
  }

  /** Thread between the user and `con` (a `Usuario.pk`) in one subject: chronological, last 200 visible. */
  obtenerConversacion(materiaId: number, con: number): Observable<Mensaje[]> {
    const params = new HttpParams().set('materia', materiaId).set('con', con);
    return this.http.get<Mensaje[]>(`${this.url}conversacion/`, { params });
  }

  /** Only the recipient can mark a message (idempotent). */
  marcarLeido(id: string): Observable<MensajeLeido> {
    return this.http.post<MensajeLeido>(`${this.url}${id}/leer/`, {});
  }

  /** Only the sender, within 15 minutes of sending. */
  eliminarMensaje(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}${id}/`);
  }

  obtenerDestinatarios(materiaId: number): Observable<Destinatario[]> {
    return this.http.get<Destinatario[]>(`${environment.apiUrl}materias/${materiaId}/destinatarios/`);
  }
}
