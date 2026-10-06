import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortadaProfesor } from './portada-profesor';

describe('PortadaProfesor', () => {
  let component: PortadaProfesor;
  let fixture: ComponentFixture<PortadaProfesor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PortadaProfesor],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PortadaProfesor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
