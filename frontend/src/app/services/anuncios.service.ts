import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Anuncio } from '../model/anuncio.model';
import { AnuncioMateria, NuevoAnuncio, RespuestaAnuncios } from '../model/anuncio-materia.model';
import { ConsultaPaginada } from '../core/models/api-response.interface';

@Injectable({
  providedIn: 'root'
})
export class AnunciosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}notificaciones/`;
  private readonly materiasUrl = `${environment.apiUrl}materias/`;

  /**
   * Obtiene el listado de anuncios/notificaciones desde MongoDB
   */
  getAnuncios(): Observable<Anuncio[]> {
    return this.http.get<Anuncio[]>(this.apiUrl);
  }

  /** Announcements of one subject, paginated (the server answers the envelope when `page` is sent). */
  listarPorMateria(materiaId: number | string, consulta: ConsultaPaginada): Observable<RespuestaAnuncios> {
    return this.http.get<RespuestaAnuncios>(`${this.materiasUrl}${materiaId}/anuncios/`, {
      params: { ...consulta },
    });
  }

  /** Only the titular professor of the subject can publish. */
  publicar(materiaId: number | string, anuncio: NuevoAnuncio): Observable<AnuncioMateria> {
    return this.http.post<AnuncioMateria>(`${this.materiasUrl}${materiaId}/anuncios/`, anuncio);
  }
}
