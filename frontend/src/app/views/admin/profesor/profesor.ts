import { CommonModule } from '@angular/common';
import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterModule} from '@angular/router';
import { IPersona, Persona, RolId } from '../../../model/Persona.model';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProfesorService } from '../../../services/profesor.service';
import { IMateria, IMateriaAsignacion } from '../../../model/materia.model';
import { MateriaService } from '../../../services/materia.service';
import { TablaGenerica } from '../tabla-generica/tabla-generica';
import { ToastService } from '../../../services/toast.service';


@Component({
  selector: 'app-profesor',
  imports: [ReactiveFormsModule,RouterModule, CommonModule, TablaGenerica],
  templateUrl: './profesor.html',
  styleUrl: './profesor.css',
})
export class Profesor implements OnInit {
private fb = inject(FormBuilder);
private materiaService = inject(MateriaService);
private profesorService = inject(ProfesorService)
private toastService = inject(ToastService)

profesores = signal<Persona[]>([])
isModalOpen = signal<boolean>(false);
isEditing = signal<boolean>(false);
selectedId = signal<number | null>(null);
isLoading = signal<boolean>(false);

profesorSeleccionado= signal<Persona | null>(null);
materiasProfesorSeleccionado = signal<IMateria[]>([]);
profesorConsultado = signal<Persona | null>(null);

profesorParaAsignar= signal<Persona | null>(null);
materiasDisponibles = signal<IMateria[]>([]);
isModalAsignarOpen = signal<boolean>(false);

selectedMateriaIds = signal<number[]>([]);
isLoadingConsulta = signal<boolean>(false);
isLoadingMaterias = signal<boolean>(false);

columnasMaterias = [
    { titulo: 'Materia', campo: 'titulo' },
    { titulo: 'Año / Nivel', campo: 'curso' },
    { titulo: 'Total de Estudiantes', campo: 'total_estudiantes' }
  ];

  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required]],
    apellido: ['', [Validators.required]],
    dni: ['', [Validators.required, Validators.minLength(7)]],
    email: ['', [Validators.required, Validators.email]],
    fecha_nacimiento: ['', [Validators.required]],
    tel_contacto: ['']
  });

 
  ngOnInit(): void {
     this.cargarProfesores()
  }

  cargarProfesores():void{
      this.isLoading.set(true);
    this.profesorService.obtenerProfesores().subscribe({
      next : (data) => {this.profesores.set(data);
          this.isLoading.set(false);
            console.log(data)},
      error: (err) => {console.error('Error al cargar profesores:', err )
        this.toastService.error('Error al cargar profesores.');
        this.isLoading.set(false);
      }
      })
  }

  openCreateModal(): void {
    this.isEditing.set(false);
    this.selectedId.set(null);
    this.form.reset();
    this.isModalOpen.set(true);
  }

  openEditModal(profesores: Persona): void {
    this.isEditing.set(true);
    this.selectedId.set(profesores.id);
    this.form.patchValue(profesores);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  save(): void {
    if (this.form.invalid) {
         this.form.markAllAsTouched();
         return;
       }
       const formValues = this.form.getRawValue();
   
       if (this.isEditing() && this.selectedId()) {
        this.profesorService.actualizarProfesor(this.selectedId()!, formValues).subscribe({
          next: (res: Persona) => {
            console.log('Profesor actualizado con éxito:', res);
            this.toastService.success('Profesor actualizado con éxito.');
            this.profesores.update(lista => lista.map(p => p.id === res.id ? res : p));
            this.closeModal();
          },
          error: (err) => {
            console.error('Error al actualizar el profesor:', err);
            this.toastService.error('Error al actualizar el profesor. ');
          }
        });
      
     } else {
     
       const nuevoProfesor: IPersona = {
         ...formValues,
         rol: RolId.PROFESOR 
       };
   
       this.profesorService.crearProfesores(nuevoProfesor).subscribe({
         next: (res: Persona) => {
           console.log('Profesor creado con éxito:', res);
           this.profesores.update(lista => [...lista, res]);
           this.closeModal();
         },
         error: (err) => {
           console.error('Error al registrar el profesor:', err);
         }
       });
     }
      this.closeModal();
}
 eliminar(id: number): void {
  //   if (confirm('¿Deseas eliminar este estudiante?')) {
  //     this.students.update(lista => lista.filter(item => item.id !== id));
  //   }
  }

  asignar(profesor: Persona): void {
    this.profesorSeleccionado.set(null);
    this.materiasProfesorSeleccionado.set([]);
    console.log('Asignando materias al profesor:', profesor);
    this.profesorParaAsignar.set(profesor);
    this.selectedMateriaIds.set([]);
    this.isLoadingMaterias.set(true);
    this.isModalAsignarOpen.set(true);

    this.materiaService.cargarMateriasQueNoTengaElProfesor(this.profesorParaAsignar()!.id).subscribe({
      next: (materias) => {
        this.materiasDisponibles.set(materias);
        this.isLoadingMaterias.set(false);
      
      },
      error: (err) => {
        console.error('Error al cargar materias:', err);
        this.toastService.error("Error al cargar  las materias" )
      
        this.isLoadingMaterias.set(false);
      }
    });
  }


consultar(profesor: Persona): void {
  console.log('1. Click en Consultar. Objeto recibido:', profesor);

  const actual = this.profesorSeleccionado();
  if (actual && actual.id === profesor.id) {
    
    return;
  }

  this.profesorSeleccionado.set(profesor);
  this.isLoadingConsulta.set(true);
  console.log('3. Señal profesorSeleccionado actualizada a:', this.profesorSeleccionado());

  this.materiasProfesorSeleccionado.set([]);

  this.materiaService.obtenerMateriasPorProfesor(profesor.id).subscribe({
    next: (materias) => {
      console.log('4. Materias recibidas con éxito:', materias);
      this.materiasProfesorSeleccionado.set(materias);
      this.isLoadingConsulta.set(false);
    },
    error: (err) => {
      console.error('Error HTTP al consultar materias:', err);
      this.isLoadingConsulta.set(false);
    }
  });
}

cerrarConsulta(): void {
  this.profesorSeleccionado.set(null);
  this.materiasProfesorSeleccionado.set([]);
}
  guardarAsignacion(): void {
  const profesor = this.profesorParaAsignar();
  const ids = this.selectedMateriaIds();

  if (!profesor  || ids.length === 0) return;
this.materiaService.asignarProfesorAMaterias(profesor.id, ids).subscribe({
    next: (res) => {
      console.log('Asignación completada:', res);
        this.toastService.success("Las materias si asignaron correctamente")
      this.cerrarModalAsignar();
  
    },
    error: (err) => {
      console.error('Error al asignar materias al profesor:', err);
        this.toastService.error("Error al asignar las materias al profesor" )
    }
  });
}

cerrarModalAsignar(): void {
  this.isModalAsignarOpen.set(false);
  this.profesorParaAsignar.set(null);
  this.selectedMateriaIds.set([]);
}


toggleMateria(id: number | undefined): void {
  if (!id) return;
  this.selectedMateriaIds.update(current =>
    current.includes(id) ? current.filter(item => item !== id) : [...current, id]
  );
}

isMateriaSelected(id: number | undefined): boolean {
  return id ? this.selectedMateriaIds().includes(id) : false;
}

seleccionarTodasMaterias(): void {
  const todas = this.materiasDisponibles();
  const idsValidos = todas
    .map(m => m.id)
    .filter((id): id is number => id !== undefined);

  if (this.selectedMateriaIds().length === idsValidos.length) {
    this.selectedMateriaIds.set([]);
  } else {
    this.selectedMateriaIds.set(idsValidos);
  }
}

setearProfesorSeleccionado(profesor: Persona) : void {
     this.profesorSeleccionado.set(profesor);
     this.materiasProfesorSeleccionado.set([]);
}

}



