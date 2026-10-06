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

  // Computed para estados
  actividadesPublicadas = computed(() =>
    this.actividades().filter(a => a.estado === 'PUBLICADA')
  );

  actividadesBorrador = computed(() =>
    this.actividades().filter(a => a.estado === 'BORRADOR')
  );

  actividadesActivas = computed(() => {
    const hoy = new Date();
    return this.actividadesPublicadas().filter(a => {
      const fecha = new Date(a.fecha_limite);
      return fecha >= hoy;
    });
  });

  actividadesVencidas = computed(() => {
    const hoy = new Date();
    return this.actividadesPublicadas().filter(a => {
      const fecha = new Date(a.fecha_limite);
      return fecha < hoy;
    });
  });

  ngOnInit(): void {
    this.route.parent?.params.subscribe(params => {
      const id = params['id'] || this.route.snapshot.queryParams['materiaId'];
      if (id) {
        this.materiaId.set(Number(id));
        this.cargarActividades(Number(id));
      }
    });
  }

  private cargarActividades(materiaId: number): void {
    this.cargando.set(true);
    this.error.set(null);

    this.actividadesService.getActividadesPorMateria(materiaId).subscribe({
      next: (data: Actividad[]) => {
        this.actividades.set(data);
        if (data.length > 0) {
          this.materiaTitulo.set(data[0].materia_titulo);
        }
        this.cargando.set(false);
      },
      error: (err: any) => {
        console.error('Error cargando actividades:', err);
        this.error.set('No se pudieron cargar las actividades. Intenta más tarde.');
        this.cargando.set(false);
      },
    });
  }

  nuevaActividad(): void {
    const idMat = this.materiaId();
    if (idMat) {
      this.router.navigate(['/view-materia', idMat, 'actividades', 'nueva']);
    } else {
      this.router.navigate(['/dashboard/actividades/nueva']);
    }
  }

  verActividad(actividad: Actividad): void {
    const idMat = actividad.materia || this.materiaId();
    this.router.navigate(['/view-materia', idMat, 'actividades', actividad.id, 'detalle']);
  }

  gestionarActividad(actividad: Actividad): void {
    const idMat = actividad.materia || this.materiaId();
    this.router.navigate(['/view-materia', idMat, 'actividades', actividad.id, 'editar']);
  }

  entregarActividad(actividad: Actividad): void {
    const idMat = actividad.materia || this.materiaId();
    // Students submit from the estudiante activities view (submission modal).
    this.router.navigate(['/view-materia', idMat, 'estudiante', 'actividades']);
  }

  verEntregas(actividad: Actividad): void {
    const idMat = actividad.materia || this.materiaId();
    this.router.navigate(['/view-materia', idMat, 'actividades', actividad.id, 'entregas']);
  }

  // 👈 MÉTODO DE ELIMINACIÓN CON TIPADO CORRECTO
  eliminarActividad(actividad: Actividad): void {
    if (confirm(`¿Estás seguro de que deseas eliminar la actividad "${actividad.titulo}"?`)) {
      this.actividadesService.eliminarActividad(actividad.id).subscribe({
        next: () => {
          this.actividades.update(acts => acts.filter(a => a.id !== actividad.id));
        },
        error: (err: any) => {
          console.error('Error al eliminar la actividad:', err);
          alert('No se pudo eliminar la actividad. Intenta nuevamente.');
        }
      });
    }
  }

  recargar(): void {
    const id = this.materiaId();
    if (id) {
      this.cargarActividades(id);
    }
  }

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

  puedeEntregar(actividad: Actividad): boolean {
    if (!this.esEstudiante()) return false;
    if (actividad.estado !== 'PUBLICADA') return false;

    const hoy = new Date();
    const fecha = new Date(actividad.fecha_limite);

    return fecha >= hoy || actividad.permitir_entrega_tardia;
  }
}