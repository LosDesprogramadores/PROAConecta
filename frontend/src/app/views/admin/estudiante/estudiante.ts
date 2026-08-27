import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import { RouterModule, RouterOutlet } from '@angular/router';
import { IEstudiante, Persona } from '../../../model/Persona.model';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';




@Component({
  selector: 'app-estudiante',
  imports: [ReactiveFormsModule,RouterModule, CommonModule],
  templateUrl: './estudiante.html',
  styleUrl: './estudiante.css',
})
export class Estudiante {
private fb = inject(FormBuilder);
private http = inject(HttpClient)
private readonly createPersona = `${environment.apiUrl}personas/`;

  students = signal<Persona[]>([
    {
      id: 1,
      nombre: 'Lucía',
      apellido: 'González',
      dni: '44123456',
      email: 'lucia.gonzalez@email.com',
      fecha_nacimiento: '2005-04-12',
      tel_contacto: '3514567890',
      rolId:3
    },
    {
      id: 2,
      nombre: 'Mateo',
      apellido: 'Romero',
      dni: '43987654',
      email: 'mateo.romero@email.com',
      fecha_nacimiento: '2004-11-23',
      tel_contacto: '3517891234',
      rolId:3
    },
    {
      id: 3,
      nombre: 'Sofía',
      apellido: 'Fernández',
      dni: '45321654',
      email: 'sofia.f@email.com',
      fecha_nacimiento: '2006-08-05',
      tel_contacto: '3513334455',
      rolId:3
    }
  ]);

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
    if (this.form.invalid) return;

    const formValues = this.form.getRawValue();

    if (this.isEditing() && this.selectedId()) {
      this.students.update(lista =>
        lista.map(item => item.id === this.selectedId() ? { ...formValues, id: this.selectedId()! } : item)
      );
    } else {
      const newId = this.students().length > 0 ? Math.max(...this.students().map(e => e.id)) + 1 : 1;
      const nuevoEstudiante: Persona = { ...formValues, id: newId ,rolId:3};
      const estudiante: IEstudiante = { ...formValues , rol:3};
      
      this.http.post<IEstudiante>(this.createPersona,estudiante).subscribe({
        next: (res)=> {
          console.log('Estudiante creado con èxito:', res)
        },
        error: (err)=> {
          console.log('Error al registrar el estudiante:', err)
        }
      })
      this.students.update(lista => [...lista, nuevoEstudiante]);
    }

    this.closeModal();
  }

  eliminar(id: number): void {
    if (confirm('¿Deseas eliminar este estudiante?')) {
      this.students.update(lista => lista.filter(item => item.id !== id));
    }
  }
}