import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { UserRole } from '../../core/auth/auth.model';
import { IMateria } from '../../model/materia.model';
import { Bandeja, Mensaje, VENTANA_BORRADO_MS } from '../../model/mensaje.model';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { MateriaService } from '../../services/materia.service';
import { MensajesEstadoService } from '../../services/mensajes-estado.service';
import { MensajesService } from '../../services/mensajes.service';
import { ToastService } from '../../services/toast.service';
import { Paginador } from '../../shared/paginador/paginador';
import { MensajeForm } from './mensaje-form/mensaje-form';

const TAMANO_PAGINA = 10;

@Component({
  selector: 'app-mensajes',
  standalone: true,
  imports: [CommonModule, Paginador, MensajeForm],
  templateUrl: './mensajes.html',
})
export class MensajesComponent implements OnInit {
  /** Request in flight: a newer one cancels it so a stale answer never overwrites the tray. */
  private peticion: Subscription | null = null;
  /** Ticks every 30 s so the "Eliminar" button disappears when the 15-minute window ends. */
  private readonly ahora = signal(Date.now());

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly api = inject(MensajesService);
  private readonly estado = inject(MensajesEstadoService);
  private readonly materiaService = inject(MateriaService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tamanoPagina = TAMANO_PAGINA;
  readonly bandeja = signal<Bandeja>('recibidos');
  readonly mensajes = signal<Mensaje[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(1);
  readonly cargando = signal(true);
  readonly error = signal(false);
  readonly seleccionado = signal<Mensaje | null>(null);
  readonly materias = signal<IMateria[]>([]);
  readonly materiaFiltro = signal<number | null>(null);
  readonly formularioAbierto = signal(false);
  readonly noLeidos = this.estado.noLeidos;

  readonly nombreMateriaFiltro = computed(
    () => this.materias().find((m) => m.id === this.materiaFiltro())?.titulo ?? null,
  );
  readonly puedeEliminar = computed(() => {
    const m = this.seleccionado();
    return !!m && this.bandeja() === 'enviados' && this.ahora() - Date.parse(m.fecha_creacion) < VENTANA_BORRADO_MS;
  });

  ngOnInit(): void {
    this.cargarMaterias();
    // `?materia=<id>` (from the subject menu) filters the inbox by that subject.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = Number(params.get('materia'));
      this.materiaFiltro.set(Number.isInteger(id) && id > 0 ? id : null);
      this.cargar(1);
    });
    this.escucharEventos();
    const reloj = setInterval(() => this.refrescarReloj(), 30_000);
    this.destroyRef.onDestroy(() => {
      clearInterval(reloj);
      this.peticion?.unsubscribe();
    });
  }

  /** Called by the 30 s tick; it re-evaluates `puedeEliminar`. */
  refrescarReloj(): void {
    this.ahora.set(Date.now());
  }

  cambiarBandeja(bandeja: Bandeja): void {
    if (bandeja !== this.bandeja()) {
      this.bandeja.set(bandeja);
      this.cargar(1);
    }
  }

  cargar(pagina: number): void {
    this.cargando.set(true);
    this.error.set(false);
    this.seleccionado.set(null);
    this.peticion?.unsubscribe();
    this.peticion = this.api
      .obtenerMensajes({
        bandeja: this.bandeja(),
        page: pagina,
        page_size: TAMANO_PAGINA,
        materia: this.materiaFiltro() ?? undefined,
      })
      .subscribe({
        next: (respuesta) => {
          this.mensajes.set(respuesta.results);
          this.total.set(respuesta.count);
          this.pagina.set(pagina);
          this.estado.sincronizarContador(respuesta.no_leidos);
          this.cargando.set(false);
        },
        error: () => {
          this.error.set(true);
          this.cargando.set(false);
        },
      });
  }

  seleccionar(mensaje: Mensaje): void {
    this.seleccionado.set(mensaje);
    if (this.bandeja() === 'recibidos' && !mensaje.leido) {
      this.actualizarLocal(mensaje.id, { leido: true });
      this.estado.marcarLeido(mensaje).subscribe({
        error: () => this.actualizarLocal(mensaje.id, { leido: false }),
      });
    }
  }

