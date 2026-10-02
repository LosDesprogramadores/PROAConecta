import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CalificacionesProfesor } from './calificaciones-profesor';

describe('CalificacionesProfesor', () => {
  let component: CalificacionesProfesor;
  let fixture: ComponentFixture<CalificacionesProfesor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalificacionesProfesor]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CalificacionesProfesor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
