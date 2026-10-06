import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ConfirmDialogService } from '../../../../services/confirm-dialog.service';

import { UnidadesMaterial } from './unidades-material';
import { AuthService } from '../../../../core/auth/auth.service';
import { ToastService } from '../../../../services/toast.service';
import { UnidadesService } from '../../../../services/unidades.service';
import { MaterialesService } from '../../../../services/materiales.service';

describe('UnidadesMaterial', () => {
  let component: UnidadesMaterial;
  let fixture: ComponentFixture<UnidadesMaterial>;
  let unidadesService: { obtenerUnidadesPorMateria: any; crearUnidad: any; actualizarUnidad: any; eliminarUnidad: any };
  let materialesService: {
    crearMaterial: any;
    eliminarMaterial: any;
    actualizarMaterial: any;
    obtenerMaterialesPorUnidad: any;
  };
  let toast: { success: any; error: any };
  let confirmDialog: { confirmar: any };

  beforeEach(async () => {
    unidadesService = {
      obtenerUnidadesPorMateria: vi.fn().mockReturnValue(of([])),
      crearUnidad: vi.fn(),
      actualizarUnidad: vi.fn(),
      eliminarUnidad: vi.fn().mockReturnValue(of({})),
    };
    materialesService = {
      crearMaterial: vi.fn(),
      eliminarMaterial: vi.fn().mockReturnValue(of({})),
      actualizarMaterial: vi.fn(),
      obtenerMaterialesPorUnidad: vi.fn().mockReturnValue(of([])),
    };
    toast = { success: vi.fn(), error: vi.fn() };
    confirmDialog = { confirmar: vi.fn().mockReturnValue(of(true)) };

    await TestBed.configureTestingModule({
      imports: [UnidadesMaterial],
      providers: [
        { provide: UnidadesService, useValue: unidadesService },
        { provide: MaterialesService, useValue: materialesService },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmDialogService, useValue: confirmDialog },
        { provide: AuthService, useValue: { currentUser: () => ({ rolNombre: 'Profesor' }) } },
        {
          provide: ActivatedRoute,
          useValue: { pathFromRoot: [{ snapshot: { paramMap: new Map([['id', '1']]) } }] },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UnidadesMaterial);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('calls crearUnidad only once when guardarUnidad is invoked twice while pending', () => {
    const pending = new Subject<unknown>();
    unidadesService.crearUnidad.mockReturnValue(pending);
    component.nuevoNombreUnidad = 'Unidad 1';

    component.guardarUnidad();
    component.guardarUnidad();

    expect(unidadesService.crearUnidad).toHaveBeenCalledTimes(1);
    expect(component.guardando()).toBe(true);

    pending.next({});
    pending.complete();
    expect(component.guardando()).toBe(false);
  });

  it('disables the save button and shows "Guardando..." while pending', () => {
    unidadesService.crearUnidad.mockReturnValue(new Subject<unknown>());
    component.abrirFormularioUnidad();
    component.nuevoNombreUnidad = 'Unidad 1';
    fixture.detectChanges();

    component.guardarUnidad();
    fixture.detectChanges();

    const submit = fixture.nativeElement.querySelector(
      'form button[type="submit"]',
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(submit.textContent).toContain('Guardando...');
  });

  it('re-enables saving after an error', () => {
    unidadesService.crearUnidad.mockReturnValueOnce(throwError(() => new Error('boom')));
    component.nuevoNombreUnidad = 'Unidad 1';

    component.guardarUnidad();

    expect(component.guardando()).toBe(false);
    expect(toast.error).toHaveBeenCalled();

    unidadesService.crearUnidad.mockReturnValueOnce(of({}));
    component.guardarUnidad();
    expect(unidadesService.crearUnidad).toHaveBeenCalledTimes(2);
  });

  it('calls crearMaterial only once when guardarRecurso is invoked twice while pending', () => {
    const pending = new Subject<unknown>();
    materialesService.crearMaterial.mockReturnValue(pending);
    component.nuevoTituloRecurso = 'Guia 1';

    component.guardarRecurso();
    component.guardarRecurso();

    expect(materialesService.crearMaterial).toHaveBeenCalledTimes(1);
    expect(component.guardando()).toBe(true);

    pending.error(new Error('boom'));
    expect(component.guardando()).toBe(false);
  });

  it('opens the unit form in an accessible modal labelled by its title', () => {
    component.abrirFormularioUnidad();
    fixture.detectChanges();

    const dialogo = fixture.nativeElement.querySelector('[role="dialog"][aria-modal="true"]') as HTMLElement;
    expect(dialogo).not.toBeNull();
    const titulo = fixture.nativeElement.querySelector(`#${dialogo.getAttribute('aria-labelledby')}`);
    expect(titulo.textContent).toContain('Crear Nueva Unidad');
  });

  it('closes the unit form with Escape and without saving', () => {
    component.abrirFormularioUnidad();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();

    expect(component.mostrarFormularioUnidad()).toBe(false);
    expect(unidadesService.crearUnidad).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('asks with the app dialog before deleting a unit, using the same text', () => {
    component.eliminarUnidad('u1', new Event('click'));
    expect(confirmDialog.confirmar).toHaveBeenCalledWith('¿Estás seguro de eliminar esta unidad y sus contenidos?');
    expect(unidadesService.eliminarUnidad).toHaveBeenCalledWith('u1');
  });

  it('does not delete the unit when the teacher cancels', () => {
    confirmDialog.confirmar.mockReturnValue(of(false));
    component.eliminarUnidad('u1', new Event('click'));
    expect(unidadesService.eliminarUnidad).not.toHaveBeenCalled();
  });

  it('asks before deleting a material and cancels without deleting', () => {
    confirmDialog.confirmar.mockReturnValue(of(false));
    component.eliminarMaterial(3, { contenidos: [] } as any);
    expect(confirmDialog.confirmar).toHaveBeenCalledWith('¿Estás seguro de que deseas eliminar este material?');
    expect(materialesService.eliminarMaterial).not.toHaveBeenCalled();

    confirmDialog.confirmar.mockReturnValue(of(true));
    component.eliminarMaterial(3, { contenidos: [] } as any);
    expect(materialesService.eliminarMaterial).toHaveBeenCalledWith(3);
  });
});
