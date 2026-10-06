import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../environments/environment';
import { MensajesService } from './mensajes.service';

const base = `${environment.apiUrl}mensajes/`;

describe('MensajesService', () => {
  let service: MensajesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(MensajesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists a tray with page, page size and subject filter', () => {
    service.obtenerMensajes({ bandeja: 'enviados', page: 2, page_size: 10, materia: 7 }).subscribe();
    const req = http.expectOne((r) => r.url === base);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('bandeja')).toBe('enviados');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('page_size')).toBe('10');
    expect(req.request.params.get('materia')).toBe('7');
    req.flush({ count: 0, next: null, previous: null, results: [], no_leidos: 0 });
  });

  it('omits the optional params when they are not given', () => {
    service.obtenerMensajes({ bandeja: 'recibidos', page: 1 }).subscribe();
    const req = http.expectOne((r) => r.url === base);
    expect(req.request.params.has('materia')).toBe(false);
    expect(req.request.params.has('page_size')).toBe(false);
    req.flush({ count: 0, next: null, previous: null, results: [], no_leidos: 0 });
  });

  it('sends a message with the contract body', () => {
    const cuerpo = { materia_id: 7, destinatario_id: 31, asunto: 'Consulta', cuerpo: 'Hola' };
    service.enviarMensaje(cuerpo).subscribe();
    const req = http.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(cuerpo);
    req.flush({});
  });

  it('marks as read with POST leer', () => {
    service.marcarLeido('m1').subscribe();
    const req = http.expectOne(`${base}m1/leer/`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'm1', leido: true });
  });

  it('deletes with DELETE', () => {
    service.eliminarMensaje('m1').subscribe();
    const req = http.expectOne(`${base}m1/`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('asks the allowed recipients of a subject', () => {
    service.obtenerDestinatarios(7).subscribe();
    const req = http.expectOne(`${environment.apiUrl}materias/7/destinatarios/`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
