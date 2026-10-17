import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, TitleStrategy, provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import { TituloStrategy } from './titulo.strategy';

@Component({ template: '' })
class Vacio {}

describe('TituloStrategy', () => {
  let router: Router;
  let title: Title;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'con-titulo', title: 'Calificaciones', component: Vacio },
          { path: 'sin-titulo', component: Vacio },
        ]),
        { provide: TitleStrategy, useExisting: TituloStrategy },
      ],
    });
    router = TestBed.inject(Router);
    title = TestBed.inject(Title);
  });

  it('muestra "<pantalla> · PROA Conecta" cuando la ruta tiene título', async () => {
    await router.navigateByUrl('/con-titulo');
    expect(title.getTitle()).toBe('Calificaciones · PROA Conecta');
  });

  it('muestra solo "PROA Conecta" cuando la ruta no tiene título', async () => {
    await router.navigateByUrl('/sin-titulo');
    expect(title.getTitle()).toBe('PROA Conecta');
  });
});
