import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ConfirmDialog } from './confirm-dialog';

@Component({
  selector: 'app-host',
  imports: [ConfirmDialog],
  template: `<button id="disparador">abrir</button><app-confirm-dialog />`,
})
class Host {}

describe('ConfirmDialog', () => {
  let fixture: ComponentFixture<Host>;
  let servicio: ConfirmDialogService;
  const dom = () => fixture.nativeElement as HTMLElement;
  const dialogo = () => dom().querySelector<HTMLElement>('[role="dialog"]');

  beforeEach(async () => {
    document.body.style.overflow = '';
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    document.body.appendChild(dom());
    servicio = TestBed.inject(ConfirmDialogService);
    fixture.detectChanges();
  });

  afterEach(() => dom().remove());

  async function abrir(opciones: Parameters<ConfirmDialogService['confirmar']>[0] = '¿Seguro?') {
    const respuestas: boolean[] = [];
    servicio.confirmar(opciones).subscribe((r) => respuestas.push(r));
    fixture.detectChanges();
    await fixture.whenStable();
    return respuestas;
  }

  it('renders nothing until someone asks for a confirmation', () => {
    expect(dialogo()).toBeNull();
  });

  it('exposes dialog semantics linked to its title and message', async () => {
    await abrir({ titulo: 'Eliminar materia', mensaje: '¿Estás seguro?' });
    const d = dialogo()!;
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(dom().querySelector(`#${d.getAttribute('aria-labelledby')}`)?.textContent).toContain('Eliminar materia');
    expect(dom().querySelector(`#${d.getAttribute('aria-describedby')}`)?.textContent).toContain('¿Estás seguro?');
  });

  it('puts the initial focus on the safe action (cancel)', async () => {
    await abrir();
    expect(document.activeElement?.textContent?.trim()).toBe('Cancelar');
  });

  it('emits true and closes when confirmed', async () => {
    const respuestas = await abrir({ mensaje: 'x', textoConfirmar: 'Sí, eliminar' });
    const botones = Array.from(dom().querySelectorAll('button'));
    botones.find((b) => b.textContent?.trim() === 'Sí, eliminar')!.click();
    fixture.detectChanges();
    expect(respuestas).toEqual([true]);
    expect(dialogo()).toBeNull();
  });

  it('emits false when cancelled', async () => {
    const respuestas = await abrir();
    Array.from(dom().querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Cancelar')!.click();
    fixture.detectChanges();
    expect(respuestas).toEqual([false]);
    expect(dialogo()).toBeNull();
  });

  it('emits false on Escape', async () => {
    const respuestas = await abrir();
    dialogo()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(respuestas).toEqual([false]);
    expect(dialogo()).toBeNull();
  });

  it('emits false when the backdrop is clicked, but not when the panel is', async () => {
    const respuestas = await abrir();
    dialogo()!.click();
    expect(respuestas).toEqual([]);
    dom().querySelector<HTMLElement>('[data-testid=confirm-fondo]')!.click();
    expect(respuestas).toEqual([false]);
  });

  it('keeps Tab inside the dialog', async () => {
    await abrir();
    const [cancelar, confirmar] = Array.from(dialogo()!.querySelectorAll('button'));
    confirmar.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    confirmar.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(cancelar);

    const shiftTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    cancelar.dispatchEvent(shiftTab);
    expect(document.activeElement).toBe(confirmar);
  });

  it('returns focus to the element that opened it', async () => {
    const disparador = dom().querySelector<HTMLButtonElement>('#disparador')!;
    disparador.focus();
    const respuestas = await abrir();
    expect(document.activeElement).not.toBe(disparador);
    dialogo()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(respuestas).toEqual([false]);
    expect(document.activeElement).toBe(disparador);
  });

  it('answers "no" to the open dialog when a new one replaces it', async () => {
    const primera = await abrir('uno');
    const segunda = await abrir('dos');
    expect(primera).toEqual([false]);
    expect(segunda).toEqual([]);
    expect(dom().textContent).toContain('dos');
  });

  it('closes silently when the subscriber leaves before an answer', async () => {
    const sub = servicio.confirmar('x').subscribe();
    fixture.detectChanges();
    sub.unsubscribe();
    fixture.detectChanges();
    expect(dialogo()).toBeNull();
  });

  it('locks the page scroll while open and releases it on close', async () => {
    const sub = servicio.confirmar('x').subscribe();
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('hidden');
    sub.unsubscribe();
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('');
  });

  it('releases the scroll lock when the host is destroyed while open', async () => {
    servicio.confirmar('x').subscribe();
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('hidden');
    fixture.destroy();
    expect(document.body.style.overflow).toBe('');
  });
});
