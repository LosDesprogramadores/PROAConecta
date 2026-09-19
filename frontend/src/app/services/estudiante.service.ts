import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs";
import { IPersona, Persona, RolId } from "../model/Persona.model";
import { PersonaService } from "./persona.service";


@Injectable({
    providedIn: 'root'
})

export class EstudianteService {

private readonly personaService = inject(PersonaService);


obtenerEstudiates():Observable<Persona[]>{
    return this.personaService.obtenerPersonas(RolId.ESTUDIANTE);

}

crearEstudiates(nuevoEstudiante:IPersona):Observable<Persona>{
    return this.personaService.crearPersona(nuevoEstudiante);

}


actualizarEstudiante(estudianteId: number, estudianteActualizado: IPersona) {
  return this.personaService.actualizarPersona(estudianteId, estudianteActualizado);
}


eliminarEstudiante(id: number): Observable<void> {
  return this.personaService.eliminarPersona(id);       
}

}