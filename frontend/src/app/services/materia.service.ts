import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IMateria, Materia } from '../model/materia.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class MateriaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}materias/`; 

  obtenerMaterias(): Observable<IMateria[]> {
    return this.http.get<IMateria[]>(this.baseUrl);
  }

  crearMateria(materia: IMateria): Observable<IMateria> {
    return this.http.post<IMateria>(this.baseUrl, materia);
  }

  actualizarMateria(id: number, materia: IMateria): Observable<IMateria> {
    return this.http.put<IMateria>(`${this.baseUrl}${id}/`, materia);
  }

  eliminarMateria(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}${id}/`);
  }
}