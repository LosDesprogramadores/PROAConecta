import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfirmDialogService } from '../../../services/confirm-dialog.service';
import { MateriaService } from '../../../services/materia.service';
import { ToastService } from '../../../services/toast.service';
import { Materia } from './materia';

describe('Materia (admin)', () => {
  let fixture: ComponentFixture<Materia>;
  let component: Materia;
  let materiaService: { listarPaginado: any; eliminarMateria: any; crearMateria: any; actualizarMateria: any };
  let confirmDialog: { confirmar: any };
  let toast: { success: any; error: any; info: any; readable_message_extraction: any };

  const materias = [{ id: 1, titulo: 'Matemática', curso: '1A', anio: 2026 }];
  const pagina = (results: unknown[], count = results.length) => ({ count, next: null, previous: null, results });

  beforeEach(async () => {
    materiaService = {
      listarPaginado: vi.fn(() => of(pagina(materias))),
      eliminarMateria: vi.fn(() => of(undefined)),
      crearMateria: vi.fn(),
      actualizarMateria: vi.fn(),
    };
    confirmDialog = { confirmar: vi.fn(() => of(true)) };
    toast = {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      readable_message_extraction: vi.fn(() => 'No se puede eliminar: tiene inscripciones.'),
    };

    await TestBed.configureTestingModule({
      imports: [Materia],
      providers: [
        { provide: MateriaService, useValue: materiaService },
        { provide: ConfirmDialogService, useValue: confirmDialog },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Materia);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads the subjects on init', () => {
    expect(component.materias()).toEqual(materias);
  });

  it('asks for confirmation with the app dialog and then deletes', () => {
    materiaService.listarPaginado.mockReturnValue(of(pagina([])));
    component.eliminar(1);
    expect(confirmDialog.confirmar).toHaveBeenCalledTimes(1);
    expect(materiaService.eliminarMateria).toHaveBeenCalledWith(1);
    expect(component.materias()).toEqual([]);
    expect(toast.success).toHaveBeenCalled();
  });

  it('does not delete when the admin cancels', () => {
    confirmDialog.confirmar.mockReturnValue(of(false));
    component.eliminar(1);
    expect(materiaService.eliminarMateria).not.toHaveBeenCalled();
    expect(component.materias()).toEqual(materias);
  });

  it('shows the server reason in a toast when the delete fails with 409', () => {
    const conflicto = new HttpErrorResponse({ status: 409, error: { detail: 'tiene inscripciones' } });
    materiaService.eliminarMateria.mockReturnValue(throwError(() => conflicto));
    component.eliminar(1);
    expect(toast.readable_message_extraction).toHaveBeenCalledWith(conflicto);
    expect(toast.error).toHaveBeenCalledWith('No se puede eliminar: tiene inscripciones.');
    expect(component.materias()).toEqual(materias);
  });

  it('shows a toast when loading the subjects fails', () => {
    materiaService.listarPaginado.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    component.cargarMaterias();
    expect(toast.error).toHaveBeenCalled();
    expect(component.isLoading()).toBe(false);
  });

  it('asks the server for the first page of 20', () => {
    expect(materiaService.listarPaginado).toHaveBeenCalledWith({ page: 1, page_size: 20 });
    expect(component.total()).toBe(1);
  });

  it('shows the pager only when there is more than one page and loads the chosen page', () => {
    expect(fixture.nativeElement.querySelector('app-paginador')).toBeNull();

    materiaService.listarPaginado.mockReturnValue(of(pagina(materias, 45)));
    component.cargarMaterias(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Página 1 de 3');

    component.cargarMaterias(2);
    expect(materiaService.listarPaginado).toHaveBeenLastCalledWith({ page: 2, page_size: 20 });
    expect(component.pagina()).toBe(2);
  });

  it('falls back to the previous page when the current one empties out', () => {
    materiaService.listarPaginado.mockReturnValueOnce(of(pagina([], 20)));
    materiaService.listarPaginado.mockReturnValue(of(pagina(materias, 20)));
    component.cargarMaterias(2);
    expect(materiaService.listarPaginado).toHaveBeenLastCalledWith({ page: 1, page_size: 20 });
    expect(component.pagina()).toBe(1);
  });

  it('reloads the current page after a delete instead of editing the local list', () => {
    materiaService.listarPaginado.mockClear();
    component.eliminar(1);
    expect(materiaService.listarPaginado).toHaveBeenCalledTimes(1);
  });

  it('after creating a subject it jumps to the last page, where the new row appears', () => {
    materiaService.listarPaginado.mockReturnValue(of(pagina(materias, 40)));
    component.cargarMaterias(1);
    materiaService.crearMateria.mockReturnValue(of({ id: 9 }));
    materiaService.listarPaginado.mockClear();

    component.openCreateModal();
    component.form.patchValue({ titulo: 'X', curso: '1A', anio: 2026 });
    component.save();

    expect(materiaService.listarPaginado).toHaveBeenCalledWith({ page: 3, page_size: 20 });
  });

  it('shows a toast when saving fails', () => {
    materiaService.crearMateria.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400 })));
    component.openCreateModal();
    component.form.patchValue({ titulo: 'X', curso: '1A', anio: 2026 });
    component.save();
    expect(toast.error).toHaveBeenCalled();
  });
});

describe('Materia admin form accessibility', () => {
  let fixture: ComponentFixture<Materia>;
  let component: Materia;
  const dom = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Materia],
      providers: [{ provide: MateriaService, useValue: { listarPaginado: () => of({ count: 0, next: null, previous: null, results: [] }) } }],
    }).compileComponents();
    fixture = TestBed.createComponent(Materia);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.openCreateModal();
    fixture.detectChanges();
  });

  it('associates every field with its label through for/id', () => {
    const campos = dom().querySelectorAll<HTMLElement>('form [formControlName]');
    expect(campos.length).toBe(6);
    campos.forEach((campo) => {
      expect(campo.id).not.toBe('');
      expect(dom().querySelector(`label[for="${campo.id}"]`), `label for #${campo.id}`).not.toBeNull();
    });
  });

  it('flags the invalid field and links its message with aria-describedby', () => {
    const campo = dom().querySelector<HTMLInputElement>('#mat-titulo')!;
    expect(campo.getAttribute('aria-invalid')).toBeNull();
    component.form.get('titulo')!.markAsTouched();
    fixture.detectChanges();
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    const mensaje = dom().querySelector(`#${campo.getAttribute('aria-describedby')}`)!;
    expect(mensaje.getAttribute('role')).toBe('alert');
    expect(mensaje.textContent).toContain('obligatorio');
  });

  it('keeps the Discord webhook message in Spanish', () => {
    const control = component.form.get('discord_webhook_url')!;
    control.setValue('http://nope');
    control.markAsTouched();
    fixture.detectChanges();
    expect(dom().querySelector('#mat-discord_webhook_url-error')?.textContent).toContain('webhook de Discord');
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
