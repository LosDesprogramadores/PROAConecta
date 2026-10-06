import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject } from 'rxjs';

import { AuthService } from '../core/auth/auth.service';
import { Mensaje, MensajeLeido } from '../model/mensaje.model';
import { MensajesService } from './mensajes.service';
import { NotificacionSocketService } from './notificacion-socket.service';
import { ToastService } from './toast.service';

const TAMANO_DESPLEGABLE = 5;

/**
 * Shared state of the messages icon: last five received, unread counter and live events.
 * `mensaje.nuevo` goes to the recipient; `mensaje.leido` goes to the sender (its read receipt).
 */
@Injectable({ providedIn: 'root' })
export class MensajesEstadoService {
  private readonly api = inject(MensajesService);
  private readonly socket = inject(NotificacionSocketService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly nuevosSubject = new Subject<Mensaje>();
  private readonly leidosSubject = new Subject<MensajeLeido>();
  private escuchando = false;

  readonly ultimos = signal<Mensaje[]>([]);
  readonly noLeidos = signal(0);
  readonly cargando = signal(false);
  readonly error = signal(false);

  constructor() {
    effect(() => {
      if (!this.auth.token()) {
        untracked(() => {
          this.ultimos.set([]);
          this.noLeidos.set(0);
        });
      }
    });
  }

  nuevos(): Observable<Mensaje> {
    return this.nuevosSubject.asObservable();
  }

  /** Read receipts of messages the user sent. */
  leidos(): Observable<MensajeLeido> {
    return this.leidosSubject.asObservable();
  }

  iniciar(): void {
    this.cargar();
    if (this.escuchando) {
      return;
    }
    this.escuchando = true;
    this.socket
      .eventos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((evento) => {
        if (evento.tipo === 'mensaje.nuevo') {
          this.registrarNuevo(evento.datos as Mensaje);
        } else if (evento.tipo === 'mensaje.leido') {
          this.leidosSubject.next(evento.datos as MensajeLeido);
        }
      });
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(false);
    this.api.obtenerMensajes({ bandeja: 'recibidos', page: 1, page_size: TAMANO_DESPLEGABLE }).subscribe({
      next: (respuesta) => {
        this.ultimos.set(respuesta.results);
        this.noLeidos.set(respuesta.no_leidos);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
      },
    });
  }

  /** The inbox screen keeps the counter in sync with what the server reports. */
  sincronizarContador(noLeidos: number): void {
    this.noLeidos.set(noLeidos);
  }

  registrarNuevo(mensaje: Mensaje): void {
    if (this.ultimos().some((m) => m.id === mensaje.id)) {
      return;
    }
    this.ultimos.update((lista) => [mensaje, ...lista].slice(0, TAMANO_DESPLEGABLE));
    if (!mensaje.leido) {
      this.noLeidos.update((n) => n + 1);
    }
    this.toast.info(`${mensaje.remitente.nombre_completo ?? 'Nuevo mensaje'}: ${mensaje.asunto}`, 'Nuevo mensaje');
    this.nuevosSubject.next(mensaje);
  }

  /** Cold and optimistic: the counter drops on subscribe and is restored if the server refuses. */
  marcarLeido(mensaje: Mensaje): Observable<void> {
    return new Observable<void>((suscriptor) => {
      if (mensaje.leido) {
        suscriptor.next();
        suscriptor.complete();
        return undefined;
      }
      this.aplicar(mensaje.id, true);
      const sub = this.api.marcarLeido(mensaje.id).subscribe({
        next: () => {
          suscriptor.next();
          suscriptor.complete();
        },
        error: (err) => {
          this.aplicar(mensaje.id, false);
          suscriptor.error(err);
        },
      });
      return () => sub.unsubscribe();
    });
  }

  private aplicar(id: string, leido: boolean): void {
    this.ultimos.update((lista) => lista.map((m) => (m.id === id ? { ...m, leido } : m)));
    this.noLeidos.update((n) => Math.max(0, n + (leido ? -1 : 1)));
  }
}
