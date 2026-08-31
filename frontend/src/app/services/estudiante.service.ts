import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { environment } from "../../environments/environment";
import { Observable } from "rxjs";
import { Persona, RolId } from "../model/Persona.model";

@Injectable({
    providedIn: 'root'
})

export class EstudianteService {
private readonly http = inject(HttpClient);
private readonly baseUrl = environment.apiUrl;





obtenerEstudiates():Observable<Persona[]>{
    return this.http.get<Persona[]>(`${this.baseUrl}personas/rol/?rol=${RolId.ESTUDIANTE}`);

}

}