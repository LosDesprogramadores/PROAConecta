import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";

import { Observable } from "rxjs";
import { Persona, RolId } from "../model/Persona.model";
import { PersonaService } from "./persona.service";


@Injectable({
    providedIn: 'root'
})

export class EstudianteService {
private readonly personaService = inject(PersonaService);


obtenerEstudiates():Observable<Persona[]>{
    return this.personaService.obtenerPersonas(RolId.ESTUDIANTE);

}

}