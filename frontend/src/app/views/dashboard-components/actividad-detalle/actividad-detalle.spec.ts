import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActividadDetalleComponent } from './actividad-detalle';

describe('ActividadDetalleComponent', () => {
  let component: ActividadDetalleComponent;
  let fixture: ComponentFixture<ActividadDetalleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActividadDetalleComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActividadDetalleComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
