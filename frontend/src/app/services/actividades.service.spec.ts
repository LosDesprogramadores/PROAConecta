import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../environments/environment';
import { ActividadesService } from './actividades.service';

describe('ActividadesService', () => {
  let service: ActividadesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ActividadesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('grades a student on an activity with the student id in the body', () => {
    const datos = { estudiante_id: 15, calificacion: 8, descripcion: 'Good work' };
    service.calificarEstudianteEnActividad(3, datos).subscribe();
    const req = http.expectOne(`${environment.apiUrl}actividades/3/calificar-estudiante/`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(datos);
    req.flush({});
  });

  it('reads the follow-up of every enrolled student of an activity', () => {
    service.getSeguimiento(9).subscribe();
    const req = http.expectOne(`${environment.apiUrl}actividades/9/seguimiento/`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('lists deliveries page by page with the graded and materia filters', () => {
    service.getEntregasPagina({ page: 2, page_size: 20, calificada: false, materia: 4 }).subscribe();
    const req = http.expectOne((r) => r.url === `${environment.apiUrl}entregas/`);
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('page_size')).toBe('20');
    expect(req.request.params.get('calificada')).toBe('false');
    expect(req.request.params.get('materia')).toBe('4');
    req.flush({ count: 0, next: null, previous: null, results: [] });
  });

  it('omits the optional filters of the deliveries listing when they are not set', () => {
    service.getEntregasPagina({ page: 1 }).subscribe();
    const req = http.expectOne((r) => r.url === `${environment.apiUrl}entregas/`);
    expect(req.request.params.keys()).toEqual(['page']);
    req.flush({ count: 0, next: null, previous: null, results: [] });
  });
});
