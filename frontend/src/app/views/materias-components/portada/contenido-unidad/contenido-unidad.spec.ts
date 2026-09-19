import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContenidoUnidad } from './contenido-unidad';

describe('ContenidoUnidad', () => {
  let component: ContenidoUnidad;
  let fixture: ComponentFixture<ContenidoUnidad>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContenidoUnidad]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ContenidoUnidad);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
