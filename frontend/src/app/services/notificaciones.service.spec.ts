import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../environments/environment';
import { NotificacionService } from './notificaciones.service';

const base = `${environment.apiUrl}notificaciones/`;

describe('NotificacionService', () => {
  let service: NotificacionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(NotificacionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('keeps the plain list call (no page) for the admin screen', () => {
    service.obtenerNotificaciones().subscribe();
    const req = http.expectOne(base);
    expect(req.request.params.keys()).toEqual([]);
    req.flush([]);
  });

  it('asks for a page and returns the unread counter', () => {
    let no_leidas = -1;
    service.listarPaginado({ page: 3, page_size: 10 }).subscribe((r) => (no_leidas = r.no_leidas));
    const req = http.expectOne((r) => r.url === base);
    expect(req.request.params.get('page')).toBe('3');
    expect(req.request.params.get('page_size')).toBe('10');
    req.flush({ count: 25, next: null, previous: null, results: [], no_leidas: 4 });
    expect(no_leidas).toBe(4);
  });

  it('marks a notification as read with POST leer', () => {
    service.marcarLeida('abc').subscribe();
    const req = http.expectOne(`${base}abc/leer/`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'abc', leida: true });
  });
});
