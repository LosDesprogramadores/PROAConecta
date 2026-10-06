import { AfterViewInit, Directive, ElementRef, OnDestroy, inject, output } from '@angular/core';

const FOCUSABLES = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Keyboard behavior shared by every dialog:
 * - moves focus inside on open (`[data-autofocus]` first, then the first control),
 * - keeps Tab / Shift+Tab cycling inside the host,
 * - emits `escape` when Escape is pressed,
 * - returns focus to the element that had it before the dialog opened.
 */
@Directive({
  selector: '[appFocusTrap]',
  host: {
    '(keydown)': 'alTeclear($event)',
  },
})
export class FocusTrap implements AfterViewInit, OnDestroy {
  private host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private elementoPrevio = document.activeElement as HTMLElement | null;

  readonly escape = output<void>();

  ngAfterViewInit(): void {
    const inicial =
      this.host.querySelector<HTMLElement>('[data-autofocus]') ?? this.enfocables()[0] ?? this.host;
    if (inicial === this.host && !this.host.hasAttribute('tabindex')) {
      this.host.setAttribute('tabindex', '-1');
    }
    inicial.focus();
  }

  ngOnDestroy(): void {
    if (this.elementoPrevio?.isConnected) {
      this.elementoPrevio.focus();
    }
  }

  protected alTeclear(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      evento.stopPropagation();
      this.escape.emit();
      return;
    }
    if (evento.key !== 'Tab') {
      return;
    }

    const items = this.enfocables();
    if (items.length === 0) {
      evento.preventDefault();
      return;
    }

    const primero = items[0];
    const ultimo = items[items.length - 1];
    const activo = document.activeElement;
    const adentro = activo !== null && this.host.contains(activo) && activo !== this.host;

    if (!adentro) {
      evento.preventDefault();
      (evento.shiftKey ? ultimo : primero).focus();
    } else if (evento.shiftKey && activo === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && activo === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  private enfocables(): HTMLElement[] {
    return Array.from(this.host.querySelectorAll<HTMLElement>(FOCUSABLES)).filter(
      (el) => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true',
    );
  }
}
