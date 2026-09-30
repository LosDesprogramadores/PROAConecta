import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActividadDetalle } from './actividad-detalle';

describe('ActividadDetalle', () => {
  let component: ActividadDetalle;
  let fixture: ComponentFixture<ActividadDetalle>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActividadDetalle]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActividadDetalle);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
