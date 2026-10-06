import { estaEnVistaMateria } from '../../../shared/utils/navegacion';
import { CommonModule } from '@angular/common';
import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ActividadesService } from '../../../services/actividades.service';
import { Actividad } from '../../../model/actividad-model';

@Component({
  selector: 'app-actividad-detalle',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './actividad-detalle.html',
})
export class ActividadDetalleComponent implements OnInit {
  private actividadesService = inject(ActividadesService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // Se calcula una sola vez: el componente se recrea en cada navegación.
  protected readonly enMateria = estaEnVistaMateria(this.router.url);

  actividad = signal<Actividad | null>(null);
  cargando = signal(false);
  error = signal<string | null>(null);
  materiaId = signal<number | null>(null);

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.cargarActividad(Number(id));
      }
    });

    this.route.parent?.paramMap.subscribe(params => {
      const matId = params.get('id');
      if (matId) {
        this.materiaId.set(Number(matId));
      }
    });
  }

  private cargarActividad(id: number): void {
    this.cargando.set(true);
    this.actividadesService.getActividadById(id).subscribe({
      next: (data) => {
        this.actividad.set(data);
        if (data.materia) {
          const mat = typeof data.materia === 'object' ? (data.materia as any).id : data.materia;
          this.materiaId.set(mat);
        }
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error cargando detalle:', err);
        this.error.set('No se pudo cargar la información de la actividad.');
        this.cargando.set(false);
      }
    });
  }

  volver(): void {
    const matId = this.materiaId();
    if (matId) {
      this.router.navigate(['/view-materia', matId, 'actividades']);
    } else {
      this.router.navigate(['/dashboard/actividades']);
    }
  }
}