import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { IInscripcion } from '../model/materia.model';

@Injectable({
  providedIn: 'root'
})
export class InscripcionesService {

  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}inscripciones/`;

  obtenerInscripcionesPorEstudiante(
    estudianteId: number
  ): Observable<IInscripcion[]> {
    return this.http.get<IInscripcion[]>(
      `${this.baseUrl}?estudiante=${estudianteId}`
    );
  }

  obtenerInscripcionesPorMateria(
    materiaId: number
  ): Observable<IInscripcion[]> {
    return this.http.get<IInscripcion[]>(
      `${this.baseUrl}?materia=${materiaId}`
    );
  }
  //Este método permite inscribir a un estudiante en varias materias al mismo tiempo. pero está duplicado en otro servicio, se puede eliminar de aquí y usar el otro servicio para inscribir al estudiante en materias.
  inscribirEstudiante(
    estudianteId: number,
    materiaIds: number[]
  ): Observable<any> {
    return this.http.post(`${this.baseUrl}inscribir/`, {
      estudiante_id: estudianteId,
      materia_ids: materiaIds
    });
  }
}