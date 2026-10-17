import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { InscripcionesService } from '../../../../services/inscripciones.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { IMateria } from '../../../../model/materia.model';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-materias-resumen',
  imports: [RouterLink],
  templateUrl: './materias-resumen.html',
  styleUrl: './materias-resumen.css',
})
export class MateriasResumen implements OnInit {

  private readonly inscripcionServices = inject(InscripcionesService);
  private readonly authServices = inject(AuthService);

  cargando = signal(false);
  error = signal<string | null>(null);
  materias = signal<IMateria[]>([]);

  // Estado para expandir / colapsar
  expandedMaterias = signal(false);
  readonly itemsToShow = 3;

  // Propiedades computadas para la vista resumida
  materiasVisibles = computed(() => {
    if (this.expandedMaterias()) {
      return this.materias();
    }
    return this.materias().slice(0, this.itemsToShow);
  });

  tieneMasMaterias = computed(() => {
    return this.materias().length > this.itemsToShow;
  });

  ngOnInit(): void {
    this.loadMaterias();
  }

  toggleExpandMaterias(): void {
    this.expandedMaterias.update((val) => !val);
  }

  private loadMaterias(): void {
    this.cargando.set(true);
    this.error.set(null);

    const usuario = this.authServices.currentUser();

    if (!usuario) {
      this.error.set('No se pudo identificar al usuario.');
      this.cargando.set(false);
      return;
    }

    const personaId = usuario.persona?.id;

    this.inscripcionServices.obtenerInscripcionesPorEstudiante(personaId).subscribe({
      next: (inscripciones) => {
        const materias: IMateria[] = inscripciones.map((inscripcion) => ({
          id: inscripcion.materia,
          titulo: inscripcion.materia_titulo,
          descripcion: null,
          criterios_evaluacion: null,
          anio: inscripcion.materia_anio,
          curso: inscripcion.materia_curso,
          activo: true,
          profesor: null,
          profesor_detalle: null,
          total_estudiantes: undefined,
        }));

        this.materias.set(materias);
        this.cargando.set(false);
      },

      error: (err) => {
        console.error('Error cargando materias del estudiante:', err);
        this.error.set('Ocurrió un error al consultar tus materias.');
        this.cargando.set(false);
      },
    });
  }
}