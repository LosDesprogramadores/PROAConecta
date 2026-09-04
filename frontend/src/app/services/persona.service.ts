import { inject, Injectable } from "@angular/core";
import { environment } from "../../environments/environment";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { IPersona, Persona, RolId } from "../model/Persona.model";

@Injectable({
    providedIn: 'root'
})
export class PersonaService {

private readonly http = inject(HttpClient);
private readonly baseUrl = environment.apiUrl;  


obtenerPersonas(rol: RolId): Observable<Persona[]> {
    return this.http.get<Persona[]>(`${this.baseUrl}personas/rol/?rol=${rol}`);
  }


crearPersona(NuevaPersona:IPersona): Observable<Persona> {
    return this.http.post<Persona>(`${this.baseUrl}personas/`, NuevaPersona);
  }

eliminarPersona(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}personas/${id}/`);
  }


}