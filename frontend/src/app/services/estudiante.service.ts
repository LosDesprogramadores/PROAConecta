import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs";
import { IPersona, Persona, RolId } from "../model/Persona.model";
import { PersonaService } from "./persona.service";
import { MateriaService } from "./materia.service";


@Injectable({
    providedIn: 'root'
})

export class EstudianteService {

private readonly personaService = inject(PersonaService);
private readonly materiaService = inject(MateriaService);


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

obtenerMateriasEstudiante(estudianteId: number): Observable<any[]> {
  return this.materiaService.obteberMateriasPorEstudiante(estudianteId);  
  }


}