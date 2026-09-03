import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs/internal/Observable";
import { Persona, RolId } from "../model/Persona.model";
import { PersonaService } from "./persona.service";

@Injectable({
    providedIn: 'root'
})

export class ProfesorService {

private readonly personaService = inject(PersonaService);




obtenerProfesores():Observable<Persona[]>{
    return this.personaService.obtenerPersonas(RolId.PROFESOR);

}

}