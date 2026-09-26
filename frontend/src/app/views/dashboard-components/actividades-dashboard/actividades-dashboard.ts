import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ActividadesService } from '../../../services/actividades.service';
import { Actividad } from '../../../model/actividad-model';
import { UserRole } from '../../../core/auth/auth.model';

@Component({
  selector: 'app-actividades-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './actividades-dashboard.html',
  styleUrl: './actividades-dashboard.css',
})
export class ActividadesDashboard implements OnInit {
  private authService = inject(AuthService);
  private actividadesService = inject(ActividadesService);
  private router = inject(Router);

  currentUser = this.authService.currentUser;

  esDocente = computed(() =>
    this.currentUser()?.rolId === UserRole.DOCENTE
  );

  // Señales
  actividades = signal<Actividad[]>([]);
  cargando = signal(false);
  error = signal<string | null>(null);

  // Helper para determinar si está vencida
  private estaVencida(fechaLimite: string): boolean {
    return new Date(fechaLimite) < new Date();
  }

  // Computed para estados usando 'PUBLICADA'
  actividadesPublicadas = computed(() =>
    this.actividades().filter(a => a.estado === 'PUBLICADA')
  );

  actividadesActivas = computed(() =>
    this.actividadesPublicadas().filter(a => a.fecha_baja === null && !this.estaVencida(a.fecha_limite))
  );

  actividadesVencidas = computed(() =>
    this.actividadesPublicadas().filter(a => a.fecha_baja === null && this.estaVencida(a.fecha_limite))
  );

  actividadesCerradas = computed(() =>
    this.actividades().filter(a => a.fecha_baja !== null)
  );

  // Filtro
  filtroActual = signal<'todas' | 'activas' | 'vencidas' | 'cerradas'>('todas');

  actividadesFiltradas = computed(() => {
    const filtro = this.filtroActual();
    const todas = this.actividades();

    switch (filtro) {
      case 'activas':
        return this.actividadesActivas();
      case 'vencidas':
        return this.actividadesVencidas();
      case 'cerradas':
        return this.actividadesCerradas();
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
      error: (err) => {
        console.error('Error cargando actividades:', err);
        this.error.set('No se pudieron cargar las actividades. Intenta más tarde.');
        this.cargando.set(false);
      },
    });
  }

  setFiltro(filtro: 'todas' | 'activas' | 'vencidas' | 'cerradas'): void {
    this.filtroActual.set(filtro);
  }

  nuevaActividad(): void {
    this.router.navigate(['/dashboard/actividades/nueva']);
  }

  verActividad(actividad: Actividad): void {
    this.router.navigate(['/dashboard/actividades', actividad.id]);
  }

  gestionarActividad(actividad: Actividad): void {
    this.router.navigate(['/dashboard/actividades/editar', actividad.id]);
  }

  irAMateria(materiaId: number): void {
    this.router.navigate(['/view-materia', materiaId, 'actividades']);
  }

  recargar(): void {
    this.cargarActividades();
  }
}