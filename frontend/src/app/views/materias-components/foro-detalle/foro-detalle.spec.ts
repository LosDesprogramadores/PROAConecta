import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ForoDetalle } from './foro-detalle';

describe('ForoDetalle', () => {
  let component: ForoDetalle;
  let fixture: ComponentFixture<ForoDetalle>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForoDetalle]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ForoDetalle);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
