import { importProvidersFrom, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../../core/auth/auth.service';
import { UserRole } from '../../../core/auth/auth.model';
import { MateriaService } from '../../../services/materia.service';
import { ToastService } from '../../../services/toast.service';
import { PortadaProfesor } from './portada-profesor';

const materia = { id: 7, titulo: 'Matemática I', descripcion: 'Descripción original', anio: 1, curso: 'A', profesor_detalle: null };

describe('PortadaProfesor', () => {
  let fixture: ComponentFixture<PortadaProfesor>;
  let component: PortadaProfesor;
  let materiaService: { obtenerMateriaPorId: ReturnType<typeof vi.fn>; actualizarMateria: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    materiaService = {
      obtenerMateriaPorId: vi.fn(() => of(materia)),
      actualizarMateria: vi.fn(() => of({ ...materia, descripcion: 'Nueva' })),
    };
    await TestBed.configureTestingModule({
      imports: [PortadaProfesor],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        importProvidersFrom(CalendarModule.forRoot({ provide: DateAdapter, useFactory: adapterFactory })),
        { provide: MateriaService, useValue: materiaService },
        { provide: AuthService, useValue: { currentUser: signal({ rolId: UserRole.DOCENTE }) } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { parent: null, paramMap: { get: () => '7' }, params: { id: '7' } },
            parent: { paramMap: of({ get: () => '7' }) },
            pathFromRoot: [{ snapshot: { paramMap: { has: () => true, get: () => '7' } } }],
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PortadaProfesor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load the subject', () => {
    expect(component).toBeTruthy();
    expect(materiaService.obtenerMateriaPorId).toHaveBeenCalledWith(7);
  });

  it('loads the current description into the reactive control to edit it', () => {
    component.iniciarEdicionDescripcion();
    expect(component.descripcionControl.value).toBe('Descripción original');
  });

  it('saves the trimmed description', () => {
    component.iniciarEdicionDescripcion();
    component.descripcionControl.setValue('  Nueva  ');
    component.guardarDescripcion();
    expect(materiaService.actualizarMateria).toHaveBeenCalledWith(7, expect.objectContaining({ descripcion: 'Nueva' }));
    expect(component.editandoDescripcion()).toBe(false);
  });

  it('adds a unit from the reactive form and resets it on the next open', () => {
    const antes = component.datosActuales.unidades.length;
    component.abrirFormularioUnidad();
    component.formularioUnidad.setValue({ nombre: '  Unidad 2 ', descripcion: ' Detalle ' });
    component.guardarUnidad();

    const nueva = component.datosActuales.unidades[antes];
    expect(nueva.nombre).toBe('Unidad 2');
    expect(nueva.descripcion).toBe('Detalle');
    expect(component.mostrarFormularioUnidad()).toBe(false);

    component.abrirFormularioUnidad();
    expect(component.formularioUnidad.getRawValue()).toEqual({ nombre: '', descripcion: '' });
  });

  it('does not add a unit without a name', () => {
    const warning = vi.spyOn(TestBed.inject(ToastService), 'warning').mockImplementation(() => undefined);
    const antes = component.datosActuales.unidades.length;
    component.abrirFormularioUnidad();
    component.guardarUnidad();
    expect(component.datosActuales.unidades.length).toBe(antes);
    expect(warning).toHaveBeenCalledWith('El nombre de la unidad es requerido');
  });
});
