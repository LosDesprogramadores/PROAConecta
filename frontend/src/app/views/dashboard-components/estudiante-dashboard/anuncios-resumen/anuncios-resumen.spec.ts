import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AnunciosService } from '../../../../services/anuncios.service';

import { AnunciosResumen } from './anuncios-resumen';

describe('AnunciosResumen', () => {
  let component: AnunciosResumen;
  let fixture: ComponentFixture<AnunciosResumen>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnunciosResumen],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(AnunciosResumen);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('AnunciosResumen card', () => {
  let fixture: ComponentFixture<AnunciosResumen>;
  let component: AnunciosResumen;
  const dom = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    const novedad = { id: 1, titulo: 'Nueva novedad', mensaje: 'Detalle', tipo_notificacion_codigo: 'GENERAL' };
    await TestBed.configureTestingModule({
      imports: [AnunciosResumen],
      providers: [provideRouter([]), { provide: AnunciosService, useValue: { getAnuncios: () => of([novedad]) } }],
    }).compileComponents();
    fixture = TestBed.createComponent(AnunciosResumen);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('keeps the card as an article with a stretched button that has an accessible name', () => {
    const boton = dom().querySelector<HTMLButtonElement>('article > button')!;
    expect(boton).not.toBeNull();
    expect(boton.textContent).toContain('Nueva novedad');
  });

  it('does not nest block content inside buttons', () => {
    expect(dom().querySelector('button div, button p, button h3')).toBeNull();
  });

  it('opens the modal when the native button is activated', () => {
    dom().querySelector<HTMLButtonElement>('article > button')!.click();
    expect(component.anuncioSeleccionado()?.id).toBe(1);
  });
});
