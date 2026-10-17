import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { Paginador } from './paginador';

describe('Paginador', () => {
  let fixture: ComponentFixture<Paginador>;
  let emitidas: number[];

  const boton = (etiqueta: string) =>
    fixture.nativeElement.querySelector(`button[aria-label="${etiqueta}"]`) as HTMLButtonElement;

  async function configurar(total: number, pagina: number, tamano = 50) {
    fixture.componentRef.setInput('total', total);
    fixture.componentRef.setInput('pagina', pagina);
    fixture.componentRef.setInput('tamano', tamano);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Paginador] }).compileComponents();
    fixture = TestBed.createComponent(Paginador);
    emitidas = [];
    fixture.componentInstance.paginaCambiada.subscribe((p) => emitidas.push(p));
  });

  it('is a labelled navigation landmark with a polite page summary', async () => {
    await configurar(120, 2);
    const nav = fixture.nativeElement.querySelector('nav');
    expect(nav.getAttribute('aria-label')).toBe('Paginación');
    const resumen = nav.querySelector('[aria-live="polite"]');
    expect(resumen.textContent.replace(/\s+/g, ' ')).toContain('Página 2 de 3 · 120 registros');
  });

  it('computes the total pages and never shows less than one', async () => {
    await configurar(0, 1);
    expect(fixture.componentInstance.totalPaginas()).toBe(1);
    await configurar(101, 1, 50);
    expect(fixture.componentInstance.totalPaginas()).toBe(3);
  });

  it('disables previous on the first page and emits the next one', async () => {
    await configurar(120, 1);
    expect(boton('Página anterior').disabled).toBe(true);
    expect(boton('Página siguiente').disabled).toBe(false);
    boton('Página siguiente').click();
    expect(emitidas).toEqual([2]);
  });

  it('disables next on the last page and emits the previous one', async () => {
    await configurar(120, 3);
    expect(boton('Página siguiente').disabled).toBe(true);
    boton('Página anterior').click();
    expect(emitidas).toEqual([2]);
  });

  it('does not emit when the movement is not possible', async () => {
    await configurar(10, 1);
    fixture.componentInstance.anterior();
    fixture.componentInstance.siguiente();
    expect(emitidas).toEqual([]);
  });
});
