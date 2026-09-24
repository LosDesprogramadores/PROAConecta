import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ActividadesService } from '../../../services/actividades.service';
import { UserRole } from '../../../core/auth/auth.model';

export interface ActividadDashboard {
  id: number;
  titulo: string;
  descripcion: string;
  materia: string;
  materiaId?: number;
  fechaLimite: string;
  estado: 'activa' | 'cerrada' | 'vencida';
  fechaCreacion?: string;
}

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

  esEstudiante = computed(() =>
    this.currentUser()?.rolId === UserRole.ESTUDIANTE
  );

  esDocente = computed(() =>
    this.currentUser()?.rolId === UserRole.DOCENTE
  );

  // Señales
  actividades = signal<ActividadDashboard[]>([]);
  cargando = signal(false);
  error = signal<string | null>(null);

  // Computed para estados
  actividadesActivas = computed(() =>
    this.actividades().filter(a => a.estado === 'activa')
  );

  actividadesVencidas = computed(() =>
    this.actividades().filter(a => a.estado === 'vencida')
  );

  actividadesCerradas = computed(() =>
    this.actividades().filter(a => a.estado === 'cerrada')
  );

  // Filtro actual
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
    this.loadActividades();
  }

  private loadActividades(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.actividadesService.getActividades().subscribe({
      next: (data: any[]) => {
        // Mapear datos de la API al modelo local
        const actividadesFormateadas: ActividadDashboard[] = data.map(a => ({
          id: a.id,
          titulo: a.titulo || a.title,
          descripcion: a.descripcion || a.description,
          materia: a.materia?.titulo || a.materia_titulo || 'Sin materia',
          materiaId: a.materia?.id || a.materia_id,
          fechaLimite: a.fecha_limite || a.fechaLimite || 'Sin fecha',
          estado: this.determinarEstado(a.fecha_limite || a.fechaLimite),
          fechaCreacion: a.fecha_creacion || a.fechaCreacion,
        }));

        this.actividades.set(actividadesFormateadas);
        this.cargando.set(false);
      },

      error: (err) => {
        console.error('Error cargando actividades:', err);
        this.error.set('No se pudieron cargar las actividades. Intenta más tarde.');
        this.cargando.set(false);
      },
    });
  }

  private determinarEstado(fechaLimite: string): 'activa' | 'cerrada' | 'vencida' {
    if (!fechaLimite) return 'activa';
    
    const fecha = new Date(fechaLimite);
    const hoy = new Date();
    
    // Si la fecha es menor a hoy, está vencida
    if (fecha < hoy) return 'vencida';
    
    // Por defecto activa
    return 'activa';
  }

  setFiltro(filtro: 'todas' | 'activas' | 'vencidas' | 'cerradas'): void {
    this.filtroActual.set(filtro);
  }

  nuevaActividad(): void {
    // Redirigir a crear nueva actividad (o abrir modal)
    console.log('Crear nueva actividad');
    // this.router.navigate(['/dashboard/actividades/nueva']);
  }

  verActividad(actividad: ActividadDashboard): void {
    console.log('Ver actividad:', actividad);
    // Redirigir a la vista de actividad
    // this.router.navigate(['/dashboard/actividades', actividad.id]);
  }

  entrarAMateria(materiaId?: number): void {
    if (materiaId) {
      this.router.navigate(['/view-materia', materiaId, 'actividades']);
    }
  }

  recargar(): void {
    this.loadActividades();
  }
}