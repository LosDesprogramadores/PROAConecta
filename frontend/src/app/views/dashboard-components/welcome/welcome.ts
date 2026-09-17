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

export interface MateriasProfesor extends IMateria {
  id: number;
  estado: 'en-progreso' | 'finalizada' | 'archived';
  esFavorita: boolean;
  estudiantes: number;
  proximaEntrega: string;
}

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './welcome.html',
  styleUrls: ['./welcome.css'],
})
export class Welcome implements OnInit {
  // Señales para estudiante
  materias = signal<IMateria[]>([]);
  
  // Señales para profesor - tipado como MateriasProfesor
  materiasProfesor = signal<MateriasProfesor[]>([]);
  
  noticias = signal<Noticia[]>([]);

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

  // Computed para materias filtradas (profesor)
  materiasFiltradasComputed = computed(() => {
    const filtro = this.filtroMaterias();
    const all = this.materiasProfesor();

    if (filtro === 'todas') return all;
    if (filtro === 'favoritas') return all.filter((m) => m.esFavorita);
    return all.filter((m) => m.estado === filtro);
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

    /*
     * PROFESOR
     */
    if (rolId === UserRole.DOCENTE) {
      this.materiaService.obtenerMateriasPorProfesor(personaId).subscribe({
        next: (data: IMateria[]) => {
          // Mapear datos con información adicional para profesor
          const materiasConInfo: MateriasProfesor[] = data
            .filter((materia): materia is IMateria & { id: number } => 
              materia.id !== undefined && materia.id !== null
            )
            .map((materia) => ({
              ...materia,
              id: materia.id as number,
              estado: 'en-progreso' as const,
              esFavorita: false,
              estudiantes: materia.total_estudiantes || 0,
              proximaEntrega: 'Próxima entrega: 25 Ago',
            }));

          this.materiasProfesor.set(materiasConInfo);
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

  // === MÉTODOS PÚBLICOS - PROFESOR ===

  /**
   * Alterna el estado favorito de una materia
   */
  toggleFavoritaProfesor(materiaId: number): void {
    this.materiasProfesor.update((materias) =>
      materias.map((m) => ({
        ...m,
        esFavorita: m.id === materiaId ? !m.esFavorita : m.esFavorita,
      })),
    );
  }

  /**
   * Establece el filtro de materias
   */
  setFiltroProfesor(filtro: 'todas' | 'en-progreso' | 'finalizadas' | 'favoritas'): void {
    this.filtroMaterias.set(filtro);
  }

  /**
   * Cambia el estado de una materia
   */
  cambiarEstadoMateria(materiaId: number, nuevoEstado: 'en-progreso' | 'finalizada'): void {
    this.materiasProfesor.update((materias) =>
      materias.map((m) => ({
        ...m,
        estado: m.id === materiaId ? nuevoEstado : m.estado,
      })),
    );
  }

  // === MÉTODOS HELPER PARA TEMPLATE ===

  /**
   * Retorna las clases CSS para el badge de estado
   */
  getEstadoBadgeClass(estado: string): string {
    const baseClass = 'inline-block px-3 py-1 rounded-full text-xs font-medium';
    
    switch (estado) {
      case 'en-progreso':
        return `${baseClass} bg-blue-100 text-blue-700`;
      case 'finalizada':
        return `${baseClass} bg-slate-100 text-slate-600`;
      case 'archived':
        return `${baseClass} bg-slate-50 text-slate-400`;
      default:
        return baseClass;
    }
  }

  /**
   * Retorna el texto legible del estado
   */
  getEstadoText(estado: string): string {
    if (!estado) return 'Sin estado';
    
    const estadoMap: Record<string, string> = {
      'en-progreso': 'En progreso',
      'finalizada': 'Finalizada',
      'archived': 'Archivada',
    };

    return estadoMap[estado] || estado.charAt(0).toUpperCase() + estado.slice(1);
  }

  /**
   * Retorna el ícono de favorita (estrella llena o vacía)
   */
  getFavoritaIcon(esFavorita: boolean): string {
    return esFavorita ? '★' : '☆';
  }
}