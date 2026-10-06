import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Calificaciones } from './calificaciones';

describe('Calificaciones', () => {
  let component: Calificaciones;
  let fixture: ComponentFixture<Calificaciones>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Calificaciones],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Calificaciones);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
