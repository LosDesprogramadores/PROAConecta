import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActividadForm } from './actividad-form';

describe('ActividadForm', () => {
  let component: ActividadForm;
  let fixture: ComponentFixture<ActividadForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActividadForm],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActividadForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
