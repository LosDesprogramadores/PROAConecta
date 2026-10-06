import { estaEnVistaMateria } from '../../../shared/utils/navegacion';
import { CommonModule } from '@angular/common';
import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ActividadesService, Entrega } from '../../../services/actividades.service'; // ajustá la ruta
import { ToastService } from '../../../services/toast.service';
import { Modal } from '../../../shared/modal/modal';
import { NOTA_MAXIMA, NOTA_MINIMA, NOTA_PASO, validarNota } from '../../../shared/utils/notas';
import { ArchivoProtegidoDirective } from '../../../core/http/archivo-protegido.directive';

@Component({
  selector: 'app-actividad-entregas',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, Modal, ArchivoProtegidoDirective],
  templateUrl: './actividad-entregas.html',
})
export class ActividadEntregasComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private actividadesService = inject(ActividadesService);
  private toastService = inject(ToastService);

  // Se calcula una sola vez: el componente se recrea en cada navegación.
  protected readonly enMateria = estaEnVistaMateria(this.router.url);

  materiaId = signal<number | null>(null);
  actividadId = signal<number | null>(null);

  entregas = signal<Entrega[]>([]);
  cargando = signal(false);
  errorCarga = signal('');

  protected readonly notaMinima = NOTA_MINIMA;
  protected readonly notaMaxima = NOTA_MAXIMA;
  protected readonly notaPaso = NOTA_PASO;

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

    const errorNota = validarNota(nota);
    if (errorNota || nota === null) {
      this.errorModal.set(errorNota ?? 'Ingrese una nota.');
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
        error: (err) => {
          this.errorModal.set(this.toastService.readable_message_extraction(err));
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