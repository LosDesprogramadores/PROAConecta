import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Anuncio } from '../model/anuncio.model';

@Injectable({
  providedIn: 'root'
})
export class AnunciosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}notificaciones/`;

  /**
   * Obtiene el listado de anuncios/notificaciones desde MongoDB
   */
  getAnuncios(): Observable<Anuncio[]> {
    return this.http.get<Anuncio[]>(this.apiUrl);
  }
}