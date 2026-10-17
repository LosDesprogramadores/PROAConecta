import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../../core/auth/auth.service';
import { Entrega, ActividadesService } from '../../../services/actividades.service';
import { MateriaService } from '../../../services/materia.service';
import { EntregasProfesor } from './entregas-profesor';

function entrega(id: number, datos: Partial<Entrega> = {}): Entrega {
  return {
    id,
    actividad: 9,
    estudiante: 30 + id,
    estudiante_nombre: `Alumno ${id}`,
    actividad_titulo: 'TP 1',
    materia_id: 4,
    materia_titulo: 'Matemática I',
    fecha_entrega: '2026-10-01T10:00:00Z',
    nota: null,
    ...datos,
  };
}

const pagina = (results: Entrega[], count = results.length) => ({ count, next: null, previous: null, results });

describe('EntregasProfesor', () => {
  let fixture: ComponentFixture<EntregasProfesor>;
  let component: EntregasProfesor;
  const getEntregasPagina = vi.fn();
  const obtenerMateriasPorProfesor = vi.fn();
  const dom = () => fixture.nativeElement as HTMLElement;
  const filas = () => Array.from(dom().querySelectorAll<HTMLElement>('[data-testid="fila-entrega"]'));

  async function crear() {
    await TestBed.configureTestingModule({
      imports: [EntregasProfesor],
      providers: [
        provideRouter([]),
        { provide: ActividadesService, useValue: { getEntregasPagina } },
        { provide: MateriaService, useValue: { obtenerMateriasPorProfesor } },
        { provide: AuthService, useValue: { currentUser: signal({ id: 1, rolId: 2, persona: { id: 5 } }) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(EntregasProfesor);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    getEntregasPagina.mockReset().mockReturnValue(of(pagina([entrega(1), entrega(2, { nota: { id: 1, calificacion: '8.50', descripcion: '' } })])));
    obtenerMateriasPorProfesor.mockReset().mockReturnValue(of([{ id: 4, titulo: 'Matemática I' }, { id: 6, titulo: 'Física' }]));
  });

  it('opens on the "Sin calificar" tab, first page', async () => {
    await crear();

    expect(getEntregasPagina).toHaveBeenCalledWith(expect.objectContaining({ calificada: false, page: 1 }));
    expect(dom().querySelector('[aria-pressed="true"]')!.textContent).toContain('Sin calificar');
  });

  it('shows materia, activity, student, date and status or grade of every delivery', async () => {
    await crear();

    expect(filas().length).toBe(2);
    expect(filas()[0].textContent).toContain('Matemática I');
    expect(filas()[0].textContent).toContain('TP 1');
    expect(filas()[0].textContent).toContain('Alumno 1');
    expect(filas()[0].textContent).toContain('2026-10-01');
    expect(filas()[0].textContent).toContain('Sin calificar');
    expect(filas()[1].textContent).toContain('8.5');
  });

  it('links each row to the entregas screen of its activity', async () => {
    await crear();

    const enlace = filas()[0].querySelector<HTMLAnchorElement>('a')!;
    expect(enlace.getAttribute('href')).toBe('/view-materia/4/actividades/9/entregas');
  });

  it('marks a late delivery without grade as "Fuera de término"', async () => {
    getEntregasPagina.mockReturnValue(of(pagina([entrega(1, { fuera_de_termino: true })])));
    await crear();

    expect(filas()[0].textContent).toContain('Fuera de término');
  });

  it('switches to graded deliveries and back to the first page', async () => {
    await crear();

    component.setPestana('calificadas');
    expect(getEntregasPagina).toHaveBeenLastCalledWith(expect.objectContaining({ calificada: true, page: 1 }));

    component.setPestana('todas');
    const ultima = getEntregasPagina.mock.calls.at(-1)![0];
    expect(ultima.calificada).toBeUndefined();
  });

  it('filters by materia from the professor materias', async () => {
    await crear();
    expect(obtenerMateriasPorProfesor).toHaveBeenCalledWith(5);
    expect(Array.from(dom().querySelectorAll('select option')).map((o) => o.textContent!.trim())).toEqual([
      'Todas las materias',
      'Matemática I',
      'Física',
    ]);

    component.setMateria(6);

    expect(getEntregasPagina).toHaveBeenLastCalledWith(expect.objectContaining({ materia: 6, page: 1 }));
  });

  it('paginates: next and previous pages keep the filters', async () => {
    getEntregasPagina.mockReturnValue(of({ count: 45, next: 'x', previous: null, results: [entrega(1)] }));
    await crear();
    expect(dom().querySelector('[data-testid="paginacion"]')!.textContent).toContain('Página 1 de 3');

    component.irAPagina(2);

    expect(getEntregasPagina).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2, calificada: false }));
  });

  it('does not go beyond the available pages', async () => {
    getEntregasPagina.mockReturnValue(of({ count: 45, next: 'x', previous: null, results: [entrega(1)] }));
    await crear();
    getEntregasPagina.mockClear();

    component.irAPagina(0);
    component.irAPagina(4);

    expect(getEntregasPagina).not.toHaveBeenCalled();
  });

  it('shows the empty state when the professor has no deliveries', async () => {
    getEntregasPagina.mockReturnValue(of(pagina([])));
    await crear();

    expect(filas().length).toBe(0);
    expect(dom().textContent).toContain('No hay entregas sin calificar');
  });

  it('shows the server message with a retry that reloads', async () => {
    getEntregasPagina.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { detail: 'Error del servidor.' } })),
    );
    await crear();

    expect(dom().querySelector('[role="alert"]')!.textContent).toContain('Error del servidor.');

    getEntregasPagina.mockReturnValue(of(pagina([entrega(1)])));
    dom().querySelector<HTMLButtonElement>('[data-testid="reintentar"]')!.click();
    fixture.detectChanges();

    expect(filas().length).toBe(1);
    expect(dom().querySelector('[role="alert"]')).toBeNull();
  });

  it('keeps working without the materia filter when the materias fail to load', async () => {
    obtenerMateriasPorProfesor.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    await crear();

    expect(filas().length).toBe(2);
  });

  describe('stale requests and out-of-range pages', () => {
    it('ignores the response of a superseded request on rapid tab changes', async () => {
      const lenta = new Subject<ReturnType<typeof pagina>>();
      const rapida = new Subject<ReturnType<typeof pagina>>();
      getEntregasPagina.mockReset().mockReturnValueOnce(of(pagina([]))).mockReturnValueOnce(lenta).mockReturnValueOnce(rapida);
      await crear();

      component.setPestana('calificadas');
      component.setPestana('todas');
      rapida.next(pagina([entrega(2)]));
      lenta.next(pagina([entrega(1), entrega(3)]));
      fixture.detectChanges();

      expect(component.entregas().map((e) => e.id)).toEqual([2]);
      expect(lenta.observed).toBe(false);
      expect(component.cargando()).toBe(false);
    });

    it('ignores a late error of a superseded request', async () => {
      const lenta = new Subject<ReturnType<typeof pagina>>();
      getEntregasPagina.mockReset().mockReturnValueOnce(of(pagina([]))).mockReturnValueOnce(lenta).mockReturnValueOnce(of(pagina([entrega(7)])));
      await crear();

      component.setMateria(6);
      component.setMateria(4);
      lenta.error(new HttpErrorResponse({ status: 500 }));
      fixture.detectChanges();

      expect(component.error()).toBe('');
      expect(component.entregas().map((e) => e.id)).toEqual([7]);
    });

    it('ignores the response of a superseded page change', async () => {
      const lenta = new Subject<{ count: number; next: null; previous: null; results: Entrega[] }>();
      getEntregasPagina
        .mockReset()
        .mockReturnValueOnce(of(pagina([entrega(1)], 45)))
        .mockReturnValueOnce(lenta)
        .mockReturnValueOnce(of(pagina([entrega(3)], 45)));
      await crear();

      component.irAPagina(2);
      component.irAPagina(3);
      lenta.next(pagina([entrega(2)], 45));

      expect(component.entregas().map((e) => e.id)).toEqual([3]);
      expect(component.pagina()).toBe(3);
    });

    it('falls back to page 1 and reloads when the requested page does not exist (404)', async () => {
      getEntregasPagina
        .mockReset()
        .mockReturnValueOnce(of(pagina([entrega(1)], 45)))
        .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 404, error: { detail: 'Página inválida.' } })))
        .mockReturnValueOnce(of(pagina([entrega(1)], 5)));
      await crear();

      component.irAPagina(3);
      fixture.detectChanges();

      expect(component.pagina()).toBe(1);
      expect(getEntregasPagina).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
      expect(component.error()).toBe('');
      expect(filas().length).toBe(1);
    });

    it('shows the error on a 404 of page 1 instead of looping', async () => {
      getEntregasPagina.mockReset().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
      await crear();

      expect(getEntregasPagina).toHaveBeenCalledTimes(1);
      expect(component.error()).not.toBe('');
    });
  });
});
