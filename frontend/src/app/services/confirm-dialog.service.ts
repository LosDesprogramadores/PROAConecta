import { Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';

export interface ConfirmarOpciones {
  titulo?: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  /** Styles the confirm button as a destructive action. Defaults to true. */
  peligro?: boolean;
}

export interface ConfirmacionPendiente extends ConfirmarOpciones {
  responder: (confirmado: boolean) => void;
}

/**
 * Replaces `window.confirm`. `confirmar` is cold: the dialog opens on subscribe and the
 * observable emits `true` (confirm) or `false` (cancel, Escape, backdrop) once, then completes.
 * Unsubscribing before an answer closes the dialog without emitting.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private _pendiente = signal<ConfirmacionPendiente | null>(null);
  readonly pendiente = this._pendiente.asReadonly();

  confirmar(opciones: ConfirmarOpciones | string): Observable<boolean> {
    const config = typeof opciones === 'string' ? { mensaje: opciones } : opciones;

    return new Observable<boolean>((suscriptor) => {
      // A newer request replaces the one still open: the old one is answered "no".
      this._pendiente()?.responder(false);

      const actual: ConfirmacionPendiente = {
        ...config,
        responder: (confirmado) => {
          if (this._pendiente() === actual) {
            this._pendiente.set(null);
          }
          suscriptor.next(confirmado);
          suscriptor.complete();
        },
      };
      this._pendiente.set(actual);

      return () => {
        if (this._pendiente() === actual) {
          this._pendiente.set(null);
        }
      };
    });
  }
}
