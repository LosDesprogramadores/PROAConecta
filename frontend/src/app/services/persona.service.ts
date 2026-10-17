import { inject, Injectable } from "@angular/core";
import { environment } from "../../environments/environment";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { IPersona, Persona, RolId } from "../model/Persona.model";
import { ConsultaPaginada, RespuestaPaginada } from "../core/models/api-response.interface";

@Injectable({
    providedIn: 'root'
})
export class PersonaService {

private readonly http = inject(HttpClient);
private readonly baseUrl = environment.apiUrl;  


obtenerPersonas(rol: RolId): Observable<Persona[]> {
    return this.http.get<Persona[]>(`${this.baseUrl}personas/rol/?rol=${rol}`);
  }


/** Paginated variant of `obtenerPersonas`: the server answers the page envelope when `page` is sent. */
listarPaginado(rol: RolId, consulta: ConsultaPaginada): Observable<RespuestaPaginada<Persona>> {
    return this.http.get<RespuestaPaginada<Persona>>(`${this.baseUrl}personas/rol/`, {
      params: { rol, ...consulta },
    });
  }

crearPersona(NuevaPersona:IPersona): Observable<Persona> {
    return this.http.post<Persona>(`${this.baseUrl}personas/`, NuevaPersona);
  }

eliminarPersona(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}personas/${id}/`);
  }

  actualizarPersona(id: number, personaData: IPersona): Observable<Persona> { 
    return this.http.put<Persona>(`${this.baseUrl}personas/${id}/`, personaData);
  }     

}