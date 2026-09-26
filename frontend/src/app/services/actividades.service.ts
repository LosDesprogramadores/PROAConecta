import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Actividad } from '../model/actividad-model';

@Injectable({
  providedIn: 'root'
})
export class ActividadesService {
  private apiUrl = 'http://localhost:8000/api/actividades/'; // Ajusta según tu entorno si es necesario

  constructor(private http: HttpClient) {}

  /**
   * Obtiene TODAS las actividades del profesor
   * Usado por: Dashboard general
   */
  getActividades(): Observable<Actividad[]> {
    return this.http.get<Actividad[]>(this.apiUrl);
  }

  /**
   * Obtiene actividades filtradas por materia
   * Usado por: Vista de materia específica
   */
  getActividadesPorMateria(materiaId: number): Observable<Actividad[]> {
    return this.http.get<Actividad[]>(`${this.apiUrl}?materiaId=${materiaId}`);
  }

  /**
   * Obtiene una actividad específica por ID
   */
  getActividadById(id: number): Observable<Actividad> {
    return this.http.get<Actividad>(`${this.apiUrl}/${id}`);
  }

  /**
   * Crea una nueva actividad
   */
  crearActividad(datos: any): Observable<Actividad> {
    return this.http.post<Actividad>(this.apiUrl, datos);
  }

  /**
   * Actualiza una actividad existente
   */
  updateActividad(id: number, datos: any): Observable<Actividad> {
    return this.http.put<Actividad>(`${this.apiUrl}/${id}`, datos);
  }

  /**
   * Elimina una actividad
   */
  deleteActividad(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  /**
   * Obtiene todas las entregas de una actividad (para tabla de notas)
   */
  getEntregas(actividadId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${actividadId}/entregas`);
  }

  /**
   * Califica una entrega individual (corrección de archivo específico)
   * POST /api/entregas/{id}/calificar/
   * id = ID de la entrega física
   */
  calificarEntregaIndividual(
    entregaId: number,
    calificacion: number,
    comentarios?: string
  ): Observable<any> {
    return this.http.post(
      `${this.apiUrl.replace('/actividades', '')}/entregas/${entregaId}/calificar/`,
      { calificacion, comentarios }
    );
  }

  /**
   * Califica un estudiante desde la tabla de notas (con o sin entrega)
   * POST /api/actividades/{id}/calificar-estudiante/
   * id = ID de la actividad
   * estudiante_id = ID del estudiante a calificar
   */
  calificarEstudianteEnActividad(
    actividadId: number,
    estudianteId: number,
    calificacion: number,
    comentarios?: string
  ): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/${actividadId}/calificar-estudiante/`,
      { estudiante_id: estudianteId, calificacion, comentarios }
    );
  }
}