import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EstadoInscripcion, IAlumnoMateria, IMateria, RespuestaAsignacionProfesor, RespuestaInscripcionLote } from '../model/materia.model';
import { environment } from '../../environments/environment';
import { ConsultaPaginada, RespuestaDetalle, RespuestaMensaje, RespuestaPaginada } from '../core/models/api-response.interface';

@Injectable({
  providedIn: 'root',
})
export class MateriaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}materias/`;

  obtenerMaterias(): Observable<IMateria[]> {
    return this.http.get<IMateria[]>(this.baseUrl);
  }

  /** Paginated variant of `obtenerMaterias`: the server answers the page envelope when `page` is sent. */
  listarPaginado(consulta: ConsultaPaginada): Observable<RespuestaPaginada<IMateria>> {
    return this.http.get<RespuestaPaginada<IMateria>>(this.baseUrl, { params: { ...consulta } });
  }

  obtenerMateriaPorId(id: number): Observable<IMateria> {
    return this.http.get<IMateria>(`${this.baseUrl}${id}/`);
  }

  crearMateria(materia: IMateria): Observable<IMateria> {
    return this.http.post<IMateria>(this.baseUrl, materia);
  }

  cargarMateriasQueNoTengaElProfesor(profesorId: number): Observable<IMateria[]> {
    return this.http.get<IMateria[]>(`${this.baseUrl}?excluir_profesor=${profesorId}`);
  }

  actualizarMateria(id: number, materia: IMateria): Observable<IMateria> {
    return this.http.put<IMateria>(`${this.baseUrl}${id}/`, materia);
  }

  eliminarMateria(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}${id}/`);
  }

  asignarProfesorAMaterias(profesorId: number, materiaIds: number[]): Observable<RespuestaAsignacionProfesor> {
    return this.http.post<RespuestaAsignacionProfesor>(`${this.baseUrl}asignar-profesor/`, {
      profesor_id: profesorId,
      materia_ids: materiaIds,
    });
  }

  obtenerMateriasPorProfesor(profesorId: number): Observable<IMateria[]> {
    return this.http.get<IMateria[]>(`${this.baseUrl}?profesor=${profesorId}`);
  }

  obteberMateriasPorEstudiante(estudianteId: number): Observable<IMateria[]> {
    return this.http.get<IMateria[]>(`${this.baseUrl}por-estudiante/${estudianteId}/`);
  }

  cargarMateriasDisponiblesParaEstudiante(estudianteId: number): Observable<IMateria[]> {
    return this.http.get<IMateria[]>(`${this.baseUrl}?disponibles_estudiante=${estudianteId}`);
  }

  /**
   * Se mantiene temporalmente por compatibilidad
   * con componentes que puedan estar usando este método.
   *
   * La nueva lógica de inscripciones se encuentra en
   * InscripcionesService.
   */
  inscribirEstudianteEnMaterias(estudianteId: number, materiaIds: number[]): Observable<RespuestaInscripcionLote> {
    return this.http.post<RespuestaInscripcionLote>(`${environment.apiUrl}inscripciones/inscribir/`, {
      estudiante_id: estudianteId,
      materia_ids: materiaIds,
    });
  }

  desasignarProfesor(materiaId: number): Observable<RespuestaDetalle> {
    return this.http.patch<RespuestaDetalle>(`${this.baseUrl}${materiaId}/desasignar-profesor/`, {});
  }

  desinscribirEstudiante(estudianteId: number, materiaId: number): Observable<RespuestaMensaje> {
    return this.http.post<RespuestaMensaje>(`${environment.apiUrl}inscripciones/desinscribir/`, {
      estudiante_id: estudianteId,
      materia_id: materiaId
    });
  }

  /** Students enrolled in a subject. Without `estado` the backend excludes BAJA. */
  obtenerAlumnos(materiaId: number, estado?: EstadoInscripcion): Observable<IAlumnoMateria[]> {
    const params = estado ? new HttpParams().set('estado', estado) : undefined;
    return this.http.get<IAlumnoMateria[]>(`${this.baseUrl}${materiaId}/alumnos/`, { params });
  }
}
