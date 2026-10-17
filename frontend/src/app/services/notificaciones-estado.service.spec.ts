import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../core/auth/auth.service';
import { environment } from '../../environments/environment';
import { INotificacion } from '../model/notificacion.model';
import { NotificacionSocketService } from './notificacion-socket.service';
import { NotificacionesEstadoService } from './notificaciones-estado.service';
import { ToastService } from './toast.service';

const base = `${environment.apiUrl}notificaciones/`;

const noti = (id: string, leida = false): INotificacion => ({
  id,
  titulo: `T${id}`,
  mensaje: 'm',
  alcance: 'AMBOS',
  leida,
});

describe('NotificacionesEstadoService', () => {
  let servicio: NotificacionesEstadoService;
  let http: HttpTestingController;
  let socket$: Subject<INotificacion>;
  const token = signal<string | null>('jwt');
  const toast = { info: vi.fn(), error: vi.fn() };

  function iniciar(results: INotificacion[], no_leidas: number): void {
    servicio.iniciar();
    http.expectOne((r) => r.url === base).flush({ count: results.length, next: null, previous: null, results, no_leidas });
  }

  beforeEach(() => {
    token.set('jwt');
    socket$ = new Subject<INotificacion>();
    toast.info.mockReset();
    toast.error.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { token } },
        { provide: NotificacionSocketService, useValue: { escucharNotificaciones: () => socket$.asObservable() } },
        { provide: ToastService, useValue: toast },
      ],
    });
    servicio = TestBed.inject(NotificacionesEstadoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the last five and the real unread counter', () => {
    servicio.iniciar();
    const req = http.expectOne((r) => r.url === base);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('page_size')).toBe('5');
    req.flush({ count: 9, next: null, previous: null, results: [noti('1')], no_leidas: 7 });

    expect(servicio.ultimas().length).toBe(1);
    expect(servicio.noLeidas()).toBe(7);
    expect(servicio.cargando()).toBe(false);
  });

  it('flags the error state when the load fails', () => {
    servicio.iniciar();
    http.expectOne((r) => r.url === base).flush({}, { status: 500, statusText: 'Error' });
    expect(servicio.error()).toBe(true);
  });

  it('adds a live notification once, keeps five and bumps the counter', () => {
    iniciar([noti('1'), noti('2'), noti('3'), noti('4'), noti('5')], 5);

    socket$.next(noti('6'));
    socket$.next(noti('6'));

    expect(servicio.ultimas().map((n) => n.id)).toEqual(['6', '1', '2', '3', '4']);
    expect(servicio.noLeidas()).toBe(6);
    expect(toast.info).toHaveBeenCalledTimes(1);
  });

  it('marks as read optimistically and calls POST leer', () => {
    iniciar([noti('1')], 1);

    servicio.marcarLeida(noti('1')).subscribe();
    expect(servicio.noLeidas()).toBe(0);
    expect(servicio.ultimas()[0].leida).toBe(true);
    http.expectOne(`${base}1/leer/`).flush({ id: '1', leida: true });
  });

  it('rolls back the counter when the server refuses', () => {
    iniciar([noti('1')], 1);

    let fallo = false;
    servicio.marcarLeida(noti('1')).subscribe({ error: () => (fallo = true) });
    http.expectOne(`${base}1/leer/`).flush({}, { status: 500, statusText: 'Error' });

    expect(fallo).toBe(true);
    expect(servicio.noLeidas()).toBe(1);
    expect(servicio.ultimas()[0].leida).toBe(false);
    expect(toast.error).toHaveBeenCalled();
  });

  it('does not call the server for a notification that is already read', () => {
    iniciar([noti('1', true)], 0);
    servicio.marcarLeida(noti('1', true)).subscribe();
    http.expectNone(`${base}1/leer/`);
  });

  it('clears the state when the session closes', () => {
    iniciar([noti('1')], 1);
    token.set(null);
    TestBed.tick();
    expect(servicio.ultimas()).toEqual([]);
    expect(servicio.noLeidas()).toBe(0);
  });
});
