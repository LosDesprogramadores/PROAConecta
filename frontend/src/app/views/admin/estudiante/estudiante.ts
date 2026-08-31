import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import { RouterModule, RouterOutlet } from '@angular/router';
import { IEstudiante, Persona } from '../../../model/Persona.model';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { EstudianteService } from '../../../services/estudiante.service';




@Component({
  selector: 'app-estudiante',
  imports: [ReactiveFormsModule,RouterModule, CommonModule],
  templateUrl: './estudiante.html',
  styleUrl: './estudiante.css',
})
export class Estudiante implements OnInit {
private fb = inject(FormBuilder);
private http = inject(HttpClient)
private estudianteService = inject(EstudianteService)
private readonly createPersona = `${environment.apiUrl}personas/`;
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
    if (this.form.invalid) return;

    // const formValues = this.form.getRawValue();

    // if (this.isEditing() && this.selectedId()) {
    //   this.students.update(lista =>
    //     lista.map(item => item.id === this.selectedId() ? { ...formValues, id: this.selectedId()! } : item)
    //   );
    // } else {
    //   const newId = this.students().length > 0 ? Math.max(...this.students().map(e => e.id)) + 1 : 1;
    //   const nuevoEstudiante: Persona = { ...formValues, id: newId ,rolId:3};
    //   const estudiante: IEstudiante = { ...formValues , rol:3};
      
    //   this.http.post<IEstudiante>(this.createPersona,estudiante).subscribe({
    //     next: (res)=> {
    //       console.log('Estudiante creado con èxito:', res)
    //     },
    //     error: (err)=> {
    //       console.log('Error al registrar el estudiante:', err)
    //     }
    //   })
    //   this.students.update(lista => [...lista, nuevoEstudiante]);
    // }

    // this.closeModal();
  }

  eliminar(id: number): void {
  //   if (confirm('¿Deseas eliminar este estudiante?')) {
  //     this.students.update(lista => lista.filter(item => item.id !== id));
  //   }
  }
}