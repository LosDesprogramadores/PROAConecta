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
  let materiaService: { obtenerMaterias: any; eliminarMateria: any; crearMateria: any; actualizarMateria: any };
  let confirmDialog: { confirmar: any };
  let toast: { success: any; error: any; info: any; readable_message_extraction: any };

  const materias = [{ id: 1, titulo: 'Matemática', curso: '1A', anio: 2026 }];

  beforeEach(async () => {
    materiaService = {
      obtenerMaterias: vi.fn(() => of(materias)),
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
    materiaService.obtenerMaterias.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    component.cargarMaterias();
    expect(toast.error).toHaveBeenCalled();
    expect(component.isLoading()).toBe(false);
  });

  it('shows a toast when saving fails', () => {
    materiaService.crearMateria.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400 })));
    component.openCreateModal();
    component.form.patchValue({ titulo: 'X', curso: '1A', anio: 2026 });
    component.save();
    expect(toast.error).toHaveBeenCalled();
  });
});
