import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs/internal/Observable";
import { IPersona, Persona, RolId } from "../model/Persona.model";
import { PersonaService } from "./persona.service";
import { MateriaService } from "./materia.service";
import { RespuestaAsignacionProfesor } from "../model/materia.model";
import { ConsultaPaginada, RespuestaPaginada } from "../core/models/api-response.interface";

@Injectable({
    providedIn: 'root'
})

export class ProfesorService {

private readonly personaService = inject(PersonaService);
private readonly materiaService = inject(MateriaService);




obtenerProfesores():Observable<Persona[]>{
    return this.personaService.obtenerPersonas(RolId.PROFESOR);

}

listarPaginado(consulta: ConsultaPaginada): Observable<RespuestaPaginada<Persona>> {
    return this.personaService.listarPaginado(RolId.PROFESOR, consulta);
}

crearProfesores(nuevoProfesor:IPersona):Observable<Persona>{
    return this.personaService.crearPersona(nuevoProfesor);

}

asignarMateriasAProfesor(profesorId: number, materiaIds: number[]): Observable<RespuestaAsignacionProfesor> {
    return this.materiaService.asignarProfesorAMaterias(profesorId, materiaIds);
  }
 actualizarProfesor(profesorId: number, profesorData: IPersona): Observable<Persona> {
    return this.personaService.actualizarPersona(profesorId, profesorData);
  } 

eliminarProfesor(profesorId: number): Observable<void> {
    return this.personaService.eliminarPersona(profesorId); 
  }

 

}