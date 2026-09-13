import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IMateria} from '../../../model/materia.model';
import { MateriaService } from '../../../services/materia.service';


@Component({
  selector: 'app-materia',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './materia.html'
})
export class Materia implements OnInit {
  private materiaService = inject(MateriaService);
  private fb = inject(FormBuilder);

  materias = signal<IMateria[]>([]);
  isModalOpen = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  selectedId = signal<number | null>(null);
  isLoading = signal<boolean>(false);

  form: FormGroup = this.fb.group({
    titulo: ['', [Validators.required, Validators.maxLength(150)]],
    curso: ['', [Validators.required, Validators.maxLength(20)]],
    anio: [new Date().getFullYear(), [Validators.required, Validators.min(2000)]],
    descripcion: [''],
    criterios_evaluacion: ['']
  });

  ngOnInit(): void {
    this.cargarMaterias();
  }

  cargarMaterias(): void {
    this.isLoading.set(true);
    this.materiaService.obtenerMaterias().subscribe({
      next: (data) => {
        this.materias.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar materias:', err);
        this.isLoading.set(false);
      }
    });
  }

  openCreateModal(): void {
    this.isEditing.set(false);
    this.selectedId.set(null);
    this.form.reset({
      anio: new Date().getFullYear()
    });
    this.isModalOpen.set(true);
  }

  openEditModal(materia: IMateria): void {
    this.isEditing.set(true);
    this.selectedId.set(materia.id ?? null);
    this.form.patchValue({
      titulo: materia.titulo,
      curso: materia.curso,
      anio: materia.anio,
      descripcion: materia.descripcion ?? '',
      criterios_evaluacion: materia.criterios_evaluacion ?? ''
    });
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.form.reset();
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const formValues = this.form.getRawValue();
    const id = this.selectedId();

    if (this.isEditing() && id !== null) {
      const materiaActualizada: IMateria = { ...formValues, id };
      this.materiaService.actualizarMateria(id, materiaActualizada).subscribe({
        next: (res) => {
          this.materias.update(lista =>
            lista.map(item => item.id === id ? res : item)
          );
          this.closeModal();
        },
        error: (err) => console.error('Error al actualizar materia:', err)
      });
    } else {
      const nuevaMateria: IMateria = { ...formValues };
      this.materiaService.crearMateria(nuevaMateria).subscribe({
        next: (res) => {
          this.materias.update(lista => [...lista, res]);
          this.closeModal();
        },
        error: (err) => console.error('Error al registrar materia:', err)
      });
    }
  }

  eliminar(id: number | undefined): void {
    if (!id) return;
    if (!confirm('¿Estás seguro de eliminar esta materia?')) return;

    this.materiaService.eliminarMateria(id).subscribe({
      next: () => {
        this.materias.update(lista => lista.filter(item => item.id !== id));
      },
      error: (err) => console.error('Error al eliminar materia:', err)
    });
  }
}