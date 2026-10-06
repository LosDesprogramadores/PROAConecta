import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { environment } from '../../environments/environment';
import { EventoSocket, NotificacionSocketService } from './notificacion-socket.service';

class FakeWebSocket {
  static readonly OPEN = 1;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.OPEN;
  sent: string[] = [];
  closeCalledWith: number | undefined;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(code?: number): void {
    this.closeCalledWith = code;
  }

  // Helpers that simulate the server side.
  abrir(): void {
    this.onopen?.();
  }
  recibir(obj: unknown): void {
    this.onmessage?.({ data: JSON.stringify(obj) });
  }
  cerrarServidor(code: number): void {
    this.onclose?.({ code });
  }
}

describe('NotificacionSocketService', () => {
  const token = signal<string | null>('jwt');
  let http: HttpTestingController;
  let service: NotificacionSocketService;
  const ticketUrl = `${environment.apiUrl}ws/ticket/`;

  const ultimo = () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1];

  function responderTicket(ticket: string): void {
    http.expectOne(ticketUrl).flush({ ticket, expira_en: 30 });
  }

  function iniciar(): void {
    service = TestBed.inject(NotificacionSocketService);
    TestBed.tick();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('WebSocket', FakeWebSocket);
    FakeWebSocket.instances = [];
    token.set('jwt');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { token } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('requests a ticket and connects with ?ticket=', () => {
    iniciar();
    responderTicket('abc-123');

    expect(FakeWebSocket.instances.length).toBe(1);
    expect(ultimo().url).toBe(`${environment.wsUrl}?ticket=abc-123`);
  });

  it('does not connect while there is no session', () => {
    token.set(null);
    iniciar();

    http.expectNone(ticketUrl);
    expect(FakeWebSocket.instances.length).toBe(0);
  });

  it('closes the socket and stops reconnecting on logout', () => {
    iniciar();
    responderTicket('t1');
    const socket = ultimo();
    socket.abrir();

    token.set(null);
    TestBed.tick();
    expect(socket.closeCalledWith).toBe(1000);

    vi.advanceTimersByTime(60_000);
    http.expectNone(ticketUrl);
    expect(FakeWebSocket.instances.length).toBe(1);
  });

  it('emits typed events and maps notifications for the legacy stream', () => {
    iniciar();
    responderTicket('t1');
    const todos: EventoSocket[] = [];
    const notis: unknown[] = [];
    service.eventos().subscribe((e) => todos.push(e));
    service.escucharNotificaciones().subscribe((n) => notis.push(n));

    ultimo().abrir();
    ultimo().recibir({ tipo: 'anuncio.creado', fecha: '2026-10-08T14:00:00Z', datos: { titulo: 'A' } });
    ultimo().recibir({ tipo: 'mensaje.nuevo', fecha: '2026-10-08T14:00:01Z', datos: { id: 'm1' } });
    ultimo().recibir({ tipo: 'pong' });
    ultimo().onmessage?.({ data: 'not json' });

    expect(todos.map((e) => e.tipo)).toEqual(['anuncio.creado', 'mensaje.nuevo']);
    expect(notis).toEqual([{ titulo: 'A' }]);
  });

  it('sends a ping on open and every 30 s', () => {
    iniciar();
    responderTicket('t1');
    ultimo().abrir();
    expect(ultimo().sent).toEqual([JSON.stringify({ tipo: 'ping' })]);

    vi.advanceTimersByTime(30_000);
    vi.advanceTimersByTime(30_000);
    expect(ultimo().sent.length).toBe(3);
  });

  it('on 4401 requests a new ticket once, then backs off', () => {
    iniciar();
    responderTicket('t1');
    ultimo().abrir();
    ultimo().cerrarServidor(4401);

    // First 4401: immediate new ticket.
    responderTicket('t2');
    expect(ultimo().url).toContain('ticket=t2');
    ultimo().abrir();
    ultimo().cerrarServidor(4401);

    // Second 4401 without a successful message: no immediate request, backoff 1 s.
    http.expectNone(ticketUrl);
    vi.advanceTimersByTime(999);
    http.expectNone(ticketUrl);
    vi.advanceTimersByTime(1);
    responderTicket('t3');
    expect(ultimo().url).toContain('ticket=t3');
  });

  it('reconnects with exponential backoff capped at 30 s', () => {
    iniciar();
    responderTicket('t0');

    const esperas = [1000, 2000, 4000, 8000, 16000, 30000, 30000];
    esperas.forEach((ms, i) => {
      ultimo().cerrarServidor(1006);
      vi.advanceTimersByTime(ms - 1);
      http.expectNone(ticketUrl);
      vi.advanceTimersByTime(1);
      responderTicket(`t${i + 1}`);
    });
  });

  it('resets the backoff after receiving a message', () => {
    iniciar();
    responderTicket('t0');
    ultimo().cerrarServidor(1006);
    vi.advanceTimersByTime(1000);
    responderTicket('t1');
    ultimo().cerrarServidor(1006);
    vi.advanceTimersByTime(2000);
    responderTicket('t2');

    ultimo().abrir();
    ultimo().recibir({ tipo: 'pong' });
    ultimo().cerrarServidor(1006);

    vi.advanceTimersByTime(1000);
    responderTicket('t3');
    expect(ultimo().url).toContain('ticket=t3');
  });

  it('retries with backoff when the ticket request fails', () => {
    iniciar();
    http.expectOne(ticketUrl).flush({}, { status: 500, statusText: 'Server Error' });
    expect(FakeWebSocket.instances.length).toBe(0);

    vi.advanceTimersByTime(1000);
    responderTicket('t1');
    expect(ultimo().url).toContain('ticket=t1');
  });

  it('does not retry when the ticket request returns 401 and resumes when the token changes', () => {
    iniciar();
    http.expectOne(ticketUrl).flush({}, { status: 401, statusText: 'Unauthorized' });

    vi.advanceTimersByTime(60_000);
    http.expectNone(ticketUrl);
    expect(FakeWebSocket.instances.length).toBe(0);

    token.set('jwt-nuevo');
    TestBed.tick();
    responderTicket('t1');
    expect(ultimo().url).toContain('ticket=t1');
  });

  it('does not retry when the ticket request returns 403', () => {
    iniciar();
    http.expectOne(ticketUrl).flush({}, { status: 403, statusText: 'Forbidden' });

    vi.advanceTimersByTime(60_000);
    http.expectNone(ticketUrl);
  });

  it('a pong alone does not re-arm the immediate 4401 retry; a real event does', () => {
    iniciar();
    responderTicket('t1');
    ultimo().abrir();
    ultimo().cerrarServidor(4401);
    responderTicket('t2'); // immediate retry consumed

    ultimo().abrir();
    ultimo().recibir({ tipo: 'pong' });
    ultimo().cerrarServidor(4401);
    http.expectNone(ticketUrl); // still backing off
    vi.advanceTimersByTime(1000);
    responderTicket('t3');

    ultimo().abrir();
    ultimo().recibir({ tipo: 'anuncio.creado', fecha: '2026-10-08T14:00:00Z', datos: {} });
    ultimo().cerrarServidor(4401);
    responderTicket('t4'); // immediate again after a real event
    expect(ultimo().url).toContain('ticket=t4');
  });
});
