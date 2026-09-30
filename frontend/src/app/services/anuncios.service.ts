import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Anuncio } from '../model/anuncio.model';

@Injectable({
  providedIn: 'root'
})
export class AnunciosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8000/api/notificaciones/';

  /**
   * Obtiene el listado de anuncios/notificaciones desde MongoDB
   */
  getAnuncios(): Observable<Anuncio[]> {
    return this.http.get<Anuncio[]>(this.apiUrl);
  }
}