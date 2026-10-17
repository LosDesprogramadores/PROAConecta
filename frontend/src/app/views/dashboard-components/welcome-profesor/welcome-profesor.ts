import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, signal, inject } from '@angular/core';

import { RouterLink } from '@angular/router';

import { MateriaService } from '../../../services/materia.service';
import { ActividadesService } from '../../../services/actividades.service';
import { MensajesEstadoService } from '../../../services/mensajes-estado.service';
import { Actividad } from '../../../model/actividad-model';
import { IMateria } from '../../../model/materia.model';
import { AuthService } from '../../../core/auth/auth.service';

export interface MateriasProfesor extends IMateria {
  id: number;
  estado: 'en-progreso' | 'finalizada' | 'archived';
  esFavorita: boolean;
  estudiantes: number;
}

@Component({
  selector: 'app-welcome-profesor',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './welcome-profesor.html',
  styleUrls: ['./welcome-profesor.css'],
})
export class WelcomeProfesor implements OnInit {
  private readonly materiaService = inject(MateriaService);
  private readonly actividadesService = inject(ActividadesService);
  private readonly authService = inject(AuthService);
  private readonly mensajesEstado = inject(MensajesEstadoService);

  // Señales exclusivas para profesor
  materiasProfesor = signal<MateriasProfesor[]>([]);
  private readonly actividades = signal<Actividad[]>([]);
  /** Deliveries without a grade; null while loading or when the server could not answer. */
  entregasSinCalificar = signal<number | null>(null);
  entregasNoDisponible = signal(false);
  consultasSinLeer = this.mensajesEstado.noLeidos;

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

  filtroMaterias = signal<'todas' | 'en-progreso' | 'finalizadas' | 'favoritas'>('todas');

  // === COMPUTED SIGNALS ===

  userName = computed(() => {
    const persona = this.authService.currentUser()?.persona;
    if (!persona) return 'Profesor';
    return `${persona.nombre} ${persona.apellido}`;
  });

  // Computed para materias filtradas del profesor
  materiasFiltradasComputed = computed(() => {
    const filtro = this.filtroMaterias();
    const all = this.materiasProfesor();

    if (filtro === 'todas') return all;
    if (filtro === 'favoritas') return all.filter((m) => m.esFavorita);
    return all.filter((m) => m.estado === filtro);
  });

  // Published activities whose deadline has not passed yet.
  private readonly actividadesVigentes = computed(() => {
    const ahora = Date.now();
    return this.actividades().filter((a) => a.estado === 'PUBLICADA' && new Date(a.fecha_limite).getTime() >= ahora);
  });

  totalActividadesActivas = computed(() => this.actividadesVigentes().length);

  /** Nearest deadline (ISO) of the current activities of each materia. */
  private readonly proximaEntregaPorMateria = computed(() => {
    const proximas = new Map<number, string>();
    for (const a of this.actividadesVigentes()) {
      const actual = proximas.get(a.materia);
      if (!actual || new Date(a.fecha_limite) < new Date(actual)) {
        proximas.set(a.materia, a.fecha_limite);
      }
    }
    return proximas;
  });

  // === LIFECYCLE ===

  ngOnInit(): void {
    this.loadMateriasProfesor();
    this.loadActividadesActivas();
    this.loadEntregasSinCalificar();
  }

  // === MÉTODOS PRIVADOS ===

  private loadMateriasProfesor(): void {
    this.cargando.set(true);
    this.error.set(null);

    const usuario = this.authService.currentUser();
    const personaId = usuario?.persona?.id;

    if (!personaId) {
      this.error.set('No se pudo identificar a la persona asociada.');
      this.cargando.set(false);
      return;
    }

    this.materiaService.obtenerMateriasPorProfesor(personaId).subscribe({
      next: (data: IMateria[]) => {
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
  }

  private loadActividadesActivas(): void {
    this.actividadesService.getActividades().subscribe({
      next: (data) => this.actividades.set(data),
      error: (err) => {
        console.error('Error cargando actividades activas:', err);
        // No interrumpimos el flujo: sin datos no hay vigentes ni próximas entregas.
        this.actividades.set([]);
      },
    });
  }

  private loadEntregasSinCalificar(): void {
    // page=1 returns the envelope; one item is enough because only the count matters.
    this.actividadesService.getEntregasPagina({ calificada: false, page: 1, page_size: 1 }).subscribe({
      next: (respuesta) => this.entregasSinCalificar.set(respuesta.count),
      error: () => this.entregasNoDisponible.set(true),
    });
  }

  // === MÉTODOS PÚBLICOS ===

  /** ISO deadline of the next delivery of a materia, or null when it has none. */
  proximaEntregaDe(materiaId: number): string | null {
    return this.proximaEntregaPorMateria().get(materiaId) ?? null;
  }

  toggleFavoritaProfesor(materiaId: number): void {
    this.materiasProfesor.update((materias) =>
      materias.map((m) => ({
        ...m,
        esFavorita: m.id === materiaId ? !m.esFavorita : m.esFavorita,
      })),
    );
  }

  setFiltroProfesor(filtro: 'todas' | 'en-progreso' | 'finalizadas' | 'favoritas'): void {
    this.filtroMaterias.set(filtro);
  }

  cambiarEstadoMateria(materiaId: number, nuevoEstado: 'en-progreso' | 'finalizada'): void {
    this.materiasProfesor.update((materias) =>
      materias.map((m) => ({
        ...m,
        estado: m.id === materiaId ? nuevoEstado : m.estado,
      })),
    );
  }

  // === MÉTODOS HELPER PARA TEMPLATE ===

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

  getEstadoText(estado: string): string {
    if (!estado) return 'Sin estado';
    const estadoMap: Record<string, string> = {
      'en-progreso': 'En progreso',
      'finalizada': 'Finalizada',
      'archived': 'Archivada',
    };
    return estadoMap[estado] || estado.charAt(0).toUpperCase() + estado.slice(1);
  }

  getFavoritaIcon(esFavorita: boolean): string {
    return esFavorita ? '★' : '☆';
  }
}