import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Unidad } from '../model/unidad-material.model';
import { Material } from '../model/unidad-material.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UnidadesService {
  private http = inject(HttpClient);
  
  private apiUrl = `${environment.apiUrl}`; 

  // ==========================================
  // --- ENDPOINTS DE UNIDADES (UnidadViewSet)
  // ==========================================

  /**
   * Obtiene las unidades filtradas por materia mediante Query Params
   */
  obtenerUnidadesPorMateria(materiaId: number | string): Observable<Unidad[]> {
    const params = new HttpParams().set('materia', materiaId.toString());
    return this.http.get<Unidad[]>(`${this.apiUrl}unidades/`, { params });
  }

  crearUnidad(unidad: Omit<Unidad, 'id'>): Observable<Unidad> {
    return this.http.post<Unidad>(`${this.apiUrl}unidades/`, unidad);
  }

  actualizarUnidad(id: number | string, unidad: Partial<Unidad>): Observable<Unidad> {
    return this.http.put<Unidad>(`${this.apiUrl}unidades/${id}/`, unidad);
  }

  eliminarUnidad(id: number | string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}unidades/${id}/`);
  }

  cambiarVisibilidadUnidad(id: number | string): Observable<{ id: number; visible: boolean; mensaje: string }> {
    return this.http.patch<{ id: number; visible: boolean; mensaje: string }>(
      `${this.apiUrl}unidades/${id}/cambiar-visibilidad/`, 
      {}
    );
  }
}