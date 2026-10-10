import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActividadesService, Entrega } from '../../../services/actividades.service';
import { ToastService } from '../../../services/toast.service';
import { FilaSeguimiento, Seguimiento } from '../../../model/seguimiento.model';
import { ActividadEntregasComponent } from './actividad-entregas';

function fila(datos: Partial<FilaSeguimiento> & Pick<FilaSeguimiento, 'estudiante_id' | 'apellido' | 'estado'>): FilaSeguimiento {
  return { nombre: 'Ana', dni: '30111222', entrega_id: null, fecha_entrega: null, nota: null, ...datos };
}

const filas: FilaSeguimiento[] = [
  fila({ estudiante_id: 1, apellido: 'Alfa', estado: 'ENTREGADO', entrega_id: 5, fecha_entrega: '2026-10-01T10:00:00Z' }),
  fila({ estudiante_id: 2, apellido: 'Beta', estado: 'PENDIENTE' }),
  fila({ estudiante_id: 3, apellido: 'Gamma', estado: 'NO_ENTREGADO' }),
  fila({ estudiante_id: 4, apellido: 'Delta', estado: 'FUERA_DE_TERMINO', entrega_id: 6, fecha_entrega: '2026-10-09T10:00:00Z' }),
  fila({
    estudiante_id: 5, apellido: 'Epsilon', estado: 'CORREGIDO', entrega_id: 7, fecha_entrega: '2026-10-01T10:00:00Z',
    nota: { calificacion: '9.00', descripcion: 'Muy bien' },
  }),
];

const seguimiento: Seguimiento = {
  actividad: { id: 1, titulo: 'TP 1', fecha_limite: '2026-10-05T00:00:00Z' },
  materia: { id: 4, titulo: 'Matemática I' },
  resumen: { ENTREGADO: 1, PENDIENTE: 1, NO_ENTREGADO: 1, FUERA_DE_TERMINO: 1, CORREGIDO: 1 },
  estudiantes: filas,
};

const entregaConArchivo = {
  id: 5, actividad: 1, estudiante: 1, estudiante_nombre: 'Alfa, Ana', fecha_entrega: '2026-10-01T10:00:00Z',
  archivo: 'http://api/media/tp.pdf', enlace: 'https://ejemplo.com/tp', contenido_texto: 'Adjunto mi trabajo',
} as Entrega;

