import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActividadEntregas } from './actividad-entregas';

describe('ActividadEntregas', () => {
  let component: ActividadEntregas;
  let fixture: ComponentFixture<ActividadEntregas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActividadEntregas]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActividadEntregas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
