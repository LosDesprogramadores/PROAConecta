import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Notificacion } from './notificacion';

describe('Notificacion', () => {
  let component: Notificacion;
  let fixture: ComponentFixture<Notificacion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Notificacion]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Notificacion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
