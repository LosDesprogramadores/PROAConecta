import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { MateriaService } from '../../../../services/materia.service';
import { InscripcionesService } from '../../../../services/inscripciones.service';
import { IMateria } from '../../../../model/materia.model';

import { AuthService } from '../../../../core/auth/auth.service';
import { UserRole } from '../../../../core/auth/auth.model';
import { Informacion } from '../informacion/informacion';

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
  imports: [CommonModule, RouterLink, Informacion],
  templateUrl: './welcome.html',
  styleUrls: ['./welcome.css'],
})
export class Welcome implements OnInit {
  // Señales para estudiante
  materias = signal<IMateria[]>([]);
  
  noticias = signal<Noticia[]>([]);

  // Anuncios para el sidebar del profesor
  sidebarAnuncios = signal([
    {
      id: 1,
      titulo: 'Inicio del ciclo lectivo',
      categoria: 'Institucional',
      tipo: 'principal',
    },
    {
      id: 3,
      titulo: 'Cierre de calificaciones en 3 días',
      categoria: 'Recordatorio',
      tipo: 'secundario',
    },
    {
      id: 4,
      titulo: 'Mantenimiento programado sábado',
      categoria: 'Sistema',
      tipo: 'secundario',
    },
  ]);

  cargando = signal(false);
  error = signal<string | null>(null);

  expandedMaterias = signal(false);
  filtroMaterias = signal<'todas' | 'en-progreso' | 'finalizadas' | 'favoritas'>('todas');

  readonly itemsToShow = 3;

  constructor(
    private readonly materiaService: MateriaService,
    private readonly inscripcionesService: InscripcionesService,
    private readonly authService: AuthService,
  ) {}

  // === COMPUTED SIGNALS ===

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


  // === LIFECYCLE ===

  ngOnInit(): void {
    this.loadMaterias();
    this.loadNoticias();
  }

  // === MÉTODOS PRIVADOS ===

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

  // === GETTERS PARA ESTUDIANTE ===

  get materiasVisibles(): IMateria[] {
    if (this.expandedMaterias()) {
      return this.materias();
    }

    return this.materias().slice(0, this.itemsToShow);
  }

  get tieneMasMaterias(): boolean {
    return this.materias().length > this.itemsToShow;
  }

  // === MÉTODOS PÚBLICOS - ESTUDIANTE ===

  toggleExpandMaterias(): void {
    this.expandedMaterias.update((value) => !value);
  }

}