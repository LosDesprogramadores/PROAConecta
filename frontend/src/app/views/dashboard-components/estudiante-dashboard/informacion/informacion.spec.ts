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
