import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs/internal/Observable";
import { IPersona, Persona, RolId } from "../model/Persona.model";
import { PersonaService } from "./persona.service";
import { MateriaService } from "./materia.service";

@Injectable({
    providedIn: 'root'
})

export class ProfesorService {

private readonly personaService = inject(PersonaService);
private readonly materiaService = inject(MateriaService);




obtenerProfesores():Observable<Persona[]>{
    return this.personaService.obtenerPersonas(RolId.PROFESOR);

}

crearProfesores(nuevoProfesor:IPersona):Observable<Persona>{
    return this.personaService.crearPersona(nuevoProfesor);

}

asignarMateriasAProfesor(profesorId: number, materiaIds: number[]): Observable<any> {
    return this.materiaService.asignarProfesorAMaterias(profesorId, materiaIds);
  }
 actualizarProfesor(profesorId: number, profesorData: IPersona): Observable<Persona> {
    return this.personaService.actualizarPersona(profesorId, profesorData);
  } 


}