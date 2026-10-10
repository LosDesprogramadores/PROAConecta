import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { InscripcionesService } from '../../../services/inscripciones.service';
import { Materias } from './materias';

describe('Materias', () => {
  let component: Materias;
  let fixture: ComponentFixture<Materias>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Materias]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Materias);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('Materias filtro de año', () => {
  const anio = new Date().getFullYear();
  const insc = (materia: number, materia_anio: number, fecha_inscripcion = `${anio}-03-01`) => ({
    id: materia,
    materia,
    materia_titulo: `M${materia}`,
    materia_curso: '1A',
    materia_anio,
    fecha_inscripcion,
  });

  const montar = async () => {
    await TestBed.configureTestingModule({
      imports: [Materias],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser: () => ({ persona: { id: 5 } }) } },
        {
          provide: InscripcionesService,
          useValue: {
            obtenerInscripcionesPorEstudiante: () =>
              of([insc(1, anio), insc(2, anio - 1), insc(3, anio - 2, `${anio}-03-01`)]),
          },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Materias);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  it('"actual" keeps only materias of the current year, regardless of the enrollment date', async () => {
    const c = await montar();
    expect(c.materiasFiltradas().map((m) => m.id)).toEqual([1]);
  });

  it('"todas" shows every materia', async () => {
    const c = await montar();
    c.filtroAnio.set('todas');
    expect(c.materiasFiltradas().length).toBe(3);
  });
});
