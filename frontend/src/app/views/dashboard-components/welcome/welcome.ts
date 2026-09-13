import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { MateriaService } from '../../../services/materia.service';
import { InscripcionesService } from '../../../services/inscripciones.service';
import { IMateria } from '../../../model/materia.model';

import { AuthService } from '../../../core/auth/auth.service';
import { UserRole } from '../../../core/auth/auth.model';

interface Noticia {
  fecha: string;
  hora: string;
  titulo: string;
  autor: string;
  contenido: string;
}

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './welcome.html',
  styleUrls: ['./welcome.css'],
})
export class Welcome implements OnInit {
  materias = signal<IMateria[]>([]);
  noticias = signal<Noticia[]>([]);

  cargando = signal(false);
  error = signal<string | null>(null);

  expandedMaterias = signal(false);

  readonly itemsToShow = 3;

  constructor(
    private readonly materiaService: MateriaService,
    private readonly inscripcionesService: InscripcionesService,
    private readonly authService: AuthService,
  ) {}

  userName = computed(() => {
    const persona = this.authService.currentUser()?.persona;

    if (!persona) {
      return 'Usuario';
    }

    return `${persona.nombre} ${persona.apellido}`;
  });

  esEstudiante = computed(() => {
    return this.authService.currentUser()?.rolId === UserRole.ESTUDIANTE;
  });

  esProfesor = computed(() => {
    return this.authService.currentUser()?.rolId === UserRole.DOCENTE;
  });

  tituloMaterias = computed(() => {
    return this.esEstudiante() ? 'Tus materias' : 'Materias asignadas';
  });

  ngOnInit(): void {
    this.loadMaterias();
    this.loadNoticias();
  }

  private loadMaterias(): void {
    this.cargando.set(true);
    this.error.set(null);

    const usuario = this.authService.currentUser();

    if (!usuario) {
      this.error.set('No se pudo identificar al usuario.');
      this.cargando.set(false);
      return;
    }

    const rolId = usuario.rolId;
    const personaId = usuario.persona?.id;

    if (!personaId) {
      this.error.set('No se pudo identificar a la persona asociada.');
      this.cargando.set(false);
      return;
    }

    /*
     * ESTUDIANTE
     *
     * Buscamos las inscripciones del estudiante y a partir
     * de ellas obtenemos las materias en las que está inscripto.
     */
    if (rolId === UserRole.ESTUDIANTE) {
      this.inscripcionesService.obtenerInscripcionesPorEstudiante(personaId).subscribe({
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

          this.error.set('No se pudieron cargar tus materias.');

          this.cargando.set(false);
        },
      });

      return;
    }

    /*
     * PROFESOR
     *
     * Buscamos únicamente las materias que tienen asignado
     * al profesor actual.
     */
    if (rolId === UserRole.DOCENTE) {
      this.materiaService.obtenerMateriasPorProfesor(personaId).subscribe({
        next: (data: IMateria[]) => {
          this.materias.set(data);
          this.cargando.set(false);
        },

        error: (err) => {
          console.error('Error cargando materias del profesor:', err);

          this.error.set('No se pudieron cargar tus materias.');

          this.cargando.set(false);
        },
      });

      return;
    }

    /*
     * Si el componente es utilizado por otro rol,
     * no hacemos una consulta general de materias.
     */
    console.warn('Rol no contemplado para Welcome:', rolId);

    this.error.set('No tenés materias disponibles para mostrar.');

    this.cargando.set(false);
  }

  private loadNoticias(): void {
    this.noticias.set([
      {
        fecha: '20/08/2026',
        hora: '08:00',
        titulo: 'Inicio del ciclo lectivo',
        autor: 'Dirección',
        contenido: 'El ciclo lectivo comienza oficialmente el lunes 24 de agosto.',
      },
    ]);
  }

  get materiasVisibles(): IMateria[] {
    if (this.expandedMaterias()) {
      return this.materias();
    }

    return this.materias().slice(0, this.itemsToShow);
  }

  get tieneMasMaterias(): boolean {
    return this.materias().length > this.itemsToShow;
  }

  toggleExpandMaterias(): void {
    this.expandedMaterias.update((value) => !value);
  }
}
