import { Component, inject, OnInit, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ActividadesService } from '../../../../services/actividades.service';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-informacion',
  standalone: true,
  imports: [],
  templateUrl: './informacion.html',
  styleUrl: './informacion.css',
})
export class Informacion implements OnInit {
  private readonly actividadesService = inject(ActividadesService);
  private readonly authServices = inject(AuthService);

  actividadesPendientes = signal<number>(0);
  cargando = signal<boolean>(true);

  ngOnInit(): void {
    this.cargarInformacion();
  }

  private cargarInformacion(): void {
    const usuarioId = this.authServices.getCurrentUser()?.id;

    if (!usuarioId) {
      this.cargando.set(false);
      return;
    }

    this.cargando.set(true);

    // Consultamos en paralelo las actividades asignadas y las entregas realizadas por el alumno
    forkJoin({
      actividades: this.actividadesService.getActividades(),
      entregas: this.actividadesService.getMisEntregas()
    }).subscribe({
      next: ({ actividades, entregas }) => {
        // Obtenemos los IDs de las actividades que ya fueron entregadas
        const idsActividadesEntregadas = new Set(entregas.map((e: any) => e.id));

        // Filtramos las actividades cuyo ID no esté en el set de entregadas
        const pendientes = actividades.filter(
          (actividad: any) => !idsActividadesEntregadas.has(actividad.id)
        );

        this.actividadesPendientes.set(pendientes.length);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al calcular actividades pendientes:', err);
        this.cargando.set(false);
      }
    });
  }
}