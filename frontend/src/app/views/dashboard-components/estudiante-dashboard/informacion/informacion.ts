import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ActividadesService } from '../../../../services/actividades.service';
import { AuthService } from '../../../../core/auth/auth.service';

export interface MateriaPendienteResumen {
  materiaId: number | string;
  nombreMateria: string;
  cantidad: number;
}

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
  private readonly router = inject(Router);

  actividadesPendientes = signal<number>(0);
  cargando = signal<boolean>(true);

  mostrarModal = signal<boolean>(false);
  materiasPendientes = signal<MateriaPendienteResumen[]>([]);

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

    forkJoin({
      actividades: this.actividadesService.getActividades(),
      entregas: this.actividadesService.getMisEntregas(),
    }).subscribe({
      next: ({ actividades, entregas }) => {

        const idsActividadesEntregadas = new Set(
          entregas.map((e: any) => e.actividad?.id || e.actividadId || e.id)
        );

        const pendientes = actividades.filter(
          (actividad: any) => !idsActividadesEntregadas.has(actividad.id)
        );

        this.actividadesPendientes.set(pendientes.length);
        this.agruparPendientesPorMateria(pendientes);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error al calcular actividades pendientes:', err);
        this.cargando.set(false);
      },
    });
  }

  private agruparPendientesPorMateria(actividades: any[]): void {
    const resumenMap = new Map<string | number, MateriaPendienteResumen>();

    for (const act of actividades) {
      const materiaId = act.materia;
      const nombreMateria = act.materia_titulo;

      if (!materiaId) continue;

      if (resumenMap.has(materiaId)) {
        resumenMap.get(materiaId)!.cantidad += 1;
      } else {
        resumenMap.set(materiaId, {
          materiaId,
          nombreMateria,
          cantidad: 1,
        });
      }
    }

    this.materiasPendientes.set(Array.from(resumenMap.values()));
  }

  // --- MÉTODOS DEL MODAL Y NAVEGACIÓN ---

  abrirModal(): void {
    if (this.actividadesPendientes() > 0) {
      this.mostrarModal.set(true);
    }
  }

  cerrarModal(): void {
    this.mostrarModal.set(false);
  }

  irAActividadesMateria(materiaId: string | number): void {
    this.cerrarModal();
    this.router.navigate([`/view-materia/${materiaId}/estudiante/actividades`]);
  }
}