import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Profesor } from './profesor';
import { ProfesorService } from '../../../services/profesor.service';
import { MateriaService } from '../../../services/materia.service';

describe('Profesor admin form accessibility', () => {
  let fixture: ComponentFixture<Profesor>;
  let component: Profesor;
  const dom = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Profesor],
      providers: [
        provideRouter([]),
        { provide: ProfesorService, useValue: { obtenerProfesores: vi.fn(() => of([])) } },
        { provide: MateriaService, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Profesor);
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
    const campo = dom().querySelector<HTMLInputElement>('#prof-nombre')!;
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
    const campo = dom().querySelector<HTMLInputElement>('#prof-nombre')!;
    component.form.get('nombre')!.markAsTouched();
    fixture.detectChanges();
    component.form.get('nombre')!.setValue('valor');
    fixture.detectChanges();
    expect(campo.getAttribute('aria-invalid')).toBeNull();
    expect(campo.getAttribute('aria-describedby')).toBeNull();
  });
});
