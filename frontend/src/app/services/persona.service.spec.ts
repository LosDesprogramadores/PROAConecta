import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../environments/environment';
import { RespuestaPaginada } from '../core/models/api-response.interface';
import { Persona, RolId } from '../model/Persona.model';
import { EstudianteService } from './estudiante.service';
import { PersonaService } from './persona.service';
import { ProfesorService } from './profesor.service';

const url = `${environment.apiUrl}personas/rol/`;

const pagina: RespuestaPaginada<Persona> = { count: 0, next: null, previous: null, results: [] };

describe('listarPaginado (personas)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('PersonaService sends the role and the page and returns the envelope', () => {
    let recibida: RespuestaPaginada<Persona> | undefined;
    TestBed.inject(PersonaService)
      .listarPaginado(RolId.ESTUDIANTE, { page: 2, page_size: 25 })
      .subscribe((r) => (recibida = r));

    const req = http.expectOne((r) => r.url === url);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('rol')).toBe('3');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('page_size')).toBe('25');
    req.flush({ ...pagina, count: 60 });

    expect(recibida?.count).toBe(60);
  });

  it('omits page_size when it is not given', () => {
    TestBed.inject(PersonaService).listarPaginado(RolId.PROFESOR, { page: 1 }).subscribe();
    const req = http.expectOne((r) => r.url === url);
    expect(req.request.params.has('page_size')).toBe(false);
    req.flush(pagina);
  });

  it('EstudianteService asks for the student role', () => {
    TestBed.inject(EstudianteService).listarPaginado({ page: 1 }).subscribe();
    const req = http.expectOne((r) => r.url === url);
    expect(req.request.params.get('rol')).toBe(String(RolId.ESTUDIANTE));
    req.flush(pagina);
  });

  it('ProfesorService asks for the professor role', () => {
    TestBed.inject(ProfesorService).listarPaginado({ page: 3 }).subscribe();
    const req = http.expectOne((r) => r.url === url);
    expect(req.request.params.get('rol')).toBe(String(RolId.PROFESOR));
    expect(req.request.params.get('page')).toBe('3');
    req.flush(pagina);
  });

  it('keeps the existing non-paginated methods untouched', () => {
    TestBed.inject(PersonaService).obtenerPersonas(RolId.ESTUDIANTE).subscribe();
    http.expectOne(`${url}?rol=3`).flush([]);
  });
});
