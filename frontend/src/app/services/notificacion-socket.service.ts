import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { effect, inject, Injectable, untracked } from '@angular/core';
import { filter, map, Observable, Subject, Subscription } from 'rxjs';

import { AuthService } from '../core/auth/auth.service';
import { environment } from '../../environments/environment';
import { INotificacion } from '../model/notificacion.model';

/** Envelope of every server -> client message (see contracts/websocket.md). */
export interface EventoSocket<T = unknown> {
  tipo: string;
  fecha: string;
  datos: T;
}

interface TicketResponse {
  ticket: string;
  expira_en: number;
}

const CODIGO_TICKET_INVALIDO = 4401;
const CODIGO_CIERRE_NORMAL = 1000;
const INTERVALO_PING_MS = 30_000; // nginx closes idle connections at 3600 s
const BACKOFF_INICIAL_MS = 1_000;
const BACKOFF_MAXIMO_MS = 30_000;
const TIPOS_NOTIFICACION = ['anuncio.creado', 'notificacion.creada'];

@Injectable({
  providedIn: 'root',
})
export class NotificacionSocketService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private readonly eventosSubject = new Subject<EventoSocket>();

  private socket: WebSocket | null = null;
  private activo = false;
  private ticketSub: Subscription | null = null;
  private timerReconexion: ReturnType<typeof setTimeout> | null = null;
  private timerPing: ReturnType<typeof setInterval> | null = null;
  private intentos = 0;
  private reintentoPorTicket = false;

  constructor() {
    // The connection follows the session: opens on login, closes on logout.
    effect(() => {
      const hayToken = !!this.auth.token();
      untracked(() => (hayToken ? this.iniciarConexion() : this.cerrarConexion()));
    });
  }

  /** Typed stream of every event received from the server. */
  public eventos(): Observable<EventoSocket> {
    return this.eventosSubject.asObservable();
  }

  /** Notification-like events (`anuncio.creado`, `notificacion.creada`) as `INotificacion`. */
  public escucharNotificaciones(): Observable<INotificacion> {
    return this.eventosSubject.pipe(
      filter((e) => TIPOS_NOTIFICACION.includes(e.tipo)),
      map((e) => e.datos as INotificacion),
    );
  }

  /** Idempotent: does nothing if a connection or attempt is already in progress. */
  public iniciarConexion(): void {
    if (this.activo) {
      return;
    }
    this.activo = true;
    this.pedirTicketYConectar();
  }

  public cerrarConexion(): void {
    this.activo = false;
    this.intentos = 0;
    this.reintentoPorTicket = false;
    this.ticketSub?.unsubscribe();
    this.ticketSub = null;
    this.limpiarTimers();

    if (this.socket) {
      const socket = this.socket;
      this.socket = null;
      socket.onclose = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.close(CODIGO_CIERRE_NORMAL);
    }
  }

  private pedirTicketYConectar(): void {
    this.ticketSub?.unsubscribe();
    this.ticketSub = this.http.post<TicketResponse>(`${environment.apiUrl}ws/ticket/`, {}).subscribe({
      next: ({ ticket }) => {
        if (this.activo) {
          this.abrirSocket(ticket);
        }
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 401 || err.status === 403) {
          // Expired or invalid session: stay disconnected until the token signal changes.
          this.activo = false;
          return;
        }
        this.programarReconexion();
      },
    });
  }

  private abrirSocket(ticket: string): void {
    const socket = new WebSocket(`${environment.wsUrl}?ticket=${encodeURIComponent(ticket)}`);
    this.socket = socket;

    socket.onopen = () => {
      // The ping doubles as a liveness probe: its pong proves the ticket was accepted.
      this.enviarPing();
      this.timerPing = setInterval(() => this.enviarPing(), INTERVALO_PING_MS);
    };

    socket.onmessage = (event) => this.procesarMensaje(event.data);

    socket.onerror = (error) => {
      if (!environment.production) {
        console.error('Error en el WebSocket de notificaciones:', error);
      }
    };

    socket.onclose = (event) => {
      this.socket = null;
      this.limpiarTimers();
      if (!this.activo) {
        return;
      }
      if (event.code === CODIGO_TICKET_INVALIDO && !this.reintentoPorTicket) {
        // Expired or already used ticket: ask for a fresh one once before backing off.
        this.reintentoPorTicket = true;
        this.pedirTicketYConectar();
        return;
      }
      this.programarReconexion();
    };
  }

  private procesarMensaje(raw: unknown): void {
    let mensaje: Partial<EventoSocket> | null;
    try {
      mensaje = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!mensaje || typeof mensaje.tipo !== 'string') {
      return;
    }

    // Any valid frame (pong included) confirms a healthy connection.
    this.intentos = 0;

    if (mensaje.tipo === 'pong') {
      return;
    }
    // Only a real event proves the ticket flow works end to end.
    this.reintentoPorTicket = false;
    this.eventosSubject.next(mensaje as EventoSocket);
  }

  private enviarPing(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ tipo: 'ping' }));
    }
  }

  private programarReconexion(): void {
    if (!this.activo || this.timerReconexion) {
      return;
    }
    const espera = Math.min(BACKOFF_INICIAL_MS * 2 ** this.intentos, BACKOFF_MAXIMO_MS);
    this.intentos++;
    this.timerReconexion = setTimeout(() => {
      this.timerReconexion = null;
      if (this.activo) {
        this.pedirTicketYConectar();
      }
    }, espera);
  }

  private limpiarTimers(): void {
    if (this.timerReconexion) {
      clearTimeout(this.timerReconexion);
      this.timerReconexion = null;
    }
    if (this.timerPing) {
      clearInterval(this.timerPing);
      this.timerPing = null;
    }
  }
}
