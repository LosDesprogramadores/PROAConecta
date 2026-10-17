import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../environments/environment';
import { AnunciosService } from './anuncios.service';

const base = `${environment.apiUrl}materias/`;

describe('AnunciosService', () => {
  let service: AnunciosService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AnunciosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists the announcements of a subject with the page query', () => {
    service.listarPorMateria(7, { page: 2, page_size: 10 }).subscribe();
    const req = http.expectOne((r) => r.url === `${base}7/anuncios/`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('page_size')).toBe('10');
    req.flush({ count: 0, next: null, previous: null, results: [], no_leidas: 0 });
  });

  it('publishes an announcement with only title and message', () => {
    service.publicar(7, { titulo: 'Parcial', mensaje: 'El jueves' }).subscribe();
    const req = http.expectOne(`${base}7/anuncios/`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ titulo: 'Parcial', mensaje: 'El jueves' });
    req.flush({});
  });

  it('builds every URL from the environment', () => {
    service.getAnuncios().subscribe();
    const req = http.expectOne(`${environment.apiUrl}notificaciones/`);
    expect(req.request.url).toContain(environment.apiUrl);
    req.flush([]);
  });
});
