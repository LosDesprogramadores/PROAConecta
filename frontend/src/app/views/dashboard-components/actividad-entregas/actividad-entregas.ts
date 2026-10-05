import { estaEnVistaMateria } from '../../../shared/utils/navegacion';
import { CommonModule } from '@angular/common';
import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ActividadesService, Entrega } from '../../../services/actividades.service'; // ajustá la ruta

@Component({
  selector: 'app-actividad-entregas',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './actividad-entregas.html',
})
export class ActividadEntregasComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private actividadesService = inject(ActividadesService);

  // Se calcula una sola vez: el componente se recrea en cada navegación.
  protected readonly enMateria = estaEnVistaMateria(this.router.url);

  materiaId = signal<number | null>(null);
  actividadId = signal<number | null>(null);

  entregas = signal<Entrega[]>([]);
  cargando = signal(false);
  errorCarga = signal('');

  // modal de calificación
  entregaSeleccionada = signal<Entrega | null>(null);
  nota = signal<number | null>(null);
  comentario = signal('');
  guardando = signal(false);
  errorModal = signal('');

  ngOnInit(): void {
    this.route.parent?.paramMap.subscribe(params => {
      const matId = params.get('id');
      if (matId) {
        this.materiaId.set(Number(matId));
      }
    });

    const p = this.route.snapshot.paramMap;
    const desdeParam = p.get('actividadId') ?? p.get('id');
    const desdeUrl = this.router.url.match(/actividades\/(\d+)\/entregas/)?.[1];
    const id = Number(desdeParam ?? desdeUrl);

    if (!Number.isNaN(id) && id > 0) {
      this.actividadId.set(id);
      this.cargarEntregas(id);
    } else {
      this.errorCarga.set('No se pudo identificar la actividad.');
    }
  }

  cargarEntregas(actividadId: number): void {
    this.cargando.set(true);
    this.errorCarga.set('');
    this.actividadesService.getEntregas(actividadId).subscribe({
      next: data => {
        this.entregas.set(data);
        this.cargando.set(false);
      },
      error: () => {
        this.errorCarga.set('No se pudieron cargar las entregas.');
        this.cargando.set(false);
      },
    });
  }

  abrirModal(entrega: Entrega): void {
    this.entregaSeleccionada.set(entrega);
    this.nota.set(entrega.nota ? Number(entrega.nota.calificacion) : null);
    this.comentario.set(entrega.nota?.descripcion ?? '');
    this.errorModal.set('');
  }

  cerrarModal(): void {
    this.entregaSeleccionada.set(null);
  }

  guardar(): void {
    const entrega = this.entregaSeleccionada();
    const nota = this.nota();
    if (!entrega) return;

    if (nota === null || Number.isNaN(nota) || nota < 0 || nota > 10) {
      this.errorModal.set('La nota debe estar entre 0 y 10.');
      return;
    }

    this.guardando.set(true);
    this.errorModal.set('');

    this.actividadesService
      .calificarEntregaIndividual(entrega.id, {
        calificacion: nota,
        descripcion: this.comentario(),
        comentario: this.comentario(),
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.cerrarModal();
          // recargamos desde el servidor: lo que se ve es lo que quedó guardado
          const id = this.actividadId();
          if (id) this.cargarEntregas(id);
        },
        error: () => {
          this.errorModal.set('No se pudo guardar la calificación.');
          this.guardando.set(false);
        },
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