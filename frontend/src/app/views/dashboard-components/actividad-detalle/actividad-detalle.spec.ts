import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { crearRutaFalsa } from '../../../testing/ruta-falsa';
import { ActividadDetalleComponent } from './actividad-detalle';

describe('ActividadDetalleComponent', () => {
  it('stops reacting to route param changes once the view is destroyed', () => {
    const ruta = crearRutaFalsa();
    TestBed.configureTestingModule({
      imports: [ActividadDetalleComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), ruta.provider],
    });
    const fixture = TestBed.createComponent(ActividadDetalleComponent);
    fixture.detectChanges();
    expect(ruta.observado()).toBe(true);

    fixture.destroy();

    expect(ruta.observado()).toBe(false);
  });
});
