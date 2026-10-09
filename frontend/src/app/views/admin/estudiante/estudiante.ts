import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IPersona, Persona, RolId } from '../../../model/Persona.model';
import { EstudianteService } from '../../../services/estudiante.service';
import { IMateria } from '../../../model/materia.model';
import { MateriaService } from '../../../services/materia.service';
import { ToastService } from '../../../services/toast.service';
import { Modal } from '../../../shared/modal/modal';
import { mensajeErrorCampo } from '../../../shared/utils/form-errors';
import { Paginador } from '../../../shared/paginador/paginador';
import { IColumnaTabla } from '../../../model/tabla.model';
import { TablaGenerica } from '../tabla-generica/tabla-generica';
import { ExportarListado } from '../../../shared/exportar-listado/exportar-listado';
import { environment } from '../../../../environments/environment';



const TAMANO_PAGINA = 20;

@Component({
  selector: 'app-estudiante',
  imports: [Modal, ReactiveFormsModule, RouterModule, CommonModule, TablaGenerica, ExportarListado, Paginador],
  templateUrl: './estudiante.html',
  styleUrl: './estudiante.css',
})
export class Estudiante implements OnInit {
  private fb = inject(FormBuilder);
  private estudianteService = inject(EstudianteService)
  private materiaService = inject(MateriaService)
  private toastService = inject(ToastService)
  protected readonly urlExportarPersonas = `${environment.apiUrl}personas/exportar/`;
  protected readonly rolEstudiante = RolId.ESTUDIANTE;
  estudiantes = signal<Persona[]>([])
  readonly tamanoPagina = TAMANO_PAGINA;
  total = signal<number>(0);
  pagina = signal<number>(1);

  isModalOpen = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  selectedId = signal<number | null>(null);
  isLoading = signal<boolean>(false);

  isModalInscribirOpen = signal<boolean>(false);
  estudianteParaInscribir = signal<Persona | null>(null);
  materiasDisponibles = signal<IMateria[]>([]);
  selectedMateriaIds = signal<number[]>([]);
  isLoadingMaterias = signal<boolean>(false);

  estudianteSeleccionado = signal<any | null>(null);
  materiasEstudianteSeleccionado = signal<any[]>([]);
  isLoadingConsulta = signal<boolean>(false);

