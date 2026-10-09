import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Modal } from './modal';

@Component({
  selector: 'app-host',
  imports: [Modal],
  template: `
    <button id="disparador">abrir</button>
    @if (abierto()) {
      <app-modal
        titulo="Editar materia"
        [cerrarAlClickFuera]="clickFuera()"
        (cerrar)="abierto.set(false); cierres = cierres + 1"
      >
        <span modal-subtitulo>Detalle</span>
        <input id="primero" />
        <button id="ultimo" type="button">Guardar</button>
        <div modal-pie><button id="pie" type="button">Pie</button></div>
      </app-modal>
    }
    @if (propia()) {
      <app-modal titulo="Perfil" [sinCabecera]="true" (cerrar)="propia.set(false)">
        <button id="cierre-propio" type="button" (click)="propia.set(false)">Cerrar perfil</button>
      </app-modal>
    }
    @if (segundo()) {
      <app-modal titulo="Otro" (cerrar)="segundo.set(false)"><p>otro</p></app-modal>
    }
  `,
})
class Host {
  abierto = signal(false);
  segundo = signal(false);
  propia = signal(false);
  clickFuera = signal(true);
  cierres = 0;
}

describe('Modal', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const dom = () => fixture.nativeElement as HTMLElement;
  const dialogos = () => Array.from(dom().querySelectorAll<HTMLElement>('[role="dialog"]'));
  const tecla = (key: string, el: Element, shiftKey = false) => {
    const evento = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
    el.dispatchEvent(evento);
    return evento;
  };

  async function abrir() {
    host.abierto.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    document.body.style.overflow = '';
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    document.body.appendChild(dom());
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    dom().remove();
  });

  it('renders nothing while closed', () => {
    expect(dialogos()).toHaveLength(0);
  });

  it('exposes dialog semantics labelled by its title', async () => {
    await abrir();
    const dialogo = dialogos()[0];
    expect(dialogo.getAttribute('aria-modal')).toBe('true');
    expect(dom().querySelector(`#${dialogo.getAttribute('aria-labelledby')}`)?.textContent).toContain(
      'Editar materia',
    );
  });

  it('projects body, subtitle and footer, and gives the close button a name', async () => {
    await abrir();
    expect(dom().querySelector('#primero')).not.toBeNull();
    expect(dom().querySelector('[modal-subtitulo]')?.textContent).toBe('Detalle');
    expect(dom().querySelector('#pie')).not.toBeNull();
    expect(dom().querySelector('button[aria-label="Cerrar"]')).not.toBeNull();
  });

  it('moves the initial focus inside', async () => {
    await abrir();
    expect(dialogos()[0].contains(document.activeElement)).toBe(true);
  });

  it('closes on Escape', async () => {
    await abrir();
    tecla('Escape', dialogos()[0]);
    fixture.detectChanges();
    expect(host.cierres).toBe(1);
    expect(dialogos()).toHaveLength(0);
  });

  it('closes from the close button and from the backdrop, but not from the panel', async () => {
    await abrir();
    dialogos()[0].click();
    expect(host.cierres).toBe(0);
    dom().querySelector<HTMLElement>('[data-testid=modal-fondo]')!.click();
    expect(host.cierres).toBe(1);

    await abrir();
    dom().querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]')!.click();
    expect(host.cierres).toBe(2);
  });

  it('ignores the backdrop when cerrarAlClickFuera is false', async () => {
    host.clickFuera.set(false);
    await abrir();
    dom().querySelector<HTMLElement>('[data-testid=modal-fondo]')!.click();
    expect(host.cierres).toBe(0);
  });

  it('keeps Tab and Shift+Tab inside the modal', async () => {
    await abrir();
    const dialogo = dialogos()[0];
    const enfocables = Array.from(dialogo.querySelectorAll<HTMLElement>('button, input'));
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];

    ultimo.focus();
    expect(tecla('Tab', ultimo).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(primero);

    expect(tecla('Tab', primero, true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(ultimo);
  });

  it('returns focus to the opener when it closes', async () => {
    const disparador = dom().querySelector<HTMLButtonElement>('#disparador')!;
    disparador.focus();
    await abrir();
    tecla('Escape', dialogos()[0]);
    fixture.detectChanges();
    expect(document.activeElement).toBe(disparador);
  });

  it('locks the page scroll and releases it only when the last modal closes', async () => {
    await abrir();
    host.segundo.set(true);
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('hidden');

    host.segundo.set(false);
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('hidden');

    host.abierto.set(false);
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('');
  });

  it('gives each modal its own title id', async () => {
    await abrir();
    host.segundo.set(true);
    fixture.detectChanges();
    const ids = dialogos().map((d) => d.getAttribute('aria-labelledby'));
    expect(new Set(ids).size).toBe(2);
  });

  it('can hide the default header and label the dialog with aria-label instead', () => {
    host.propia.set(true);
    fixture.detectChanges();
    const dialogo = dialogos()[0];
    expect(dialogo.getAttribute('aria-label')).toBe('Perfil');
    expect(dialogo.hasAttribute('aria-labelledby')).toBe(false);
    expect(dialogo.querySelector('h2')).toBeNull();
    expect(dialogo.querySelector('button[aria-label="Cerrar"]')).toBeNull();
    expect(dialogo.querySelector('#cierre-propio')).not.toBeNull();
  });
});
