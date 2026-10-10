import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { ConfirmDialogService } from '../../../services/confirm-dialog.service';
import { MateriaService } from '../../../services/materia.service';
import { ToastService } from '../../../services/toast.service';
import { Materia } from './materia';

describe('Materia (admin)', () => {
  let fixture: ComponentFixture<Materia>;
  let component: Materia;
  let materiaService: { listarPaginado: any; eliminarMateria: any; crearMateria: any; actualizarMateria: any; obtenerAlumnos: any };
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
      obtenerAlumnos: vi.fn(() => of([])),
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

describe('Materia (admin) consultar y baja', () => {
  let fixture: ComponentFixture<Materia>;
  let component: Materia;
  let materiaService: Record<'listarPaginado' | 'eliminarMateria' | 'obtenerAlumnos', Mock>;
  const dom = () => fixture.nativeElement as HTMLElement;

  const profesor = { id: 7, dni: '1', nombre: 'Ana', apellido: 'Gómez', nombre_completo: 'Ana Gómez', email: 'a@x.com', rol_nombre: 'Profesor' };
  const conProfesor = { id: 1, titulo: 'Matemática', curso: '1A', anio: 2026, profesor: 7, profesor_detalle: profesor };
  const sinProfesor = { id: 2, titulo: 'Historia', curso: '2B', anio: 2026, profesor: null, profesor_detalle: null };
  const alumno = (id: number, apellido: string, estado = 'CURSANDO') =>
    ({ inscripcion_id: id, persona_id: id, apellido, nombre: 'Luis', email: `${apellido}@x.com`, estado, fecha_inscripcion: '2026-03-01' });

  beforeEach(async () => {
    materiaService = {
      listarPaginado: vi.fn(() => of({ count: 2, next: null, previous: null, results: [conProfesor, sinProfesor] })),
      eliminarMateria: vi.fn(),
      obtenerAlumnos: vi.fn(() => of([alumno(1, 'Pérez'), alumno(2, 'Ruiz', 'LIBRE')])),
    };
    await TestBed.configureTestingModule({
      imports: [Materia],
      providers: [
        { provide: MateriaService, useValue: materiaService },
        { provide: ConfirmDialogService, useValue: { confirmar: () => of(true) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Materia);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('no longer shows the "en desarrollo" stub toast', () => {
    const info = vi.spyOn(TestBed.inject(ToastService), 'info');
    component.consultar(conProfesor);
    expect(info).not.toHaveBeenCalled();
  });

  it('shows the titular professor and the enrolled students below the table', () => {
    component.consultar(conProfesor);
    fixture.detectChanges();

    expect(materiaService.obtenerAlumnos).toHaveBeenCalledWith(1);
    const panel = dom().querySelector('[data-testid="panel-consulta"]')!;
    expect(panel.textContent).toContain('Matemática');
    expect(panel.textContent).toContain('Gómez, Ana');
    expect(panel.textContent).toContain('Pérez, Luis');
    expect(panel.textContent).toContain('Ruiz, Luis');
    expect(panel.textContent).toContain('LIBRE');
  });

  it('shows empty states when there is no professor and no students', () => {
    materiaService.obtenerAlumnos.mockReturnValue(of([]));
    component.consultar(sinProfesor);
    fixture.detectChanges();

    const panel = dom().querySelector('[data-testid="panel-consulta"]')!;
    expect(panel.textContent).toContain('Sin profesor asignado');
    expect(panel.textContent).toContain('No hay estudiantes inscriptos');
  });

  it('shows an error state when the students cannot be loaded', () => {
    materiaService.obtenerAlumnos.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    component.consultar(conProfesor);
    fixture.detectChanges();

    expect(dom().querySelector('[data-testid="panel-consulta"]')!.textContent).toContain('No se pudieron cargar los estudiantes');
    expect(component.isLoadingConsulta()).toBe(false);
  });

  it('closes the panel from its close button', () => {
    component.consultar(conProfesor);
    fixture.detectChanges();
    dom().querySelector<HTMLButtonElement>('[data-testid="cerrar-consulta"]')!.click();
    fixture.detectChanges();
    expect(dom().querySelector('[data-testid="panel-consulta"]')).toBeNull();
  });

  it('toggles the panel when consulting the same subject twice', () => {
    component.consultar(conProfesor);
    component.consultar(conProfesor);
    expect(component.materiaConsultada()).toBeNull();
  });

  it('shows the exact server message when the delete is blocked with 400', () => {
    const mensaje = 'Esta materia tiene profesor o estudiantes, primero debe desasignarlos o desinscribirlos';
    materiaService.eliminarMateria.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { detail: mensaje } })));
    const toast = TestBed.inject(ToastService);
    const error = vi.spyOn(toast, 'error');
    materiaService.listarPaginado.mockClear();

    component.eliminar(1);

    expect(error).toHaveBeenCalledWith(mensaje);
    expect(materiaService.listarPaginado).not.toHaveBeenCalled();
    expect(component.materias().length).toBe(2);
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
