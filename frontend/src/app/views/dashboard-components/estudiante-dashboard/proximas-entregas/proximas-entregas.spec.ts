import { importProvidersFrom } from '@angular/core';
import { CalendarModule, DateAdapter } from 'angular-calendar';
import { adapterFactory } from 'angular-calendar/date-adapters/date-fns';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProximasEntregas } from './proximas-entregas';

describe('ProximasEntregas', () => {
  let component: ProximasEntregas;
  let fixture: ComponentFixture<ProximasEntregas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProximasEntregas],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        importProvidersFrom(CalendarModule.forRoot({ provide: DateAdapter, useFactory: adapterFactory })),
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProximasEntregas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