  eliminarSeleccionado(): void {
    const mensaje = this.seleccionado();
    if (!mensaje) {
      return;
    }
    // The button can outlive the window by up to 30 s: check again at click time.
    if (Date.now() - Date.parse(mensaje.fecha_creacion) >= VENTANA_BORRADO_MS) {
      this.ahora.set(Date.now());
      this.toast.error('Ya pasaron 15 minutos: el mensaje no se puede eliminar.');
      return;
    }
    this.confirmDialog
      .confirmar({
        titulo: 'Eliminar mensaje',
        mensaje: `¿Eliminar el mensaje "${mensaje.asunto}"? Solo puedes hacerlo durante los primeros 15 minutos.`,
        textoConfirmar: 'Eliminar',
      })
      .subscribe((confirmado) => confirmado && this.eliminar(mensaje));
  }

  alEnviar(mensaje: Mensaje): void {
    this.formularioAbierto.set(false);
    if (this.bandeja() === 'enviados' && this.pagina() === 1 && this.coincideConFiltro(mensaje)) {
      this.mensajes.update((lista) => [mensaje, ...lista].slice(0, TAMANO_PAGINA));
      this.total.update((n) => n + 1);
    }
  }

  quitarFiltroMateria(): void {
    // The query param drives the filter: removing it reloads the inbox through the subscription.
    this.router.navigate([], { relativeTo: this.route, queryParams: { materia: null }, queryParamsHandling: 'merge' });
  }

  contraparte(mensaje: Mensaje): string {
    const persona = this.bandeja() === 'recibidos' ? mensaje.remitente : mensaje.destinatario;
    return persona.nombre_completo ?? 'Usuario';
  }

  private eliminar(mensaje: Mensaje): void {
    this.api.eliminarMensaje(mensaje.id).subscribe({
      next: () => {
        this.mensajes.update((lista) => lista.filter((m) => m.id !== mensaje.id));
        this.total.update((n) => Math.max(0, n - 1));
        this.seleccionado.set(null);
        this.toast.success('El mensaje se eliminó.');
      },
      error: (err) => this.toast.error(this.toast.readable_message_extraction(err), 'No se pudo eliminar el mensaje'),
    });
  }

  private cargarMaterias(): void {
    const persona = this.auth.currentUser()?.persona;
    const rol = this.auth.currentUser()?.rolId;
    if (!persona) {
      return;
    }
    const consulta =
      rol === UserRole.DOCENTE
        ? this.materiaService.obtenerMateriasPorProfesor(persona.id)
        : this.materiaService.obteberMateriasPorEstudiante(persona.id);
    consulta.subscribe({
      next: (lista) => this.materias.set(lista),
      error: (err) => this.toast.error(this.toast.readable_message_extraction(err), 'No se pudieron cargar las materias'),
    });
  }

  private escucharEventos(): void {
    this.estado
      .nuevos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((mensaje) => {
        if (this.bandeja() !== 'recibidos' || !this.coincideConFiltro(mensaje)) {
          return;
        }
        // An event that overlaps a refetch must not be counted twice.
        if (this.mensajes().some((m) => m.id === mensaje.id)) {
          return;
        }
        this.total.update((n) => n + 1);
        if (this.pagina() === 1) {
          this.mensajes.update((lista) => [mensaje, ...lista].slice(0, TAMANO_PAGINA));
        }
      });
    // Read receipt: the recipient opened a message I sent.
    this.estado
      .leidos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((evento) => this.actualizarLocal(evento.id, { leido: true }));
  }

  private coincideConFiltro(mensaje: Mensaje): boolean {
    const filtro = this.materiaFiltro();
    return filtro === null || mensaje.materia.id === filtro;
  }

  private actualizarLocal(id: string, cambios: Partial<Mensaje>): void {
    this.mensajes.update((lista) => lista.map((m) => (m.id === id ? { ...m, ...cambios } : m)));
    const actual = this.seleccionado();
    if (actual?.id === id) {
      this.seleccionado.set({ ...actual, ...cambios });
    }
  }
}
