import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { ActividadesService, Entrega } from '../../../services/actividades.service';
import { ToastService } from '../../../services/toast.service';
import { ESTADOS_SEGUIMIENTO, FilaSeguimiento, Seguimiento } from '../../../model/seguimiento.model';
import { Modal } from '../../../shared/modal/modal';
import { NOTA_MAXIMA, NOTA_MINIMA, NOTA_PASO, validarNota } from '../../../shared/utils/notas';
import { ArchivoProtegidoDirective } from '../../../core/http/archivo-protegido.directive';

@Component({
  selector: 'app-actividad-entregas',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, Modal, ArchivoProtegidoDirective],
  templateUrl: './actividad-entregas.html',
})
export class ActividadEntregasComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private actividadesService = inject(ActividadesService);
  private toastService = inject(ToastService);

  actividadId = signal<number | null>(null);

  seguimiento = signal<Seguimiento | null>(null);
  /** Delivery content (file, link, text) by delivery id; the follow-up only carries the status. */
  private entregasPorId = signal<ReadonlyMap<number, Entrega>>(new Map());
  cargando = signal(false);
  /** Blocking error: only for the initial load, when there is no list to show. */
  errorCarga = signal('');
  /** A reload failed but the previous list is still on screen. */
  errorRecarga = signal(false);
  /** The delivery content (file, link, text) could not be loaded. */
  errorEntregas = signal(false);

  protected readonly estados = ESTADOS_SEGUIMIENTO;
  protected readonly notaMinima = NOTA_MINIMA;
  protected readonly notaMaxima = NOTA_MAXIMA;
  protected readonly notaPaso = NOTA_PASO;

  readonly filas = computed(() => this.seguimiento()?.estudiantes ?? []);
  readonly resumenItems = computed(() =>
    ESTADOS_SEGUIMIENTO.map((e) => ({ ...e, cantidad: this.seguimiento()?.resumen[e.estado] ?? 0 })),
  );

  // modal de calificación
  filaSeleccionada = signal<FilaSeguimiento | null>(null);
  readonly entregaSeleccionada = computed(() => {
    const entregaId = this.filaSeleccionada()?.entrega_id;
    return entregaId ? (this.entregasPorId().get(entregaId) ?? null) : null;
  });
  readonly calificacion = new FormGroup({
    nota: new FormControl<number | null>(null),
    comentario: new FormControl('', { nonNullable: true }),
  });
  guardando = signal(false);
  errorModal = signal('');

  ngOnInit(): void {
    const p = this.route.snapshot.paramMap;
    const desdeParam = p.get('actividadId') ?? p.get('id');
    const desdeUrl = this.router.url.match(/actividades\/(\d+)\/entregas/)?.[1];
    const id = Number(desdeParam ?? desdeUrl);

    if (!Number.isNaN(id) && id > 0) {
      this.actividadId.set(id);
      this.cargar(id);
    } else {
      this.errorCarga.set('No se pudo identificar la actividad.');
    }
  }

  estadoDe(fila: FilaSeguimiento) {
    return ESTADOS_SEGUIMIENTO.find((e) => e.estado === fila.estado);
  }

  /** Loads (or reloads after grading) the follow-up and the delivery content. */
  cargar(actividadId: number): void {
    // Only the first load blanks the screen; a refresh after grading keeps the list in place.
    const primeraCarga = this.seguimiento() === null;
    this.cargando.set(primeraCarga);
    this.errorCarga.set('');
    this.errorRecarga.set(false);
    forkJoin({
      seguimiento: this.actividadesService.getSeguimiento(actividadId),
      // The content of the deliveries is a nicety: if it fails the list is still usable.
      entregas: this.actividadesService.getEntregas(actividadId).pipe(
        map((entregas) => ({ entregas, fallo: false })),
        catchError(() => of({ entregas: null, fallo: true })),
      ),
    }).subscribe({
      next: ({ seguimiento, entregas }) => {
        this.seguimiento.set(seguimiento);
        this.errorEntregas.set(entregas.fallo);
        if (entregas.entregas) {
          this.entregasPorId.set(new Map(entregas.entregas.map((e) => [e.id, e])));
        }
        this.cargando.set(false);
      },
      error: (err) => {
        const mensaje = this.toastService.readable_message_extraction(err);
        if (primeraCarga) {
          this.errorCarga.set(mensaje);
        } else {
          // The stale list stays visible; tell the user it may be out of date.
          this.errorRecarga.set(true);
          this.toastService.error(mensaje);
        }
        this.cargando.set(false);
      },
    });
  }

  reintentar(): void {
    const id = this.actividadId();
    if (id) this.cargar(id);
  }

  abrirModal(fila: FilaSeguimiento): void {
    this.filaSeleccionada.set(fila);
    this.calificacion.reset({
      nota: fila.nota ? Number(fila.nota.calificacion) : null,
      comentario: fila.nota?.descripcion ?? '',
    });
    this.errorModal.set('');
  }

  cerrarModal(): void {
    this.filaSeleccionada.set(null);
  }

  guardar(): void {
    const fila = this.filaSeleccionada();
    const actividadId = this.actividadId();
    const { nota, comentario } = this.calificacion.getRawValue();
    if (!fila || !actividadId) return;

    const errorNota = validarNota(nota);
    if (errorNota || nota === null) {
      this.errorModal.set(errorNota ?? 'Ingrese una nota.');
      return;
    }

    this.guardando.set(true);
    this.errorModal.set('');

    // Also works for a student without delivery: the server creates the administrative delivery.
    this.actividadesService
      .calificarEstudianteEnActividad(actividadId, {
        estudiante_id: fila.estudiante_id,
        calificacion: nota,
        descripcion: comentario,
        comentario,
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.cerrarModal();
          // recargamos desde el servidor: lo que se ve es lo que quedó guardado
          this.cargar(actividadId);
        },
        error: (err) => {
          this.errorModal.set(this.toastService.readable_message_extraction(err));
          this.guardando.set(false);
        },
      });
  }
}
