import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActividadEstudiante } from './actividad-estudiante';

describe('ActividadEstudiante', () => {
  let component: ActividadEstudiante;
  let fixture: ComponentFixture<ActividadEstudiante>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActividadEstudiante]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActividadEstudiante);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