  estudianteAEliminar = signal<any | null>(null);

  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required]],
    apellido: ['', [Validators.required]],
    dni: ['', [Validators.required, Validators.minLength(7)]],
    email: ['', [Validators.required, Validators.email]],
    fecha_nacimiento: ['', [Validators.required]],
    tel_contacto: ['']
  });

  columnasMateriasEstudiante: IColumnaTabla[] = [
    { titulo: 'Materia', campo: 'titulo' },
    { titulo: 'Curso', campo: 'curso' },
    { titulo: 'Ciclo Lectivo', campo: 'anio', alineacion: 'center' },
    { titulo: 'Descripción', campo: 'descripcion' }
  ];


  protected errorCampo(campo: string): string | null {
    return mensajeErrorCampo(this.form.get(campo), { minlength: 'El DNI debe tener al menos 7 caracteres.' });
  }

  ngOnInit(): void {
    this.cargarEstudiantes()
  }

  /** Loads one server page. A page that emptied out (last row deleted) falls back to the previous one. */
  cargarEstudiantes(pagina: number = this.pagina()): void {
    this.isLoading.set(true);
    this.estudianteService.listarPaginado({ page: pagina, page_size: TAMANO_PAGINA }).subscribe({
      next: (respuesta) => {
        if (respuesta.results.length === 0 && pagina > 1) {
          this.cargarEstudiantes(pagina - 1);
          return;
        }
        this.estudiantes.set(respuesta.results);
        this.total.set(respuesta.count);
        this.pagina.set(pagina);
        this.isLoading.set(false);
      },

      error: (err) => {
        console.error('Error al cargar estudiantes:', err);
        this.toastService.error(this.toastService.readable_message_extraction(err), "");
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

  openEditModal(estudiante: Persona): void {
    this.ocultarModalConsultar();
    this.isEditing.set(true);
    this.selectedId.set(estudiante.id);
    this.form.patchValue(estudiante);
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
      this.estudianteService.actualizarEstudiante(this.selectedId()!, formValues).subscribe({
        next: (res: Persona) => {
          this.toastService.success('Estudiante actualizado con éxito.');
          this.estudiantes.update(lista => lista.map(e => e.id === res.id ? res : e));
          this.closeModal();
        },
        error: (err) => {
          console.error('Error al actualizar el estudiante:', err);
          this.toastService.error(this.toastService.readable_message_extraction(err), "");
        }
      });
    } else {

      const nuevoEstudiante: IPersona = {
        ...formValues,
        rol: RolId.ESTUDIANTE
      };

      this.estudianteService.crearEstudiates(nuevoEstudiante).subscribe({
        next: (res: Persona) => {
          this.toastService.success(`Estudiante ${res.nombre} ${res.apellido} se creó con éxito.`);
          // Jump to the last page: that is where the new row appears.
          this.cargarEstudiantes(Math.max(1, Math.ceil((this.total() + 1) / TAMANO_PAGINA)));
          this.closeModal();
        },
        error: (err) => {
          console.error('Error al registrar el estudiante:', err);
          this.toastService.error(this.toastService.readable_message_extraction(err), "");
        }
      });
    }
    this.closeModal();
  }

  eliminar(id: any): void {
   
   this.ocultarModalConsultar();
   this.estudianteAEliminar.set(id);
  }

confirmarEliminacion(): void {
  const estudianteId = this.estudianteAEliminar();
  if (!estudianteId) return;
  this.estudianteService.eliminarEstudiante(estudianteId).subscribe({
    next: () => {
      this.toastService.success('Estudiante eliminado con éxito.');
      this.cargarEstudiantes();
      this.cancelarEliminacion();
    },
    error: (err) => {
      console.error("Error al eliminar el estudiante:", err)
      this.toastService.error(this.toastService.readable_message_extraction(err), "");
      this.cancelarEliminacion();
    }
  });
}


cancelarEliminacion(): void {
  this.estudianteAEliminar.set(null);
}

  inscribir(estudiante: Persona): void {
    this.ocultarModalConsultar();
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
        this.toastService.error(this.toastService.readable_message_extraction(err), "");
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
      next: () => {
        this.toastService.success(`Se inscribió a ${estudiante.nombre} en ${ids.length} materias.`);
        this.cerrarModalInscribir();
      },
      error: (err) => {
        console.error('Error al inscribir al estudiante:', err);
        this.toastService.error(this.toastService.readable_message_extraction(err), "");
      }
    });
  }

  cerrarModalInscribir(): void {
    this.isModalInscribirOpen.set(false);
    this.estudianteParaInscribir.set(null);
    this.selectedMateriaIds.set([]);
  }


  consultar(estudiante: Persona): void {
    this.estudianteSeleccionado.set(estudiante);
    this.isLoadingConsulta.set(true);

    this.estudianteService.obtenerMateriasEstudiante(estudiante.id).subscribe({
      next: (data) => {
        this.materiasEstudianteSeleccionado.set(data);
        this.isLoadingConsulta.set(false);
      },
      error: (err) => {
        console.error(err);
        this.isLoadingConsulta.set(false);
        this.toastService.error('Error', 'No se pudieron cargar las materias del estudiante.');
      }
    });

  }
  
desinscribirMateria(materia: any) {
  const estudiante = this.estudianteSeleccionado();
  if (!estudiante) return;

  this.materiaService.desinscribirEstudiante(estudiante.id, materia.id).subscribe({
    next: () => {
       this.materiasEstudianteSeleccionado.update(materias => 
        materias.filter(m => m.id !== materia.id)
      );
     this.toastService.success("Se ha desinscrito al estudiante.");
    },
    error: () => {
      this.toastService.error("No se pudo desinscribir al estudiante tiene datos cargados en la materia.");
    }
  });
}

ocultarModalConsultar() {
  this.estudianteSeleccionado.set(null);
  this.materiasEstudianteSeleccionado.set([]);
  this.isLoadingConsulta.set(false);
   }

}