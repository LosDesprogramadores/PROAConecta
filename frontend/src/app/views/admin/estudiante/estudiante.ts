import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import { RouterModule} from '@angular/router';
import { IPersona, Persona, RolId } from '../../../model/Persona.model';
import { EstudianteService } from '../../../services/estudiante.service';
import { IMateria } from '../../../model/materia.model';
import { MateriaService } from '../../../services/materia.service';
import { ToastService } from '../../../services/toast.service';
import { Toast } from '../../../shared/toast/toast';


@Component({
  selector: 'app-estudiante',
  imports: [ReactiveFormsModule,RouterModule, CommonModule,Toast],
  templateUrl: './estudiante.html',
  styleUrl: './estudiante.css',
})
export class Estudiante implements OnInit {
private fb = inject(FormBuilder);
private estudianteService = inject(EstudianteService)
private materiaService = inject(MateriaService)
private toastService = inject(ToastService)
students = signal<Persona[]>([])

  isModalOpen = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  selectedId = signal<number | null>(null);
  isLoading = signal<boolean>(false);

  isModalInscribirOpen = signal<boolean>(false);
  estudianteParaInscribir = signal<Persona | null>(null);
  materiasDisponibles = signal<IMateria[]>([]);
  selectedMateriaIds = signal<number[]>([]);
  isLoadingMaterias = signal<boolean>(false);


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
    this.isLoading.set(true);
    this.estudianteService.obtenerEstudiates().subscribe({
      next : (data) => {
        this.students.set(data);
        this.isLoading.set(false);
            console.log(data)
          },

      error: (err) => {console.error('Error al cargar estudiantes:', err );
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
        this.toastService.success(`Estudiante ${res.nombre} ${res.apellido} se creó con éxito.`);
        this.students.update(lista => [...lista, res]);
        this.closeModal();
      },
      error: (err) => {
        console.error('Error al registrar el estudiante:', err);
        this.toastService.error('Error al intentar registrar el estudiante.');
      }
    });
  }
   this.closeModal();
  }

  eliminar(id: number): void {
   if (confirm('¿Deseas eliminar este estudiante?')) {
      this.estudianteService.eliminarEstudiante(id).subscribe({
        next: () => {
          console.log('Estudiante eliminado con éxito');  
          this.toastService.success('Estudiante eliminado con éxito.');
          this.students.update(lista => lista.filter(estudiante => estudiante.id !== id));
        },
        error: (err) => {
          console.error('Error al eliminar el estudiante:', err);
          this.toastService.error('Error al eliminar el estudiante.');
        }
      });
  }
  }

  inscribir(estudiante: Persona): void {
    console.log('Iniciando proceso de inscripción para el estudiante:', estudiante);
    this.estudianteParaInscribir.set(estudiante);
  this.selectedMateriaIds.set([]);
  this.isLoadingMaterias.set(true);
  this.isModalInscribirOpen.set(true);

    this.materiaService.cargarMateriasDisponiblesParaEstudiante(estudiante.id).subscribe({
      next: (res: any) => {
      const lista = Array.isArray(res) ? res : (res.results || []);
      this.materiasDisponibles.set(lista);
      this.isLoadingMaterias.set(false); 
    },
      error: (err) => {
        console.error('Error al cargar materias disponibles:', err);
        this.toastService.error('Error al cargar materias disponibles para inscripción.');
        this.materiasDisponibles.set([]);
      this.isLoadingMaterias.set(false);
      }
    });
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

  guardarInscripcion(): void {
    const estudiante = this.estudianteParaInscribir();
    const ids = this.selectedMateriaIds();

    if (!estudiante || ids.length === 0) return;

    this.materiaService.inscribirEstudianteEnMaterias(estudiante.id, ids).subscribe({
      next: (res) => {
        console.log('Inscripción realizada con éxito:', res);
        this.toastService.success(`Se inscribió a ${estudiante.nombre} en ${ids.length} materias.`);
        this.cerrarModalInscribir();
      },
      error: (err) => {
        console.error('Error al inscribir al estudiante:', err);
        this.toastService.error('Error al inscribir al estudiante.');
      }
    });
  }

  cerrarModalInscribir(): void {
    this.isModalInscribirOpen.set(false);
    this.estudianteParaInscribir.set(null);
    this.selectedMateriaIds.set([]);
  }


   consultar(students: Persona): void {
    this.toastService.info(`Consulta de estudiante: en desarrollo`);
   
  }
}