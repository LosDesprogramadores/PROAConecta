import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Actividad } from '../model/actividad-model';

@Injectable({
  providedIn: 'root',
})
export class ActividadesService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8000/api/actividades';

  // 👈 Método general que reclaman los otros componentes del dashboard
  getActividades(): Observable<Actividad[]> {
    return this.http.get<Actividad[]>(`${this.apiUrl}/`);
  }

  getActividadesPorMateria(materiaId: number): Observable<Actividad[]> {
    return this.http.get<Actividad[]>(`${this.apiUrl}/?materia=${materiaId}`);
  }

  getActividadById(id: number): Observable<Actividad> {
    return this.http.get<Actividad>(`${this.apiUrl}/${id}`);
  }

  crearActividad(datos: any): Observable<Actividad> {
    return this.http.post<Actividad>(`${this.apiUrl}/`, datos);
  }

  updateActividad(id: number, datos: any): Observable<Actividad> {
    return this.http.put<Actividad>(`${this.apiUrl}/${id}/`, datos);
  }

  eliminarActividad(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}/`);
  }
}