import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MateriasResumen } from './materias-resumen';

describe('MateriasResumen', () => {
  let component: MateriasResumen;
  let fixture: ComponentFixture<MateriasResumen>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MateriasResumen],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(MateriasResumen);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
