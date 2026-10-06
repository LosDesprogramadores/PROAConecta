import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContenidoUnidadComponent } from './contenido-unidad';

describe('ContenidoUnidadComponent', () => {
  let component: ContenidoUnidadComponent;
  let fixture: ComponentFixture<ContenidoUnidadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContenidoUnidadComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ContenidoUnidadComponent);
    component = fixture.componentInstance;
    component.unidad = { id: 'u1', nombre: 'Unidad 1', contenidos: [] } as never;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
