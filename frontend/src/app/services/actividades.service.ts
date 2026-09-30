import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Actividad } from '../model/actividad-model';

export interface NotaEntrega {
  id: number;
  calificacion: string | number;
  descripcion: string;
  profesor_nombre?: string;
  fecha_publicacion?: string;
}

export interface Entrega {
  id: number;
  actividad: number;
  estudiante: number;
  estudiante_nombre: string;
  archivo?: string | null;
  enlace?: string | null;
  contenido_texto?: string | null;
  fuera_de_termino?: boolean;
  estado?: string;
  fecha_entrega: string;
  nota?: NotaEntrega | null;
}

export interface CalificacionPayload {
  calificacion: number;
  descripcion?: string;
  comentario?: string; // se manda también por compatibilidad con la spec
}

@Injectable({
  providedIn: 'root',
})
export class ActividadesService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8000/api/actividades';
  private entregasUrl = 'http://localhost:8000/api/entregas';

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

  // ===== Entregas y calificaciones =====

  getEntregas(actividadId: number): Observable<Entrega[]> {
    return this.http.get<Entrega[]>(`${this.apiUrl}/${actividadId}/entregas/`);
  }

  calificarEntregaIndividual(
    entregaId: number,
    datos: CalificacionPayload
  ): Observable<any> {
    return this.http.post<any>(
      `${this.entregasUrl}/${entregaId}/calificar/`,
      datos
    );
  }

  calificarEstudianteEnActividad(
    actividadId: number,
    datos: CalificacionPayload & { estudiante: number }
  ): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/${actividadId}/calificar-estudiante/`,
      datos
    );
  }
}