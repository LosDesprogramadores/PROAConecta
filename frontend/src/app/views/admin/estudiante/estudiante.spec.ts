import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Estudiante } from './estudiante';
import { EstudianteService } from '../../../services/estudiante.service';
import { MateriaService } from '../../../services/materia.service';

describe('Estudiante admin form accessibility', () => {
  let fixture: ComponentFixture<Estudiante>;
  let component: Estudiante;
  const dom = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Estudiante],
      providers: [
        provideRouter([]),
        { provide: EstudianteService, useValue: { obtenerEstudiates: vi.fn(() => of([])) } },
        { provide: MateriaService, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Estudiante);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.openCreateModal();
    fixture.detectChanges();
  });

  it('associates every field with its label through for/id', () => {
    const campos = dom().querySelectorAll<HTMLElement>('form [formControlName]');
    expect(campos.length).toBe(6);
    campos.forEach((campo) => {
      const etiqueta = dom().querySelector(`label[for="${campo.id}"]`);
      expect(campo.id, 'the field has an id').not.toBe('');
      expect(etiqueta, `label for #${campo.id}`).not.toBeNull();
    });
  });

  it('uses unique ids', () => {
    const ids = Array.from(dom().querySelectorAll('form [id]')).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not flag fields before the user touches them', () => {
    expect(dom().querySelector('form [aria-invalid]')).toBeNull();
    expect(dom().querySelector('form [role="alert"]')).toBeNull();
  });

  it('links the error text to the invalid field with aria-describedby', () => {
    const campo = dom().querySelector<HTMLInputElement>('#est-nombre')!;
    campo.dispatchEvent(new Event('blur'));
    component.form.get('nombre')!.markAsTouched();
    fixture.detectChanges();

    expect(campo.getAttribute('aria-invalid')).toBe('true');
    const idError = campo.getAttribute('aria-describedby')!;
    const mensaje = dom().querySelector(`#${idError}`)!;
    expect(mensaje.getAttribute('role')).toBe('alert');
    expect(mensaje.textContent).toContain('obligatorio');
  });

  it('removes the error link once the field is valid', () => {
    const campo = dom().querySelector<HTMLInputElement>('#est-nombre')!;
    component.form.get('nombre')!.markAsTouched();
    fixture.detectChanges();
    component.form.get('nombre')!.setValue('valor');
    fixture.detectChanges();
    expect(campo.getAttribute('aria-invalid')).toBeNull();
    expect(campo.getAttribute('aria-describedby')).toBeNull();
  });

  it('renders the form inside an accessible modal dialog', () => {
    const dialogo = dom().querySelector('[role="dialog"][aria-modal="true"]')!;
    expect(dialogo).not.toBeNull();
    expect(dialogo.querySelector('form')).not.toBeNull();
    expect(dom().querySelector(`#${dialogo.getAttribute('aria-labelledby')}`)?.textContent).toContain('Registrar');
  });

  it('closes the modal with Escape', () => {
    dom().querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(component.isModalOpen()).toBe(false);
    expect(dom().querySelector('[role="dialog"]')).toBeNull();
  });
});
