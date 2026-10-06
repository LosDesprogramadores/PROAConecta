import { Component, OnDestroy, input, output } from '@angular/core';
import { FocusTrap } from '../focus-trap/focus-trap';
import { bloquearScroll, liberarScroll } from '../utils/scroll-lock';

export type AnchoModal = 'sm' | 'md' | 'lg' | 'xl';

const CLASES_ANCHO: Record<AnchoModal, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

/**
 * Accessible dialog: `role="dialog"`, `aria-modal`, `aria-labelledby` (the title),
 * focus trap, Escape, focus return and page scroll lock. Render it inside an `@if`:
 * it exists while it is open, and `cerrar` asks the parent to remove it.
 *
 * ```html
 * @if (abierto()) {
 *   <app-modal titulo="Editar materia" ancho="md" (cerrar)="abierto.set(false)">
 *     ...body...
 *     <div modal-pie>...actions pinned below the scroll area...</div>
 *   </app-modal>
 * }
 * ```
 * Slots: default (body), `[modal-subtitulo]` (under the title) and `[modal-pie]` (footer).
 */
@Component({
  selector: 'app-modal',
  imports: [FocusTrap],
  templateUrl: './modal.html',
})
export class Modal implements OnDestroy {
  private static siguienteId = 0;

  readonly titulo = input.required<string>();
  readonly ancho = input<AnchoModal>('md');
  /** Set to false to let the body manage its own padding (full-bleed tables). */
  readonly relleno = input(true);
  readonly cerrarAlClickFuera = input(true);
  readonly cerrar = output<void>();

  protected readonly idTitulo = `modal-titulo-${++Modal.siguienteId}`;
  protected claseAncho = () => CLASES_ANCHO[this.ancho()];

  constructor() {
    bloquearScroll();
  }

  ngOnDestroy(): void {
    liberarScroll();
  }

  protected alClickFuera(): void {
    if (this.cerrarAlClickFuera()) {
      this.cerrar.emit();
    }
  }
}
