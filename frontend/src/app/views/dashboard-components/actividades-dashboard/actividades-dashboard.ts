import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ActividadesService } from '../../../services/actividades.service';
import { Actividad } from '../../../model/actividad-model';
import { UserRole } from '../../../core/auth/auth.model';

import { ConfirmDialogService } from '../../../services/confirm-dialog.service';
import { filter } from 'rxjs';
@Component({
  selector: 'app-actividades-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './actividades-dashboard.html',
  styleUrl: './actividades-dashboard.css',
})
export class ActividadesDashboard implements OnInit {
  private authService = inject(AuthService);
  private confirmDialog = inject(ConfirmDialogService);
  private actividadesService = inject(ActividadesService);
  private router = inject(Router);

  currentUser = this.authService.currentUser;

  esDocente = computed(() =>
    this.currentUser()?.rolId === UserRole.DOCENTE
  );

  esEstudiante = computed(() =>
    this.currentUser()?.rolId === UserRole.ESTUDIANTE
  );

  // Señales
  actividades = signal<Actividad[]>([]);
  cargando = signal(false);
  error = signal<string | null>(null);

  // Computed para estados (según el modelo)
  actividadesPublicadas = computed(() =>
    this.actividades().filter(a => a.estado === 'PUBLICADA')
  );

  actividadesBorrador = computed(() =>
    this.actividades().filter(a => a.estado === 'BORRADOR')
  );

  // Actividades publicadas que ya pasaron fecha_limite
  actividadesVencidas = computed(() => {
    const hoy = new Date();
    return this.actividadesPublicadas().filter(a => {
      const fecha = new Date(a.fecha_limite);
      return fecha < hoy;
    });
  });

  // Actividades publicadas que aún no vencen
  actividadesActivas = computed(() => {
    const hoy = new Date();
    return this.actividadesPublicadas().filter(a => {
      const fecha = new Date(a.fecha_limite);
      return fecha >= hoy;
    });
  });

  // Filtro
  filtroActual = signal<'todas' | 'publicadas' | 'borrador' | 'vencidas' | 'activas'>('publicadas');

  actividadesFiltradas = computed(() => {
    const filtro = this.filtroActual();
    const todas = this.actividades();

    switch (filtro) {
      case 'publicadas':
        return this.actividadesPublicadas();
      case 'borrador':
        return this.actividadesBorrador();
      case 'vencidas':
        return this.actividadesVencidas();
      case 'activas':
        return this.actividadesActivas();
      default:
        return todas;
    }
  });

  ngOnInit(): void {
    this.cargarActividades();
  }

  private cargarActividades(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.actividadesService.getActividades().subscribe({
      next: (data: Actividad[]) => {
        this.actividades.set(data);
        this.cargando.set(false);
      },
      error: (err: any) => {
        console.error('Error cargando actividades:', err);
        this.error.set('No se pudieron cargar las actividades. Intenta más tarde.');
        this.cargando.set(false);
      },
    });
  }

  setFiltro(filtro: 'todas' | 'publicadas' | 'borrador' | 'vencidas' | 'activas'): void {
    this.filtroActual.set(filtro);
  }

  nuevaActividad(): void {
    this.router.navigate(['/dashboard/actividades/nueva']);
  }

  verActividad(actividad: Actividad): void {
    const idMat = typeof actividad.materia === 'object' ? (actividad.materia as any).id : actividad.materia;
    this.router.navigate(['/view-materia', idMat, 'actividades', actividad.id, 'detalle']);
  }

  gestionarActividad(actividad: Actividad): void {
    const idMat = typeof actividad.materia === 'object' ? (actividad.materia as any).id : actividad.materia;
    // Redirige al formulario de edición de la materia correspondiente
    this.router.navigate(['/view-materia', idMat, 'actividades', actividad.id, 'editar']);
  }

  verEntregas(actividad: Actividad): void {
    const idMat = typeof actividad.materia === 'object' ? (actividad.materia as any).id : actividad.materia;
    this.router.navigate(['/view-materia', idMat, 'actividades', actividad.id, 'entregas']);
  }

  eliminarActividad(actividad: Actividad): void {
    this.confirmDialog.confirmar(`¿Estás seguro de que deseas eliminar la actividad "${actividad.titulo}"?`).pipe(filter(Boolean)).subscribe(() => {
      this.actividadesService.eliminarActividad(actividad.id).subscribe({
        next: () => {
          this.actividades.update(acts => acts.filter(a => a.id !== actividad.id));
        },
        error: (err: any) => {
          console.error('Error al eliminar la actividad:', err);
          alert('No se pudo eliminar la actividad. Intenta nuevamente.');
        }
      });
    });
  }

  irAMateria(materiaId: number): void {
    this.router.navigate(['/view-materia', materiaId, 'actividades']);
  }

  recargar(): void {
    this.cargarActividades();
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
}