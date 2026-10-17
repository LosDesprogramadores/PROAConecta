import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { crearRutaFalsa } from '../../../testing/ruta-falsa';
import { Portada } from './portada';

describe('Portada', () => {
  let component: Portada;
  let fixture: ComponentFixture<Portada>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Portada],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Portada);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('Portada subscription cleanup', () => {
  it('stops listening to the route params once the view is destroyed', () => {
    const ruta = crearRutaFalsa({ id: '7' });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [Portada],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), ruta.provider],
    });
    const fixture = TestBed.createComponent(Portada);
    fixture.detectChanges();
    expect(ruta.observado()).toBe(true);

    fixture.destroy();

    expect(ruta.observado()).toBe(false);
  });
});
