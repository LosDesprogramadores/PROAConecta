import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../environments/environment';
import { InscripcionesService } from './inscripciones.service';

const base = `${environment.apiUrl}inscripciones/`;

describe('InscripcionesService', () => {
  let service: InscripcionesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(InscripcionesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists the enrollments of a student', () => {
    service.obtenerInscripcionesPorEstudiante(4).subscribe();
    const req = http.expectOne(`${base}?estudiante=4`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('lists the enrollments of a subject', () => {
    service.obtenerInscripcionesPorMateria(5).subscribe();
    const req = http.expectOne(`${base}?materia=5`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('enrolls a student in several subjects with the expected payload', () => {
    service.inscribirEstudiante(4, [1, 2, 3]).subscribe();
    const req = http.expectOne(`${base}inscribir/`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ estudiante_id: 4, materia_ids: [1, 2, 3] });
    req.flush({});
  });
});
