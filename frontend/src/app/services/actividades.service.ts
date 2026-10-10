import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Actividad, ActividadPayload } from '../model/actividad-model';
import { Seguimiento } from '../model/seguimiento.model';

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
  private apiUrl = `${environment.apiUrl}actividades`;
  private entregasUrl = `${environment.apiUrl}entregas`;

  // 👈 Método general que reclaman los otros componentes del dashboard
  getActividades(): Observable<Actividad[]> {
    return this.http.get<Actividad[]>(`${this.apiUrl}/`);
  }

  getActividadesPorMateria(materiaId: number): Observable<Actividad[]> {
    return this.http.get<Actividad[]>(`${this.apiUrl}/?materia=${materiaId}`);
  }

  getActividadById(id: number): Observable<Actividad> {
    return this.http.get<Actividad>(`${this.apiUrl}/${id}/`);
  }

  crearActividad(datos: ActividadPayload): Observable<Actividad> {
    return this.http.post<Actividad>(`${this.apiUrl}/`, datos);
  }

  updateActividad(id: number, datos: Partial<ActividadPayload>): Observable<Actividad> {
    return this.http.put<Actividad>(`${this.apiUrl}/${id}/`, datos);
  }

  eliminarActividad(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}/`);
  }

  // ===== Entregas y calificaciones =====

  getEntregas(actividadId: number): Observable<Entrega[]> {
    return this.http.get<Entrega[]>(`${this.apiUrl}/${actividadId}/entregas/`);
  }

  /** Every enrolled student of the activity with the delivery status (also those who did not deliver). */
  getSeguimiento(actividadId: number): Observable<Seguimiento> {
    return this.http.get<Seguimiento>(`${this.apiUrl}/${actividadId}/seguimiento/`);
  }

  calificarEntregaIndividual(
    entregaId: number,
    datos: CalificacionPayload
  ): Observable<NotaEntrega> {
    return this.http.post<NotaEntrega>(
      `${this.entregasUrl}/${entregaId}/calificar/`,
      datos
    );
  }

  calificarEstudianteEnActividad(
    actividadId: number,
    datos: CalificacionPayload & { estudiante_id: number }
  ): Observable<NotaEntrega> {
    return this.http.post<NotaEntrega>(
      `${this.apiUrl}/${actividadId}/calificar-estudiante/`,
      datos
    );
  }

  // Agregar dentro de ActividadesService:

  // Crear o enviar entrega
  crearEntrega(datos: FormData): Observable<Entrega> {
    return this.http.post<Entrega>(`${this.entregasUrl}/`, datos);
  }

  // Editar entrega existente
  actualizarEntrega(entregaId: number, datos: FormData): Observable<Entrega> {
    return this.http.put<Entrega>(`${this.entregasUrl}/${entregaId}/`, datos);
  }

  getMisEntregas(): Observable<Entrega[]> {
    return this.http.get<Entrega[]>(`${this.entregasUrl}/`);
  }
}