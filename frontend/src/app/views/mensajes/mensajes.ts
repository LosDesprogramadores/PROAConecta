import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription, catchError, forkJoin, of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { UserRole } from '../../core/auth/auth.model';
import { IMateria } from '../../model/materia.model';
import { Bandeja, MAX_CUERPO, Mensaje, PersonaMensaje, VENTANA_BORRADO_MS, asuntoRespuesta } from '../../model/mensaje.model';
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
  imports: [CommonModule, ReactiveFormsModule, Paginador, MensajeForm],
  templateUrl: './mensajes.html',
})
export class MensajesComponent implements OnInit {
  /** Request in flight: a newer one cancels it so a stale answer never overwrites the tray. */
  private peticion: Subscription | null = null;
  /** Thread request in flight: opening another message cancels it. */
  private peticionHilo: Subscription | null = null;
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
  /** Message being answered through the "Responder" form (subject and recipient fixed). */
  readonly respondiendoA = signal<Mensaje | null>(null);
  readonly hilo = signal<Mensaje[]>([]);
  readonly cargandoHilo = signal(false);
  readonly errorHilo = signal(false);
  readonly enviandoRespuesta = signal(false);
  /** Server notice when the counterpart cannot receive messages anymore: the inline reply stays disabled. */
  readonly respuestaBloqueada = signal<string | null>(null);
  readonly maxCuerpo = MAX_CUERPO;
  readonly respuesta = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(MAX_CUERPO)],
  });
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
      this.peticionHilo?.unsubscribe();
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
    this.limpiarHilo();
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
    this.abrirHilo(mensaje);
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

  responder(mensaje: Mensaje): void {
    this.respondiendoA.set(mensaje);
  }

  asuntoDeRespuesta(mensaje: Mensaje): string {
    return asuntoRespuesta(mensaje.asunto);
  }

  /** Inline reply of the open thread: same endpoint and rules as the form. */
  responderEnHilo(): void {
    const abierto = this.seleccionado();
    const cuerpo = this.respuesta.value.trim();
    if (!abierto || this.respuesta.disabled || this.enviandoRespuesta() || !cuerpo || this.respuesta.invalid) {
      return;
    }
    this.enviandoRespuesta.set(true);
    this.api
      .enviarMensaje({
        materia_id: abierto.materia.id,
        destinatario_id: this.otraPersona(abierto).id,
        asunto: asuntoRespuesta(abierto.asunto),
        cuerpo,
      })
      .subscribe({
        next: (enviado) => {
          this.enviandoRespuesta.set(false);
          this.respuesta.reset('');
          this.registrarEnviado(enviado);
        },
        error: (err: HttpErrorResponse) => {
          this.enviandoRespuesta.set(false);
          const texto = this.toast.readable_message_extraction(err);
          if (err.status === 403 || err.status === 404) {
            // The counterpart (or the subject) left: the thread stays readable but closed to replies.
            this.respuestaBloqueada.set(texto);
            this.respuesta.disable();
          } else {
            this.toast.error(texto, 'No se pudo enviar el mensaje');
          }
        },
      });
  }

  esMio(mensaje: Mensaje): boolean {
    const abierto = this.seleccionado();
    return !!abierto && mensaje.remitente.id !== this.otraPersona(abierto).id;
  }

  alEnviar(mensaje: Mensaje): void {
    this.formularioAbierto.set(false);
    this.respondiendoA.set(null);
    this.registrarEnviado(mensaje);
  }

  private registrarEnviado(mensaje: Mensaje): void {
    if (this.perteneceAlHilo(mensaje)) {
      this.agregarAlHilo(mensaje);
    }
    if (this.bandeja() === 'enviados' && this.pagina() === 1 && this.coincideConFiltro(mensaje)) {
      this.mensajes.update((lista) => [mensaje, ...lista].slice(0, TAMANO_PAGINA));
      this.total.update((n) => n + 1);
    }
  }

  /** The other participant of the open message, from the point of view of the current tray. */
  private otraPersona(mensaje: Mensaje): PersonaMensaje {
    return this.bandeja() === 'recibidos' ? mensaje.remitente : mensaje.destinatario;
  }

  private abrirHilo(mensaje: Mensaje): void {
    this.peticionHilo?.unsubscribe();
    // The selected message is shown at once; the server thread replaces it when it arrives.
    this.hilo.set([mensaje]);
    this.cargandoHilo.set(true);
    this.errorHilo.set(false);
    this.respuestaBloqueada.set(null);
    this.respuesta.enable();
    this.respuesta.reset('');
    this.peticionHilo = this.api.obtenerConversacion(mensaje.materia.id, this.otraPersona(mensaje).id).subscribe({
      next: (lista) => {
        this.hilo.set(lista.length > 0 ? lista : [mensaje]);
        this.cargandoHilo.set(false);
        this.marcarEntrantesComoLeidos(mensaje);
      },
      error: () => {
        this.errorHilo.set(true);
        this.cargandoHilo.set(false);
      },
    });
  }

  /** The user sees the whole thread: every unread message received in it counts as read (the bell drops). */
  private marcarEntrantesComoLeidos(abierto: Mensaje): void {
    const otra = this.otraPersona(abierto).id;
    // The opened message is already handled by `seleccionar`
    const pendientes = this.hilo().filter((m) => m.remitente.id === otra && !m.leido && m.id !== abierto.id);
    if (pendientes.length === 0) {
      return;
    }
    pendientes.forEach((m) => this.actualizarLocal(m.id, { leido: true }));
    forkJoin(
      pendientes.map((m) =>
        this.estado.marcarLeido(m).pipe(
          catchError(() => {
            this.actualizarLocal(m.id, { leido: false });
            return of(undefined);
          }),
        ),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  private limpiarHilo(): void {
    this.peticionHilo?.unsubscribe();
    this.seleccionado.set(null);
    this.hilo.set([]);
    this.cargandoHilo.set(false);
    this.errorHilo.set(false);
  }

  private perteneceAlHilo(mensaje: Mensaje): boolean {
    const abierto = this.seleccionado();
    if (!abierto || mensaje.materia.id !== abierto.materia.id) {
      return false;
    }
    const otra = this.otraPersona(abierto).id;
    return mensaje.remitente.id === otra || mensaje.destinatario.id === otra;
  }

  private agregarAlHilo(mensaje: Mensaje): void {
    // A live event can overlap the thread request or the answer of a send: dedupe by id.
    if (!this.hilo().some((m) => m.id === mensaje.id)) {
      this.hilo.update((lista) => [...lista, mensaje]);
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
        this.limpiarHilo();
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
        this.agregarMensajeVivoAlHilo(mensaje);
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

  /** A live message from the person of the open thread is appended and, since the user sees it, marked as read. */
  private agregarMensajeVivoAlHilo(mensaje: Mensaje): void {
    const abierto = this.seleccionado();
    if (!abierto || !this.perteneceAlHilo(mensaje)) {
      return;
    }
    if (this.hilo().some((m) => m.id === mensaje.id)) {
      return;
    }
    const entrante = mensaje.remitente.id === this.otraPersona(abierto).id;
    this.agregarAlHilo(entrante ? { ...mensaje, leido: true } : mensaje);
    if (entrante && !mensaje.leido) {
      this.estado.marcarLeido(mensaje).subscribe({ error: () => undefined });
    }
  }

  private coincideConFiltro(mensaje: Mensaje): boolean {
    const filtro = this.materiaFiltro();
    return filtro === null || mensaje.materia.id === filtro;
  }

  private actualizarLocal(id: string, cambios: Partial<Mensaje>): void {
    this.mensajes.update((lista) => lista.map((m) => (m.id === id ? { ...m, ...cambios } : m)));
    this.hilo.update((lista) => lista.map((m) => (m.id === id ? { ...m, ...cambios } : m)));
    const actual = this.seleccionado();
    if (actual?.id === id) {
      this.seleccionado.set({ ...actual, ...cambios });
    }
  }
}
