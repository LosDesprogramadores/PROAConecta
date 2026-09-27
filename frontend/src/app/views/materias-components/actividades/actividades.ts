import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ActividadesService } from '../../../services/actividades.service';
import { Actividad } from '../../../model/actividad-model';
import { UserRole } from '../../../core/auth/auth.model';

@Component({
  selector: 'app-actividades',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './actividades.html',
  styleUrl: './actividades.css',
})
export class Actividades implements OnInit {
  private authService = inject(AuthService);
  private actividadesService = inject(ActividadesService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  currentUser = this.authService.currentUser;

  esDocente = computed(() =>
    this.currentUser()?.rolId === UserRole.DOCENTE
  );

  esEstudiante = computed(() =>
    this.currentUser()?.rolId === UserRole.ESTUDIANTE
  );

  // Señales
  materiaId = signal<number | null>(null);
  materiaTitulo = signal<string>('');
  actividades = signal<Actividad[]>([]);
  cargando = signal(false);
  error = signal<string | null>(null);

  // Computed para estados (solo mostrar publicadas a estudiantes)
  actividadesPublicadas = computed(() =>
    this.actividades().filter(a => a.estado === 'PUBLICADA')
  );

  actividadesBorrador = computed(() =>
    this.actividades().filter(a => a.estado === 'BORRADOR')
  );

  // Actividades publicadas activas (no vencidas)
  actividadesActivas = computed(() => {
    const hoy = new Date();
    return this.actividadesPublicadas().filter(a => {
      const fecha = new Date(a.fecha_limite);
      return fecha >= hoy;
    });
  });

  // Actividades publicadas vencidas
  actividadesVencidas = computed(() => {
    const hoy = new Date();
    return this.actividadesPublicadas().filter(a => {
      const fecha = new Date(a.fecha_limite);
      return fecha < hoy;
    });
  });

  ngOnInit(): void {
    // Obtener el ID de la materia de los parámetros de ruta
    this.route.parent?.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.materiaId.set(Number(id));
        this.cargarActividades(Number(id));
      }
    });
  }

  private cargarActividades(materiaId: number): void {
    this.cargando.set(true);
    this.error.set(null);

    // Usa exactamente el método que el servicio ya tiene
    this.actividadesService.getActividadesPorMateria(materiaId).subscribe({
      next: (data: Actividad[]) => {
        this.actividades.set(data);
        // Extraer el título de la materia del primer registro
        if (data.length > 0) {
          this.materiaTitulo.set(data[0].materia_titulo);
        }
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error cargando actividades:', err);
        this.error.set('No se pudieron cargar las actividades. Intenta más tarde.');
        this.cargando.set(false);
      },
    });
  }

  nuevaActividad(): void {
    this.router.navigate(['/dashboard/actividades/nueva'], {
      queryParams: { materiaId: this.materiaId() }
    });
  }

  verActividad(actividad: Actividad): void {
    this.router.navigate(['/dashboard/actividades', actividad.id]);
  }

  gestionarActividad(actividad: Actividad): void {
    this.router.navigate(['/dashboard/actividades/editar', actividad.id]);
  }

  entregarActividad(actividad: Actividad): void {
    this.router.navigate(['/view-materia', this.materiaId(), 'actividades', actividad.id, 'entregar']);
  }

  verEntregas(actividad: Actividad): void {
    this.router.navigate(['/dashboard/actividades', actividad.id, 'entregas']);
  }

  recargar(): void {
    const id = this.materiaId();
    if (id) {
      this.cargarActividades(id);
    }
  }

  /**
   * Determina el estado visual
   */
  getEstadoBadge(actividad: Actividad): { estado: string; clase: string } {
    if (actividad.estado === 'BORRADOR') {
      return { estado: 'Borrador', clase: 'bg-slate-100 text-slate-700 border-slate-200' };
    }

    const hoy = new Date();
    const fecha = new Date(actividad.fecha_limite);

    if (fecha < hoy) {
      return { estado: 'Vencida', clase: 'bg-red-50 text-red-700 border-red-200' };
    } else {
      return { estado: 'Activa', clase: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
  }

  /**
   * Verifica si estudiante puede entregar
   */
  puedeEntregar(actividad: Actividad): boolean {
    if (!this.esEstudiante()) return false;
    if (actividad.estado !== 'PUBLICADA') return false;

    const hoy = new Date();
    const fecha = new Date(actividad.fecha_limite);

    // Puede entregar si no vence o si permite entrega tardía
    return fecha >= hoy || actividad.permitir_entrega_tardia;
  }
}