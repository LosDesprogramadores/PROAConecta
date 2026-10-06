import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../environments/environment';
import { IMateria } from '../model/materia.model';
import { MateriaService } from './materia.service';

const base = `${environment.apiUrl}materias/`;

describe('MateriaService', () => {
  let service: MateriaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(MateriaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists the subjects', () => {
    service.obtenerMaterias().subscribe();
    const req = http.expectOne(base);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('gets a subject by id', () => {
    service.obtenerMateriaPorId(5).subscribe();
    const req = http.expectOne(`${base}5/`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('creates a subject with the given payload', () => {
    const materia = { titulo: 'Álgebra', anio: 1, curso: 'A' } as unknown as IMateria;
    service.crearMateria(materia).subscribe();
    const req = http.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(materia);
    req.flush(materia);
  });

  it('updates a subject with PUT', () => {
    const materia = { titulo: 'Álgebra II', anio: 1, curso: 'A' } as unknown as IMateria;
    service.actualizarMateria(5, materia).subscribe();
    const req = http.expectOne(`${base}5/`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(materia);
    req.flush(materia);
  });

  it('deletes a subject', () => {
    service.eliminarMateria(5).subscribe();
    const req = http.expectOne(`${base}5/`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('assigns a professor to several subjects', () => {
    service.asignarProfesorAMaterias(9, [1, 2]).subscribe();
    const req = http.expectOne(`${base}asignar-profesor/`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ profesor_id: 9, materia_ids: [1, 2] });
    req.flush({});
  });

  it('unassigns the professor of a subject with PATCH', () => {
    service.desasignarProfesor(5).subscribe();
    const req = http.expectOne(`${base}5/desasignar-profesor/`);
    expect(req.request.method).toBe('PATCH');
    req.flush(null);
  });

  it('filters by professor, by excluded professor and by available student', () => {
    service.obtenerMateriasPorProfesor(9).subscribe();
    http.expectOne(`${base}?profesor=9`).flush([]);
    service.cargarMateriasQueNoTengaElProfesor(9).subscribe();
    http.expectOne(`${base}?excluir_profesor=9`).flush([]);
    service.cargarMateriasDisponiblesParaEstudiante(4).subscribe();
    http.expectOne(`${base}?disponibles_estudiante=4`).flush([]);
  });

  it('lists the subjects of a student', () => {
    service.obteberMateriasPorEstudiante(4).subscribe();
    const req = http.expectOne(`${base}por-estudiante/4/`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('unenrolls a student with the expected payload', () => {
    service.desinscribirEstudiante(4, 5).subscribe();
    const req = http.expectOne(`${environment.apiUrl}inscripciones/desinscribir/`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ estudiante_id: 4, materia_id: 5 });
    req.flush({});
  });

  it('lists the students of a subject, optionally filtered by state', () => {
    service.obtenerAlumnos(5).subscribe();
    const sinFiltro = http.expectOne(`${base}5/alumnos/`);
    expect(sinFiltro.request.params.keys()).toEqual([]);
    sinFiltro.flush([]);

    service.obtenerAlumnos(5, 'BAJA' as never).subscribe();
    const conFiltro = http.expectOne((r) => r.url === `${base}5/alumnos/`);
    expect(conFiltro.request.params.get('estado')).toBe('BAJA');
    conFiltro.flush([]);
  });
});
