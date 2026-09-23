import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Actividad } from '../model/actividad-model';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ActividadesService {
    private http = inject(HttpClient);
    private apiUrlEnv = `${environment.apiUrl}`;


    getActividades(materiaId?: number): Observable<Actividad[]> {
        let params = new HttpParams();

        if (materiaId) {
            params = params.set('materia', materiaId.toString());
        }

        return this.http.get<Actividad[]>(`${this.apiUrlEnv}actividades/`, { params });
    }
}