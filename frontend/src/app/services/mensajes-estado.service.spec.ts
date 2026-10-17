import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { environment } from '../../environments/environment';
import { Mensaje } from '../model/mensaje.model';
import { EventoSocket, NotificacionSocketService } from './notificacion-socket.service';
import { MensajesEstadoService } from './mensajes-estado.service';
import { ToastService } from './toast.service';

const base = `${environment.apiUrl}mensajes/`;

const mensaje = (id: string, leido = false): Mensaje => ({
  id,
  materia: { id: 7, nombre: 'Matemática I' },
  remitente: { id: 12, nombre_completo: 'Pérez, Ana' },
  destinatario: { id: 31, nombre_completo: 'Gómez, Lucía' },
  asunto: `Asunto ${id}`,
  cuerpo: 'cuerpo',
  fecha_creacion: '2026-10-08T14:00:00Z',
  leido,
});

describe('MensajesEstadoService', () => {
  let servicio: MensajesEstadoService;
  let http: HttpTestingController;
  let eventos$: Subject<EventoSocket>;
  const token = signal<string | null>('jwt');
  const toast = { info: vi.fn(), error: vi.fn() };

  function iniciar(results: Mensaje[], no_leidos: number): void {
    servicio.iniciar();
    http
      .expectOne((r) => r.url === base)
      .flush({ count: results.length, next: null, previous: null, results, no_leidos });
  }

  beforeEach(() => {
    token.set('jwt');
    eventos$ = new Subject<EventoSocket>();
    toast.info.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { token } },
        { provide: NotificacionSocketService, useValue: { eventos: () => eventos$.asObservable() } },
        { provide: ToastService, useValue: toast },
      ],
    });
    servicio = TestBed.inject(MensajesEstadoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the last five received and the server unread counter', () => {
    servicio.iniciar();
    const req = http.expectOne((r) => r.url === base);
    expect(req.request.params.get('bandeja')).toBe('recibidos');
    expect(req.request.params.get('page_size')).toBe('5');
    req.flush({ count: 8, next: null, previous: null, results: [mensaje('1')], no_leidos: 4 });
    expect(servicio.ultimos().length).toBe(1);
    expect(servicio.noLeidos()).toBe(4);
  });

  it('flags the error state when the load fails', () => {
    servicio.iniciar();
    http.expectOne((r) => r.url === base).flush({}, { status: 500, statusText: 'Error' });
    expect(servicio.error()).toBe(true);
  });

  it('mensaje.nuevo raises the counter once and keeps five', () => {
    iniciar([mensaje('1', true), mensaje('2', true), mensaje('3', true), mensaje('4', true), mensaje('5', true)], 0);
    const nuevos: string[] = [];
    servicio.nuevos().subscribe((m) => nuevos.push(m.id));

    eventos$.next({ tipo: 'mensaje.nuevo', fecha: '', datos: mensaje('6') });
    eventos$.next({ tipo: 'mensaje.nuevo', fecha: '', datos: mensaje('6') });

    expect(servicio.noLeidos()).toBe(1);
    expect(servicio.ultimos().map((m) => m.id)).toEqual(['6', '1', '2', '3', '4']);
    expect(nuevos).toEqual(['6']);
    expect(toast.info).toHaveBeenCalledTimes(1);
  });

  it('mensaje.leido is forwarded as a read receipt and does not touch the counter', () => {
    iniciar([], 2);
    const recibos: string[] = [];
    servicio.leidos().subscribe((e) => recibos.push(e.id));

    eventos$.next({ tipo: 'mensaje.leido', fecha: '', datos: { id: 'm9', leido: true } });

    expect(recibos).toEqual(['m9']);
    expect(servicio.noLeidos()).toBe(2);
  });

  it('marks as read optimistically and calls POST leer', () => {
    iniciar([mensaje('1')], 1);
    servicio.marcarLeido(mensaje('1')).subscribe();
    expect(servicio.noLeidos()).toBe(0);
    expect(servicio.ultimos()[0].leido).toBe(true);
    http.expectOne(`${base}1/leer/`).flush({ id: '1', leido: true });
  });

  it('rolls back when the server refuses', () => {
    iniciar([mensaje('1')], 1);
    let fallo = false;
    servicio.marcarLeido(mensaje('1')).subscribe({ error: () => (fallo = true) });
    http.expectOne(`${base}1/leer/`).flush({}, { status: 404, statusText: 'No' });
    expect(fallo).toBe(true);
    expect(servicio.noLeidos()).toBe(1);
    expect(servicio.ultimos()[0].leido).toBe(false);
  });

  it('does not call the server for an already read message', () => {
    iniciar([mensaje('1', true)], 0);
    servicio.marcarLeido(mensaje('1', true)).subscribe();
    http.expectNone(`${base}1/leer/`);
  });

  it('clears the state when the session closes', () => {
    iniciar([mensaje('1')], 1);
    token.set(null);
    TestBed.tick();
    expect(servicio.ultimos()).toEqual([]);
    expect(servicio.noLeidos()).toBe(0);
  });
});
