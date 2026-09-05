import { CommonModule } from '@angular/common';
import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterModule} from '@angular/router';
import { IPersona, Persona, RolId } from '../../../model/Persona.model';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProfesorService } from '../../../services/profesor.service';


@Component({
  selector: 'app-profesor',
  imports: [ReactiveFormsModule,RouterModule, CommonModule],
  templateUrl: './profesor.html',
  styleUrl: './profesor.css',
})
export class Profesor implements OnInit {
private fb = inject(FormBuilder);
private profesorService = inject(ProfesorService)
profesores = signal<Persona[]>([])
  isModalOpen = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  selectedId = signal<number | null>(null);

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
    this.profesorService.obtenerProfesores().subscribe({
      next : (data) => {this.profesores.set(data);
            console.log(data)},
      error: (err) => console.error('Error al cargar profesores:', err )

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
        const estudianteActualizado: Persona = {
         ...formValues,
         id: this.selectedId()!
       };
      
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
   
  }
   consultar(profesor: Persona): void {
   
  }

 }



