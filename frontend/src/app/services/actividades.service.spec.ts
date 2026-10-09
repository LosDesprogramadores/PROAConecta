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
});
