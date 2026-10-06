import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActividadesService, Entrega } from '../../../services/actividades.service';
import { crearRutaFalsa } from '../../../testing/ruta-falsa';
import { ActividadEntregasComponent } from './actividad-entregas';

const entrega: Entrega = {
  id: 5,
  actividad: 1,
  estudiante: 30,
  estudiante_nombre: 'Ana Pérez',
  fecha_entrega: '2026-10-01T10:00:00Z',
  nota: null,
};

describe('ActividadEntregasComponent grading modal', () => {
  let fixture: ComponentFixture<ActividadEntregasComponent>;
  let component: ActividadEntregasComponent;
  let servicio: { getEntregas: any; calificarEntregaIndividual: any };
  const dom = () => fixture.nativeElement as HTMLElement;
  const dialogo = () => dom().querySelector<HTMLElement>('[role="dialog"]');
  const inputNota = () => dom().querySelector<HTMLInputElement>('#nota')!;

  async function escribirNota(valor: string) {
    const input = inputNota();
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    servicio = {
      getEntregas: vi.fn(() => of([entrega])),
      calificarEntregaIndividual: vi.fn(() => of({})),
    };
    await TestBed.configureTestingModule({
      imports: [ActividadEntregasComponent],
      providers: [
        { provide: ActividadesService, useValue: servicio },
        { provide: ActivatedRoute, useValue: { parent: null, snapshot: { paramMap: new Map([['id', '1']]) } } },
        { provide: Router, useValue: { url: '/dashboard/actividades/1/entregas', navigate: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ActividadEntregasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.abrirModal(entrega);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('opens the grading form in an accessible dialog named after the student', () => {
    expect(dialogo()?.getAttribute('aria-modal')).toBe('true');
    expect(dom().querySelector(`#${dialogo()!.getAttribute('aria-labelledby')}`)?.textContent).toContain('Ana Pérez');
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

    expect(servicio.calificarEntregaIndividual).not.toHaveBeenCalled();
    const error = dom().querySelector('#nota-error')!;
    expect(error.getAttribute('role')).toBe('alert');
    expect(error.textContent).toContain('entre 1 y 10');
    expect(inputNota().getAttribute('aria-invalid')).toBe('true');
    expect(inputNota().getAttribute('aria-describedby')).toBe('nota-error');
  });

  it('rejects a grade above 10', async () => {
    await escribirNota('10.5');
    component.guardar();
    expect(servicio.calificarEntregaIndividual).not.toHaveBeenCalled();
  });

  it('saves a valid grade with two decimals', async () => {
    await escribirNota('8.75');
    component.guardar();
    expect(servicio.calificarEntregaIndividual).toHaveBeenCalledWith(5, expect.objectContaining({ calificacion: 8.75 }));
    fixture.detectChanges();
    expect(dialogo()).toBeNull();
  });

  it('closes with Escape without saving', () => {
    dialogo()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(dialogo()).toBeNull();
    expect(servicio.calificarEntregaIndividual).not.toHaveBeenCalled();
  });

  it('shows the server detail when saving fails (for example the grade range)', async () => {
    servicio.calificarEntregaIndividual.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { detail: 'La nota debe estar entre 1.00 y 10.00.' } })),
    );
    await escribirNota('8');
    component.guardar();
    fixture.detectChanges();
    expect(dom().querySelector('#nota-error')?.textContent).toContain('entre 1.00 y 10.00');
  });
});

describe('ActividadEntregasComponent subscription cleanup', () => {
  it('stops listening to the parent route params once the view is destroyed', () => {
    const ruta = crearRutaFalsa({ id: '1' });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ActividadEntregasComponent],
      providers: [
        { provide: ActividadesService, useValue: { getEntregas: vi.fn(() => of([])) } },
        { provide: Router, useValue: { url: '/dashboard/actividades/1/entregas', navigate: vi.fn() } },
        ruta.provider,
      ],
    });
    const fixture = TestBed.createComponent(ActividadEntregasComponent);
    fixture.detectChanges();
    expect(ruta.observado()).toBe(true);

    fixture.destroy();

    expect(ruta.observado()).toBe(false);
  });
});
