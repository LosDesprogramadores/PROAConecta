import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AnunciosService } from '../../../services/anuncios.service';

import { Anuncios } from './anuncios';

describe('Anuncios', () => {
  let component: Anuncios;
  let fixture: ComponentFixture<Anuncios>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Anuncios]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Anuncios);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('Anuncios cards', () => {
  let fixture: ComponentFixture<Anuncios>;
  let component: Anuncios;
  const dom = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    const anuncio = { id: 1, titulo: 'Fin de cuatrimestre', mensaje: 'Detalle', tipo_notificacion_codigo: 'GENERAL' };
    await TestBed.configureTestingModule({
      imports: [Anuncios],
      providers: [{ provide: AnunciosService, useValue: { getAnuncios: () => of([anuncio]) } }],
    }).compileComponents();
    fixture = TestBed.createComponent(Anuncios);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('keeps the card as an article with a stretched button that has an accessible name', () => {
    const card = dom().querySelector('article')!;
    expect(card).not.toBeNull();
    const boton = card.querySelector<HTMLButtonElement>('button')!;
    expect(boton.type).toBe('button');
    expect(boton.textContent).toContain('Fin de cuatrimestre');
  });

  it('does not nest block content inside buttons', () => {
    expect(dom().querySelector('button div, button p, button h3')).toBeNull();
  });

  it('opens the modal when the native button is activated', () => {
    dom().querySelector<HTMLButtonElement>('article button')!.click();
    expect(component.anuncioSeleccionado()?.id).toBe(1);
  });
});
