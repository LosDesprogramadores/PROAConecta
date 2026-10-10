import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { ConfirmDialogService } from '../../../services/confirm-dialog.service';
import { EstudianteService } from '../../../services/estudiante.service';
import { InscripcionesService } from '../../../services/inscripciones.service';
import { MateriaService } from '../../../services/materia.service';
import { ProfesorService } from '../../../services/profesor.service';
import { ToastService } from '../../../services/toast.service';
import { Materia } from './materia';

const serviciosDePersonas = [
  { provide: ProfesorService, useValue: { obtenerProfesores: () => of([]) } },
  { provide: EstudianteService, useValue: { obtenerEstudiates: () => of([]) } },
  { provide: InscripcionesService, useValue: { inscribirEstudiantesEnMateria: () => of({}) } },
];

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
        ...serviciosDePersonas,
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
        ...serviciosDePersonas,
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

describe('Materia (admin) asignar e inscribir', () => {
  let fixture: ComponentFixture<Materia>;
  let component: Materia;
  let materiaService: Record<'listarPaginado' | 'obtenerAlumnos' | 'asignarProfesorAMaterias' | 'desasignarProfesor', Mock>;
  let inscripciones: Record<'inscribirEstudiantesEnMateria', Mock>;
  let profesorService: { obtenerProfesores: Mock };
  let estudianteService: { obtenerEstudiates: Mock };
  let toast: Record<'success' | 'error' | 'info' | 'warning', Mock> & { readable_message_extraction: Mock };
  const dom = () => fixture.nativeElement as HTMLElement;

  const persona = (id: number, apellido: string) => ({ id, nombre: 'Nora', apellido, dni: `${id}`, email: `${apellido}@x.com`, fecha_nacimiento: '2000-01-01', tel_contacto: '' });
  const profesores = [persona(7, 'Gómez'), persona(8, 'Lima')];
  const estudiantes = [persona(1, 'Pérez'), persona(2, 'Ruiz'), persona(3, 'Sosa')];
  const materia = { id: 5, titulo: 'Física', curso: '3A', anio: 2026, profesor: 7, profesor_detalle: { ...persona(7, 'Gómez'), nombre_completo: 'Nora Gómez', rol_nombre: 'Profesor' } };

  beforeEach(async () => {
    materiaService = {
      listarPaginado: vi.fn(() => of({ count: 1, next: null, previous: null, results: [materia] })),
      obtenerAlumnos: vi.fn(() => of([{ inscripcion_id: 1, persona_id: 1, apellido: 'Pérez', nombre: 'Nora', email: 'p@x.com', estado: 'CURSANDO', fecha_inscripcion: '2026-03-01' }])),
      asignarProfesorAMaterias: vi.fn(() => of({ mensaje: 'ok', profesor_id: 8, materia_ids: [5] })),
      desasignarProfesor: vi.fn(() => of({ detail: 'ok' })),
    };
    inscripciones = { inscribirEstudiantesEnMateria: vi.fn(() => of({ mensaje: 'ok', materia_id: 5, cantidad: 2, omitidos: [] })) };
    profesorService = { obtenerProfesores: vi.fn(() => of(profesores)) };
    estudianteService = { obtenerEstudiates: vi.fn(() => of(estudiantes)) };
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), readable_message_extraction: vi.fn(() => 'Error del servidor.') };

    await TestBed.configureTestingModule({
      imports: [Materia],
      providers: [
        { provide: MateriaService, useValue: materiaService },
        { provide: ConfirmDialogService, useValue: { confirmar: () => of(true) } },
        { provide: ToastService, useValue: toast },
        { provide: ProfesorService, useValue: profesorService },
        { provide: EstudianteService, useValue: estudianteService },
        { provide: InscripcionesService, useValue: inscripciones },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Materia);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('asignar', () => {
    it('lists the professors that are not already the titular', () => {
      component.asignar(materia);
      fixture.detectChanges();

      expect(component.profesoresDisponibles().map((p) => p.id)).toEqual([8]);
      const modal = dom().querySelector('[role="dialog"]')!;
      expect(modal.textContent).toContain('Física');
      expect(modal.querySelector('input[type="radio"][aria-label="Seleccionar Lima, Nora"]')).not.toBeNull();
      expect(modal.querySelector('input[type="radio"][aria-label="Seleccionar Gómez, Nora"]')).toBeNull();
    });

    it('keeps the confirm button disabled until a professor is chosen', () => {
      component.asignar(materia);
      fixture.detectChanges();
      const confirmar = dom().querySelector<HTMLButtonElement>('[data-testid="confirmar-asignacion"]')!;
      expect(confirmar.disabled).toBe(true);

      component.elegirProfesor(8);
      fixture.detectChanges();
      expect(confirmar.disabled).toBe(false);
    });

    it('assigns the chosen professor, reloads the list and closes the modal', () => {
      component.asignar(materia);
      component.elegirProfesor(8);
      materiaService.listarPaginado.mockClear();

      component.guardarAsignacion();

      expect(materiaService.asignarProfesorAMaterias).toHaveBeenCalledWith(8, [5]);
      expect(toast.success).toHaveBeenCalled();
      expect(materiaService.listarPaginado).toHaveBeenCalledTimes(1);
      expect(component.materiaParaAsignar()).toBeNull();
    });

    it('refreshes the open consulta panel with the new titular', () => {
      component.consultar(materia);
      const actualizada = { ...materia, profesor: 8, profesor_detalle: { ...materia.profesor_detalle, id: 8, apellido: 'Lima' } };
      materiaService.listarPaginado.mockReturnValue(of({ count: 1, next: null, previous: null, results: [actualizada] }));
      component.asignar(materia);
      component.elegirProfesor(8);
      component.guardarAsignacion();
      fixture.detectChanges();

      expect(dom().querySelector('[data-testid="panel-consulta"]')!.textContent).toContain('Lima, Nora');
    });

    it('keeps the modal open and shows the error when the assignment fails', () => {
      materiaService.asignarProfesorAMaterias.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400 })));
      component.asignar(materia);
      component.elegirProfesor(8);
      component.guardarAsignacion();

      expect(toast.error).toHaveBeenCalledWith('Error del servidor.');
      expect(component.materiaParaAsignar()).not.toBeNull();
    });

    it('removes the titular with the desasignar endpoint', () => {
      component.asignar(materia);
      component.quitarTitular();
      expect(materiaService.desasignarProfesor).toHaveBeenCalledWith(5);
      expect(component.materiaParaAsignar()).toBeNull();
    });

    it('keeps the modal open and shows a toast when removing the titular fails', () => {
      materiaService.desasignarProfesor.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      component.asignar(materia);
      component.quitarTitular();

      expect(toast.error).toHaveBeenCalledWith('Error del servidor.');
      expect(component.materiaParaAsignar()).not.toBeNull();
      expect(component.guardandoAsignacion()).toBe(false);
    });

    it('wraps the professors in a fieldset with an accessible legend', () => {
      component.asignar(materia);
      fixture.detectChanges();
      const fieldset = dom().querySelector('[role="dialog"] fieldset')!;
      expect(fieldset.querySelector('legend.sr-only')!.textContent).toContain('Profesor titular');
      expect(fieldset.querySelector('input[type="radio"]')).not.toBeNull();
    });

    it('ignores a second confirm click while the assignment is running', () => {
      const pendiente = new Subject<unknown>();
      materiaService.asignarProfesorAMaterias.mockReturnValue(pendiente);
      component.asignar(materia);
      component.elegirProfesor(8);

      component.guardarAsignacion();
      component.guardarAsignacion();
      fixture.detectChanges();

      expect(materiaService.asignarProfesorAMaterias).toHaveBeenCalledTimes(1);
      expect(dom().querySelector<HTMLButtonElement>('[data-testid="confirmar-asignacion"]')!.disabled).toBe(true);
      expect(dom().querySelector<HTMLButtonElement>('[data-testid="quitar-titular"]')!.disabled).toBe(true);

      pendiente.next({});
      pendiente.complete();
      expect(component.guardandoAsignacion()).toBe(false);
    });

    it('ignores a second click on "Quitar titular" while the request is running', () => {
      const pendiente = new Subject<unknown>();
      materiaService.desasignarProfesor.mockReturnValue(pendiente);
      component.asignar(materia);

      component.quitarTitular();
      component.quitarTitular();

      expect(materiaService.desasignarProfesor).toHaveBeenCalledTimes(1);
      pendiente.next({});
      pendiente.complete();
      expect(component.guardandoAsignacion()).toBe(false);
    });

    it('re-enables the buttons after a failed assignment', () => {
      materiaService.asignarProfesorAMaterias.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400 })));
      component.asignar(materia);
      component.elegirProfesor(8);
      component.guardarAsignacion();
      expect(component.guardandoAsignacion()).toBe(false);
    });

    it('shows an error with a retry button, not the empty message, when the professors cannot be loaded', () => {
      profesorService.obtenerProfesores.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
      component.asignar(materia);
      fixture.detectChanges();

      const modal = dom().querySelector('[role="dialog"]')!;
      expect(modal.querySelector('[role="alert"]')!.textContent).toContain('No se pudieron cargar los profesores');
      expect(modal.textContent).not.toContain('No hay otros profesores disponibles');

      Array.from(modal.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Reintentar')!.click();
      fixture.detectChanges();

      expect(profesorService.obtenerProfesores).toHaveBeenCalledTimes(2);
      expect(component.errorProfesores()).toBe(false);
      expect(dom().querySelector('[role="dialog"] input[type="radio"]')).not.toBeNull();
    });

    it('shows the empty message when there are simply no professors', () => {
      profesorService.obtenerProfesores.mockReturnValueOnce(of([]));
      component.asignar(materia);
      fixture.detectChanges();
      const modal = dom().querySelector('[role="dialog"]')!;
      expect(modal.textContent).toContain('No hay otros profesores disponibles');
      expect(modal.querySelector('[role="alert"]')).toBeNull();
    });
  });

  describe('inscribir', () => {
    it('excludes the students already enrolled', () => {
      component.inscribir(materia);
      fixture.detectChanges();

      expect(materiaService.obtenerAlumnos).toHaveBeenCalledWith(5);
      expect(component.estudiantesDisponibles().map((e) => e.id)).toEqual([2, 3]);
      expect(dom().querySelector('input[aria-label="Seleccionar Ruiz, Nora"]')).not.toBeNull();
      expect(dom().querySelector('input[aria-label="Seleccionar Pérez, Nora"]')).toBeNull();
    });

    it('filters by text over name, surname and email', () => {
      component.inscribir(materia);
      component.filtroEstudiantes.set('sos');
      expect(component.estudiantesFiltrados().map((e) => e.id)).toEqual([3]);
    });

    it('sends the selected ids and shows the result', () => {
      component.inscribir(materia);
      component.toggleEstudiante(2);
      component.toggleEstudiante(3);
      materiaService.listarPaginado.mockClear();

      component.guardarInscripcion();

      expect(inscripciones.inscribirEstudiantesEnMateria).toHaveBeenCalledWith(5, [2, 3]);
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('2'));
      expect(component.materiaParaInscribir()).toBeNull();
      expect(materiaService.listarPaginado).toHaveBeenCalledTimes(1);
    });

    it('reports the skipped students', () => {
      inscripciones.inscribirEstudiantesEnMateria.mockReturnValue(of({ mensaje: 'ok', materia_id: 5, cantidad: 1, omitidos: [3] }));
      component.inscribir(materia);
      component.toggleEstudiante(2);
      component.toggleEstudiante(3);
      component.guardarInscripcion();

      expect(toast.warning).toHaveBeenCalledWith('1 estudiante ya estaba inscripto y fue omitido.');
    });

    it('selects and clears all the filtered students', () => {
      component.inscribir(materia);
      component.seleccionarTodosEstudiantes();
      expect(component.estudiantesSeleccionados()).toEqual([2, 3]);
      component.seleccionarTodosEstudiantes();
      expect(component.estudiantesSeleccionados()).toEqual([]);
    });

    it('does not send anything without a selection', () => {
      component.inscribir(materia);
      component.guardarInscripcion();
      expect(inscripciones.inscribirEstudiantesEnMateria).not.toHaveBeenCalled();
    });

    it('keeps the modal and the selection when the server answers 400', () => {
      inscripciones.inscribirEstudiantesEnMateria.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { estudiante_ids: ['Máximo 200.'] } })));
      component.inscribir(materia);
      component.toggleEstudiante(2);
      component.guardarInscripcion();

      expect(toast.error).toHaveBeenCalledWith('Error del servidor.');
      expect(component.materiaParaInscribir()).not.toBeNull();
      expect(component.estudiantesSeleccionados()).toEqual([2]);
      expect(component.isGuardando()).toBe(false);
    });

    it('shows an error with a retry button, not the empty message, when the students cannot be loaded', () => {
      materiaService.obtenerAlumnos.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
      component.inscribir(materia);
      fixture.detectChanges();

      const modal = dom().querySelector('[role="dialog"]')!;
      expect(component.isLoadingEstudiantes()).toBe(false);
      expect(modal.querySelector('[role="alert"]')!.textContent).toContain('No se pudieron cargar los estudiantes');
      expect(modal.textContent).not.toContain('No hay estudiantes disponibles');

      Array.from(modal.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Reintentar')!.click();
      fixture.detectChanges();

      expect(component.errorEstudiantes()).toBe(false);
      expect(dom().querySelector('input[aria-label="Seleccionar Ruiz, Nora"]')).not.toBeNull();
    });

    it('shows the empty message when every student is already enrolled', () => {
      estudianteService.obtenerEstudiates.mockReturnValueOnce(of([persona(1, 'Pérez')]));
      component.inscribir(materia);
      fixture.detectChanges();
      const modal = dom().querySelector('[role="dialog"]')!;
      expect(modal.textContent).toContain('No hay estudiantes disponibles para inscribir');
      expect(modal.querySelector('[role="alert"]')).toBeNull();
    });

    it('shows the selected counter', () => {
      component.inscribir(materia);
      component.toggleEstudiante(2);
      fixture.detectChanges();
      expect(dom().querySelector('[data-testid="contador-seleccionados"]')!.textContent).toContain('1 seleccionados');
    });

    it('warns and disables the button when more than 200 students are selected', () => {
      component.inscribir(materia);
      component.estudiantesSeleccionados.set(Array.from({ length: 201 }, (_, i) => i + 1000));
      fixture.detectChanges();

      expect(dom().querySelector('[data-testid="aviso-limite"]')!.textContent).toContain('Podés inscribir hasta 200 estudiantes por vez');
      expect(dom().querySelector<HTMLButtonElement>('[data-testid="confirmar-inscripcion"]')!.disabled).toBe(true);
      component.guardarInscripcion();
      expect(inscripciones.inscribirEstudiantesEnMateria).not.toHaveBeenCalled();
    });

    it('allows exactly 200 students without a warning', () => {
      component.inscribir(materia);
      component.estudiantesSeleccionados.set(Array.from({ length: 200 }, (_, i) => i + 1000));
      fixture.detectChanges();

      expect(dom().querySelector('[data-testid="aviso-limite"]')).toBeNull();
      expect(dom().querySelector<HTMLButtonElement>('[data-testid="confirmar-inscripcion"]')!.disabled).toBe(false);
    });

    it('reports that nothing is selected-all when the list is empty', () => {
      estudianteService.obtenerEstudiates.mockReturnValueOnce(of([]));
      component.inscribir(materia);
      expect(component.estudiantesFiltrados()).toEqual([]);
      expect(component.todosSeleccionados()).toBe(false);
    });
  });

  it('shows the Asignar and Inscribir buttons on every row', () => {
    const texto = Array.from(dom().querySelectorAll('tbody button')).map((b) => b.textContent?.trim());
    expect(texto).toEqual(expect.arrayContaining(['Consultar', 'Asignar', 'Inscribir', 'Editar', 'Eliminar']));
  });
});

describe('Materia admin form accessibility', () => {
  let fixture: ComponentFixture<Materia>;
  let component: Materia;
  const dom = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Materia],
      providers: [{ provide: MateriaService, useValue: { listarPaginado: () => of({ count: 0, next: null, previous: null, results: [] }) } }, ...serviciosDePersonas],
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