describe('ActividadEntregasComponent', () => {
  let fixture: ComponentFixture<ActividadEntregasComponent>;
  let component: ActividadEntregasComponent;
  const getSeguimiento = vi.fn();
  const getEntregas = vi.fn();
  const calificarEstudianteEnActividad = vi.fn();
  const dom = () => fixture.nativeElement as HTMLElement;
  const dialogo = () => dom().querySelector<HTMLElement>('[role="dialog"]');
  const inputNota = () => dom().querySelector<HTMLInputElement>('#nota')!;
  const filasDom = () => Array.from(dom().querySelectorAll<HTMLElement>('[data-testid="fila-estudiante"]'));
  const insignias = () => filasDom().map((f) => f.querySelector('[data-testid="estado"]')!.textContent!.trim());

  async function escribirNota(valor: string) {
    const input = inputNota();
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function crear() {
    await TestBed.configureTestingModule({
      imports: [ActividadEntregasComponent],
      providers: [
        { provide: ActividadesService, useValue: { getSeguimiento, getEntregas, calificarEstudianteEnActividad } },
        { provide: ActivatedRoute, useValue: { parent: null, snapshot: { paramMap: new Map([['id', '1']]) } } },
        { provide: Router, useValue: { url: '/view-materia/4/actividades/1/entregas', navigate: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ActividadEntregasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    getSeguimiento.mockReset().mockReturnValue(of(seguimiento));
    getEntregas.mockReset().mockReturnValue(of([entregaConArchivo]));
    calificarEstudianteEnActividad.mockReset().mockReturnValue(of({}));
  });

  describe('listing', () => {
    beforeEach(crear);

    it('loads the follow-up of the activity', () => {
      expect(getSeguimiento).toHaveBeenCalledWith(1);
    });

    it('shows the materia and activity titles in the header', () => {
      expect(dom().querySelector('[data-testid="materia-titulo"]')!.textContent).toContain('Matemática I');
      expect(dom().querySelector('h1')!.textContent).toContain('TP 1');
    });

    it('lists every student, also those without a delivery, with the five statuses', () => {
      expect(filasDom().length).toBe(5);
      expect(insignias()).toEqual(['Entregado', 'Pendiente', 'No entregado', 'Fuera de término', 'Corregido']);
    });

    it('shows the status counters', () => {
      const resumen = dom().querySelector('[data-testid="resumen"]')!.textContent!;
      for (const etiqueta of ['Entregado', 'Corregido', 'Fuera de término', 'Pendiente', 'No entregado']) {
        expect(resumen).toContain(etiqueta);
      }
      expect(component.resumenItems().map((i) => i.cantidad)).toEqual([1, 1, 1, 1, 1]);
    });

    it('shows the grade of a graded student and a dash when there is none', () => {
      expect(filasDom()[4].textContent).toContain('9');
      expect(filasDom()[1].textContent).toContain('—');
    });

    it('offers to grade every row, with or without delivery', () => {
      const botones = filasDom().map((f) => f.querySelector('button')!.textContent!.trim());
      expect(botones).toEqual(Array(5).fill('Calificar'));
    });
  });

  describe('grading', () => {
    beforeEach(async () => {
      await crear();
      component.abrirModal(filas[1]);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('opens the grading form in an accessible dialog named after the student', () => {
      expect(dialogo()?.getAttribute('aria-modal')).toBe('true');
      expect(dom().querySelector(`#${dialogo()!.getAttribute('aria-labelledby')}`)?.textContent).toContain('Beta');
    });

    it('limits the grade input to the backend range', () => {
      const input = inputNota();
      expect(input.min).toBe('1');
      expect(input.max).toBe('10');
      expect(input.step).toBe('0.01');
    });

    it('rejects a grade below 1 with a Spanish message linked to the input', async () => {
      await escribirNota('0');
      component.guardar();
      fixture.detectChanges();

      expect(calificarEstudianteEnActividad).not.toHaveBeenCalled();
      const error = dom().querySelector('#nota-error')!;
      expect(error.getAttribute('role')).toBe('alert');
      expect(error.textContent).toContain('entre 1 y 10');
      expect(inputNota().getAttribute('aria-invalid')).toBe('true');
      expect(inputNota().getAttribute('aria-describedby')).toBe('nota-error');
    });

    it('rejects a grade above 10', async () => {
      await escribirNota('10.5');
      component.guardar();
      expect(calificarEstudianteEnActividad).not.toHaveBeenCalled();
    });

    it('grades a student without delivery and reloads the follow-up', async () => {
      await escribirNota('8.75');
      component.guardar();

      expect(calificarEstudianteEnActividad).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ estudiante_id: 2, calificacion: 8.75 }),
      );
      expect(getSeguimiento).toHaveBeenCalledTimes(2);
      fixture.detectChanges();
      expect(dialogo()).toBeNull();
    });

    it('shows the new status after grading', async () => {
      getSeguimiento.mockReturnValue(
        of({
          ...seguimiento,
          estudiantes: filas.map((f) =>
            f.estudiante_id === 2 ? { ...f, estado: 'CORREGIDO', entrega_id: 8, nota: { calificacion: '8.75', descripcion: '' } } : f,
          ),
        }),
      );
      await escribirNota('8.75');
      component.guardar();
      fixture.detectChanges();

      expect(insignias()[1]).toBe('Corregido');
    });

    it('closes with Escape without saving', () => {
      dialogo()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
      expect(dialogo()).toBeNull();
      expect(calificarEstudianteEnActividad).not.toHaveBeenCalled();
    });

    it('keeps the dialog open and shows the server detail when saving fails', async () => {
      calificarEstudianteEnActividad.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 400, error: { detail: 'La nota debe estar entre 1.00 y 10.00.' } })),
      );
      await escribirNota('8');
      component.guardar();
      fixture.detectChanges();

      expect(dialogo()).not.toBeNull();
      expect(dom().querySelector('#nota-error')?.textContent).toContain('entre 1.00 y 10.00');
    });
  });

  describe('delivery content in the dialog', () => {
    beforeEach(async () => {
      await crear();
    });

    it('shows the file, link and text of the delivery when the student delivered', async () => {
      component.abrirModal(filas[0]);
      fixture.detectChanges();
      await fixture.whenStable();

      const texto = dialogo()!.textContent!;
      expect(texto).toContain('Ver archivo entregado');
      expect(texto).toContain('Abrir enlace entregado');
      expect(texto).toContain('Adjunto mi trabajo');
    });

    it('shows no delivery content for a student without delivery', async () => {
      component.abrirModal(filas[2]);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(dialogo()!.textContent).not.toContain('Ver archivo entregado');
    });

    it('prefills the grade of an already graded student', async () => {
      component.abrirModal(filas[4]);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(Number(inputNota().value)).toBe(9);
    });
  });

  describe('load errors', () => {
    it('shows the server message and no list when the follow-up fails', async () => {
      getSeguimiento.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 403, error: { detail: 'No tienes permiso para ver esta actividad.' } })),
      );
      await crear();

      expect(dom().querySelector('[role="alert"]')!.textContent).toContain('No tienes permiso');
      expect(filasDom().length).toBe(0);
    });

    it('still lists the students when only the delivery detail fails to load', async () => {
      getEntregas.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      await crear();

      expect(filasDom().length).toBe(5);
    });
    it('offers a retry on the initial load error and recovers the list', async () => {
      getSeguimiento.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
      await crear();
      expect(filasDom().length).toBe(0);

      dom().querySelector<HTMLButtonElement>('[data-testid="reintentar"]')!.click();
      fixture.detectChanges();

      expect(filasDom().length).toBe(5);
      expect(dom().querySelector('[data-testid="reintentar"]')).toBeNull();
    });
  });

  describe('failed reload after a successful save', () => {
    beforeEach(async () => {
      await crear();
      component.abrirModal(filas[1]);
      fixture.detectChanges();
      await fixture.whenStable();
      await escribirNota('8');
    });

    it('keeps the stale list, shows an error toast and no blocking error', () => {
      const toast = TestBed.inject(ToastService);
      const toastError = vi.spyOn(toast, 'error');
      getSeguimiento.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

      component.guardar();
      fixture.detectChanges();

      expect(calificarEstudianteEnActividad).toHaveBeenCalled();
      expect(toastError).toHaveBeenCalled();
      expect(component.errorCarga()).toBe('');
      expect(filasDom().length).toBe(5);
    });

    it('offers a retry that reloads the list', () => {
      getSeguimiento.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      component.guardar();
      fixture.detectChanges();

      const reintentar = dom().querySelector<HTMLButtonElement>('[data-testid="reintentar"]')!;
      expect(reintentar).not.toBeNull();
      getSeguimiento.mockReturnValue(of(seguimiento));
      reintentar.click();
      fixture.detectChanges();

      expect(getSeguimiento).toHaveBeenCalledTimes(3);
      expect(dom().querySelector('[data-testid="reintentar"]')).toBeNull();
      expect(filasDom().length).toBe(5);
    });
  });

  describe('delivery content that fails to load', () => {
    it('shows an inline notice in the grading dialog instead of silently omitting the content', async () => {
      getEntregas.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      await crear();
      component.abrirModal(filas[0]);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(dialogo()!.textContent).toContain('No se pudo cargar el contenido de la entrega');
      expect(dialogo()!.querySelector('[data-testid="aviso-entrega"]')!.getAttribute('role')).toBe('alert');
      expect(dialogo()!.textContent).not.toContain('Ver archivo entregado');
    });

    it('does not show the notice when the content loaded', async () => {
      await crear();
      component.abrirModal(filas[0]);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(dialogo()!.textContent).not.toContain('No se pudo cargar el contenido de la entrega');
    });
  });
});
