import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Material } from '../model/unidad-material.model';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class MaterialesService {
  private http = inject(HttpClient);

  private apiUrl = `${environment.apiUrl}`;

  /**
   * Obtiene los materiales asociados a una unidad específica
   */
  obtenerMaterialesPorUnidad(unidadId: number | string): Observable<Material[]> {
    const params = new HttpParams().set('unidad', unidadId.toString());
    return this.http.get<Material[]>(`${this.apiUrl}materiales/`, { params });
  }

  crearMaterial(material: Partial<Material>, archivoFile?: File): Observable<Material> {
    const formData = this.construirFormData(material, archivoFile);
    return this.http.post<Material>(`${this.apiUrl}materiales/`, formData);
  }

  actualizarMaterial(id: number | string, material: Partial<Material>, archivoFile?: File): Observable<Material> {
    const formData = this.construirFormData(material, archivoFile);
    return this.http.put<Material>(`${this.apiUrl}materiales/${id}/`, formData);
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

  obtenerMaterialesGenerales(materiaId: number | string): Observable<Material[]> {
    const params = new HttpParams()
      .set('materia', materiaId.toString())
      .set('recurso_general', 'true');

    return this.http.get<Material[]>(`${this.apiUrl}materiales/`, { params });
  }

  private construirFormData(material: Partial<Material>, archivoFile?: File): FormData {
    const formData = new FormData();
    if (material.materia) formData.append('materia', material.materia.toString());
    if (material.unidad) formData.append('unidad', material.unidad.toString());
    if (material.tipo) formData.append('tipo', material.tipo);
    if (material.titulo) formData.append('titulo', material.titulo);
    if (material.descripcion) formData.append('descripcion', material.descripcion);
    if (material.enlace) formData.append('enlace', material.enlace);
    if (material.visible !== undefined) formData.append('visible', String(material.visible));
    if (archivoFile) formData.append('archivo', archivoFile);

    return formData;
  }

 

  
}
