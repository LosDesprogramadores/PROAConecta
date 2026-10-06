import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject } from 'rxjs';

import { AuthService } from '../core/auth/auth.service';
import { INotificacion } from '../model/notificacion.model';
import { NotificacionService } from './notificaciones.service';
import { NotificacionSocketService } from './notificacion-socket.service';
import { ToastService } from './toast.service';

const TAMANO_DESPLEGABLE = 5;

/**
 * Shared state of the bell: the last notifications, the unread counter and the live stream.
 * The navbar and the notifications page read and mark through it so both stay in sync.
 */
@Injectable({ providedIn: 'root' })
export class NotificacionesEstadoService {
  private readonly api = inject(NotificacionService);
  private readonly socket = inject(NotificacionSocketService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly nuevasSubject = new Subject<INotificacion>();
  private escuchando = false;

  readonly ultimas = signal<INotificacion[]>([]);
  readonly noLeidas = signal(0);
  readonly cargando = signal(false);
  readonly error = signal(false);

  constructor() {
    // A closed session must not leave the previous user's notifications behind.
    effect(() => {
      if (!this.auth.token()) {
        untracked(() => {
          this.ultimas.set([]);
          this.noLeidas.set(0);
        });
      }
    });
  }

  /** Notifications that arrive live (after the initial load). */
  nuevas(): Observable<INotificacion> {
    return this.nuevasSubject.asObservable();
  }

  /** Loads the last five and the unread counter, and starts listening to live events once. */
  iniciar(): void {
    this.cargar();
    if (this.escuchando) {
      return;
    }
    this.escuchando = true;
    // The server routes events by user and subject group, so no role filtering is needed here.
    this.socket
      .escucharNotificaciones()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((noti) => this.registrarNueva(noti));
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(false);
    this.api.listarPaginado({ page: 1, page_size: TAMANO_DESPLEGABLE }).subscribe({
      next: (respuesta) => {
        this.ultimas.set(respuesta.results);
        this.noLeidas.set(respuesta.no_leidas);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
      },
    });
  }

  registrarNueva(noti: INotificacion): void {
    const id = idDe(noti);
    if (id && this.ultimas().some((n) => idDe(n) === id)) {
      return;
    }
    this.ultimas.update((lista) => [noti, ...lista].slice(0, TAMANO_DESPLEGABLE));
    if (!noti.leida) {
      this.noLeidas.update((n) => n + 1);
    }
    this.toast.info(noti.titulo, 'Nueva notificación');
    this.nuevasSubject.next(noti);
  }

  /**
   * Cold and optimistic: on subscribe the counter drops now and is restored if the server refuses.
   * Emits once when the server confirms; errors are surfaced to the caller after the rollback.
   */
  marcarLeida(noti: INotificacion): Observable<void> {
    const id = idDe(noti);
    return new Observable<void>((suscriptor) => {
      if (!id || noti.leida) {
        suscriptor.next();
        suscriptor.complete();
        return undefined;
      }
      this.aplicarLeida(id);
      const sub = this.api.marcarLeida(id).subscribe({
        next: () => {
          suscriptor.next();
          suscriptor.complete();
        },
        error: (err) => {
          this.revertirLeida(id);
          suscriptor.error(err);
        },
      });
      return () => sub.unsubscribe();
    });
  }

  private aplicarLeida(id: string): void {
    this.ultimas.update((lista) => lista.map((n) => (idDe(n) === id ? { ...n, leida: true } : n)));
    this.noLeidas.update((n) => Math.max(0, n - 1));
  }

  private revertirLeida(id: string): void {
    this.ultimas.update((lista) => lista.map((n) => (idDe(n) === id ? { ...n, leida: false } : n)));
    this.noLeidas.update((n) => n + 1);
    this.toast.error('No se pudo marcar la notificación como leída.');
  }
}

export function idDe(noti: INotificacion): string | undefined {
  return noti.id ?? noti._id;
}
