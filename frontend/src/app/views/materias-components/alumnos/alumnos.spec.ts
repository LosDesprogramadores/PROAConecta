import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Alumnos } from './alumnos';
import { environment } from '../../../../environments/environment';

const URL_ALUMNOS = `${environment.apiUrl}materias/7/alumnos/`;

const ALUMNOS = [
  { inscripcion_id: 2, persona_id: 32, apellido: 'Pérez', nombre: 'Ana', email: 'ana@example.com', estado: 'REGULAR', fecha_inscripcion: '2026-03-12' },
  { inscripcion_id: 1, persona_id: 31, apellido: 'Gómez', nombre: 'Lucía', email: 'lucia@example.com', estado: 'CURSANDO', fecha_inscripcion: '2026-03-10' },
];

describe('Alumnos', () => {
  let http: HttpTestingController;

  function crear() {
    const fixture = TestBed.createComponent(Alumnos);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { parent: { snapshot: { paramMap: new Map([['id', '7']]) } } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  it('shows the loading state until the list arrives', () => {
    const fixture = crear();
    expect(fixture.nativeElement.textContent).toContain('Cargando alumnos');

    http.expectOne(URL_ALUMNOS).flush(ALUMNOS);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Cargando alumnos');
  });

  it('renders the students ordered by last name with email, state and date', () => {
    const fixture = crear();
    http.expectOne(URL_ALUMNOS).flush(ALUMNOS);
    fixture.detectChanges();

    const filas: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('tbody tr'));
    expect(filas.length).toBe(2);
    expect(filas[0].textContent).toContain('Gómez');
    expect(filas[0].textContent).toContain('lucia@example.com');
    expect(filas[0].textContent).toContain('Cursando');
    expect(filas[0].textContent).toContain('10/03/2026');
    expect(filas[1].textContent).toContain('Pérez');
  });

  it('shows the empty state when there are no students', () => {
    const fixture = crear();
    http.expectOne(URL_ALUMNOS).flush([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No hay alumnos');
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });

  it('shows a friendly error and never the raw body on a server error', () => {
    const fixture = crear();
    http.expectOne(URL_ALUMNOS).flush('<html>Traceback (most recent call last)</html>', {
      status: 500,
      statusText: 'Server Error',
    });
    fixture.detectChanges();

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('No se pudo cargar la lista de alumnos');
    expect(texto).not.toContain('Traceback');
  });

  it('reloads with ?estado= when the state filter changes', () => {
    const fixture = crear();
    http.expectOne(URL_ALUMNOS).flush(ALUMNOS);

    fixture.componentInstance.cambiarEstado('LIBRE');
    const req = http.expectOne((r) => r.url === URL_ALUMNOS);
    expect(req.request.params.get('estado')).toBe('LIBRE');
    req.flush([]);
  });

  it('offers the real states and does not invent ACTIVA', () => {
    const fixture = crear();
    http.expectOne(URL_ALUMNOS).flush(ALUMNOS);
    fixture.detectChanges();

    const valores = Array.from<HTMLOptionElement>(fixture.nativeElement.querySelectorAll('select option')).map((o) => o.value);
    expect(valores).toEqual(['', 'CURSANDO', 'REGULAR', 'PROMOCIONADO', 'LIBRE', 'BAJA']);
  });
});
