import { Component, OnDestroy, effect, inject } from '@angular/core';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { FocusTrap } from '../focus-trap/focus-trap';
import { bloquearScroll, liberarScroll } from '../utils/scroll-lock';

/** Mounted once in the app root; it renders whatever `ConfirmDialogService` has pending. */
@Component({
  selector: 'app-confirm-dialog',
  imports: [FocusTrap],
  templateUrl: './confirm-dialog.html',
})
export class ConfirmDialog implements OnDestroy {
  protected servicio = inject(ConfirmDialogService);
  private scrollBloqueado = false;

  constructor() {
    effect(() => {
      this.sincronizarScroll(this.servicio.pendiente() !== null);
    });
  }

  ngOnDestroy(): void {
    this.sincronizarScroll(false);
  }

  private sincronizarScroll(abierto: boolean): void {
    if (abierto && !this.scrollBloqueado) {
      bloquearScroll();
      this.scrollBloqueado = true;
    } else if (!abierto && this.scrollBloqueado) {
      liberarScroll();
      this.scrollBloqueado = false;
    }
  }
}
