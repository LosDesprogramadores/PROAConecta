import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ActividadCalificacion {
  actividad_id: number;
  titulo: string;
  calificacion: string | number | null;
  devolucion: string | null;
}

export interface RendimientoEstudiante {
  materia_id: number;
  materia_titulo: string;
  anio: number;
  curso: string;
  estudiante: {
    id: number;
    nombre_completo: string;
    dni: string | null;
  };
  total_evaluaciones: number;
  promedio: string | number | null;
  actividades: ActividadCalificacion[];
}

@Injectable({
  providedIn: 'root',
})
export class CalificacionesService {
  private http = inject(HttpClient);

  private apiUrl = 'http://localhost:8000/api/materias';

  obtenerMiRendimiento(materiaId: number): Observable<RendimientoEstudiante> {
    return this.http.get<RendimientoEstudiante>(
      `${this.apiUrl}/${materiaId}/mi-rendimiento/`
    );
  }
}