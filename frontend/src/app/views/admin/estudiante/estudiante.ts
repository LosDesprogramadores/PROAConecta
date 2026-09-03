import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import { RouterModule} from '@angular/router';
import { IPersona, Persona, RolId } from '../../../model/Persona.model';
import { EstudianteService } from '../../../services/estudiante.service';


@Component({
  selector: 'app-estudiante',
  imports: [ReactiveFormsModule,RouterModule, CommonModule],
  templateUrl: './estudiante.html',
  styleUrl: './estudiante.css',
})
export class Estudiante implements OnInit {
private fb = inject(FormBuilder);
private estudianteService = inject(EstudianteService)
students = signal<Persona[]>([])

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
     this.cargarEstudiantes()
  }

  cargarEstudiantes():void{
    this.estudianteService.obtenerEstudiates().subscribe({
      next : (data) => {this.students.set(data);
            console.log(data)},
      error: (err) => console.error('Error al cargar estudiantes:', err )

      })
  }

  openCreateModal(): void {
    this.isEditing.set(false);
    this.selectedId.set(null);
    this.form.reset();
    this.isModalOpen.set(true);
  }

  openEditModal(students: Persona): void {
    this.isEditing.set(true);
    this.selectedId.set(students.id);
    this.form.patchValue(students);
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
  
    const nuevoEstudiante: IPersona = {
      ...formValues,
      rol: RolId.ESTUDIANTE 
    };

    this.estudianteService.crearEstudiates(nuevoEstudiante).subscribe({
      next: (res: Persona) => {
        console.log('Estudiante creado con éxito:', res);
        this.students.update(lista => [...lista, res]);
        this.closeModal();
      },
      error: (err) => {
        console.error('Error al registrar el estudiante:', err);
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
}