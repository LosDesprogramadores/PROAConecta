import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ActividadesService } from '../../../../services/actividades.service';
import { AuthService } from '../../../../core/auth/auth.service';

import { Informacion } from './informacion';

describe('Informacion', () => {
  let component: Informacion;
  let fixture: ComponentFixture<Informacion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Informacion]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Informacion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('Informacion card', () => {
  let fixture: ComponentFixture<Informacion>;
  let component: Informacion;
  const dom = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Informacion],
      providers: [
        { provide: AuthService, useValue: { getCurrentUser: () => ({ id: 1 }) } },
        {
          provide: ActividadesService,
          useValue: {
            getActividades: () => of([{ id: 10, materia: 1, materia_titulo: 'Matemática' }]),
            getMisEntregas: () => of([]),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Informacion);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('exposes the card through a stretched button with an accessible name and no nested blocks', () => {
    const boton = dom().querySelector<HTMLButtonElement>('div.relative > button.absolute')!;
    expect(boton).not.toBeNull();
    expect(boton.textContent).toContain('actividades pendientes');
    expect(boton.querySelector('div, p')).toBeNull();
  });

  it('opens the modal when the native button is activated', () => {
    dom().querySelector<HTMLButtonElement>('div.relative > button.absolute')!.click();
    expect(component.mostrarModal()).toBe(true);
  });
});

describe('Informacion pendientes', () => {
  const montar = async (actividades: unknown[], entregas: unknown[]) => {
    await TestBed.configureTestingModule({
      imports: [Informacion],
      providers: [
        { provide: AuthService, useValue: { getCurrentUser: () => ({ id: 1 }) } },
        {
          provide: ActividadesService,
          useValue: { getActividades: () => of(actividades), getMisEntregas: () => of(entregas) },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Informacion);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, dom: fixture.nativeElement as HTMLElement };
  };
  const act = (id: number) => ({ id, materia: 1, materia_titulo: 'Matemática' });

  it('does not count a delivered activity even when the delivery id differs from the activity id', async () => {
    const { component, dom } = await montar([act(10)], [{ id: 99, actividad: 10, estado: 'ENTREGADO' }]);
    expect(component.actividadesPendientes()).toBe(0);
    expect(dom.textContent).toContain('Sin pendientes');
    expect(dom.textContent).not.toContain('Ver desglose');
  });

  it('does not count a graded delivery', async () => {
    const { component } = await montar(
      [act(10)],
      [{ id: 7, actividad: 10, estado: 'CORREGIDO', nota: { id: 1 } }],
    );
    expect(component.actividadesPendientes()).toBe(0);
  });

  it('counts an activity whose delivery is a draft as pending', async () => {
    const { component, dom } = await montar([act(10)], [{ id: 7, actividad: 10, estado: 'BORRADOR' }]);
    expect(component.actividadesPendientes()).toBe(1);
    expect(dom.textContent).toContain('1 Pendiente');
    expect(dom.textContent).not.toContain('1 Pendientes');
  });

  it('counts a NO_ENTREGADO delivery as pending and ignores draft activities', async () => {
    const { component } = await montar(
      [act(10), { ...act(11), estado: 'BORRADOR' }],
      [{ id: 7, actividad: 10, estado: 'NO_ENTREGADO' }],
    );
    expect(component.actividadesPendientes()).toBe(1);
  });

  it('pluralizes and groups by materia when there are several pending', async () => {
    const { component, dom } = await montar([act(10), act(11)], []);
    expect(component.actividadesPendientes()).toBe(2);
    expect(dom.textContent).toContain('2 Pendientes');
    expect(component.materiasPendientes()[0].cantidad).toBe(2);
  });

  it('also accepts a nested actividad object', async () => {
    const { component } = await montar([act(10)], [{ id: 5, actividad: { id: 10 }, estado: 'ENTREGADO' }]);
    expect(component.actividadesPendientes()).toBe(0);
  });
});
