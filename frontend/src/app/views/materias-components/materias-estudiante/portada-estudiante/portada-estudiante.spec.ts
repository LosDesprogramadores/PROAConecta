import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortadaEstudiante } from './portada-estudiante';
import { AuthService } from '../../../../core/auth/auth.service';
import { MateriaService } from '../../../../services/materia.service';
import { UnidadesService } from '../../../../services/unidades.service';
import { MaterialesService } from '../../../../services/materiales.service';

describe('PortadaEstudiante', () => {
  let component: PortadaEstudiante;
  let fixture: ComponentFixture<PortadaEstudiante>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PortadaEstudiante],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PortadaEstudiante);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('PortadaEstudiante - Material reachable from the navbar Portada link', () => {
  const paramMap = convertToParamMap({ id: '7' });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PortadaEstudiante],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { currentUser: signal({ rolId: 3, rolNombre: 'Estudiante' }) } },
        { provide: MateriaService, useValue: { obtenerMateriaPorId: () => of({ titulo: 'Matemática', anio: 2026, curso: '1A' }) } },
        {
          provide: UnidadesService,
          useValue: { obtenerUnidadesPorMateria: () => of([{ id: 1, orden: 1, titulo: 'Números', descripcion: '', visible: true }]) },
        },
        { provide: MaterialesService, useValue: { obtenerMaterialesPorUnidad: () => of([]), obtenerMaterialesGenerales: () => of([]) } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap }, parent: null, pathFromRoot: [{ snapshot: { paramMap } }] },
        },
      ],
    }).compileComponents();
  });

  it('renders the unidades-material section with keyboard-accessible toggle buttons', async () => {
    const fixture = TestBed.createComponent(PortadaEstudiante);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('app-unidades-material')).not.toBeNull();

    const boton = host.querySelector<HTMLButtonElement>('app-unidades-material h3 button')!;
    expect(boton.textContent!.trim()).toBe('Números');
    // A native <button> is focusable and activated with Enter/Space; it must not submit or be skipped by Tab
    expect(boton.tagName).toBe('BUTTON');
    expect(boton.type).toBe('button');
    expect(boton.tabIndex).toBeGreaterThanOrEqual(0);
    expect(boton.getAttribute('aria-expanded')).toBe('false');

    boton.click();
    fixture.detectChanges();
    expect(boton.getAttribute('aria-expanded')).toBe('true');
  });
});
