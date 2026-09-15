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

  // ==========================================
  // --- ENDPOINTS DE MATERIAL (MaterialViewSet)
  // ==========================================

  /**
   * Obtiene los materiales asociados a una unidad específica
   */
  obtenerMaterialesPorUnidad(unidadId: number | string): Observable<Material[]> {
    const params = new HttpParams().set('unidad', unidadId.toString());
    return this.http.get<Material[]>(`${this.apiUrl}materiales/`, { params });
  }

  /**
   * Crea un nuevo material en Django. 
   */
  crearMaterial(material: Material, archivoFile?: File): Observable<Material> {
    const formData = new FormData();
    formData.append('materia', material.materia.toString());
    
    if (material.unidad) {
      formData.append('unidad', material.unidad.toString());
    }
    
    formData.append('tipo', material.tipo);
    formData.append('titulo', material.titulo);
    
    if (material.descripcion) formData.append('descripcion', material.descripcion);
    if (material.enlace) formData.append('enlace', material.enlace);
    if (archivoFile) formData.append('archivo', archivoFile);

    return this.http.post<Material>(`${this.apiUrl}materiales/`, formData);
  }

  eliminarMaterial(id: number | string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}materiales/${id}/`);
  }

  cambiarVisibilidadMaterial(id: number | string): Observable<{ id: number; visible: boolean; mensaje: string }> {
    return this.http.patch<{ id: number; visible: boolean; mensaje: string }>(
      `${this.apiUrl}materiales/${id}/cambiar-visibilidad/`, 
      {}
    );
  }
}