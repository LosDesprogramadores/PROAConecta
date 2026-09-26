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

  private estaVencida(fechaLimite: string): boolean {
    return new Date(fechaLimite) < new Date();
  }

  actividadesPendientes = computed(() =>
    this.actividades().filter(a => a.fecha_baja === null && !this.estaVencida(a.fecha_limite))
  );

  actividadesEntregadas = computed(() =>
    this.actividades().filter(a => a.fecha_baja !== null || this.estaVencida(a.fecha_limite))
  );

  ngOnInit(): void {
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

    this.actividadesService.getActividadesPorMateria(materiaId).subscribe({
      next: (data: Actividad[]) => {
        this.actividades.set(data);
        
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
    const id = this.materiaId();
    this.router.navigate(['/dashboard/actividades/nueva'], {
      queryParams: { materiaId: id }
    });
  }

  verActividad(actividad: Actividad): void {
    this.router.navigate(['/dashboard/actividades', actividad.id]);
  }

  gestionarActividad(actividad: Actividad): void {
    this.router.navigate(['/dashboard/actividades/editar', actividad.id]);
  }

  entrarActividad(actividad: Actividad): void {
    this.router.navigate(['/dashboard/actividades', actividad.id, 'entregar']);
  }

  recargar(): void {
    const id = this.materiaId();
    if (id) {
      this.cargarActividades(id);
    }
  }
}