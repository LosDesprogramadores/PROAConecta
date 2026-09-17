import { Injectable, signal } from '@angular/core';

export type ToastType = 'exito' | 'error' | 'información' | 'atención';

export interface Toast {
  id: number;
  tipo: ToastType;
  titulo?: string;
  mensaje: string;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private _toasts = signal<Toast[]>([]);
  public toasts = this._toasts.asReadonly();

  show(mensaje: string, tipo: ToastType = 'información', titulo?: string, duracionMs: number = 4000): void {
    const id = Date.now() + Math.random();
    const nuevoToast: Toast = { id, tipo, titulo, mensaje };

    this._toasts.update(actuales => [...actuales, nuevoToast]);

    if (duracionMs > 0) {
      setTimeout(() => {
        this.remove(id);
      }, duracionMs);
    }
  }

  success(mensaje: string, titulo: string = ''): void {
    this.show(mensaje, 'exito', titulo);
  }

  error(mensaje: string, titulo: string = ''): void {
    this.show(mensaje, 'error', titulo, 4000);
  }

  info(mensaje: string, titulo: string = ''): void {
    this.show(mensaje, 'información', titulo);
  }

  warning(mensaje: string, titulo: string = ''): void {
    this.show(mensaje, 'atención', titulo);
  }

  remove(id: number): void {
    this._toasts.update(actuales => actuales.filter(t => t.id !== id));
  }

  readable_message_extraction(err: any): string {
    let mensaje = "";

    if (err?.error) {
      if (typeof err.error === 'string') {
        mensaje = err.error;
      } else if (err.error.detail) {
        mensaje = err.error.detail;
      } else if (typeof err.error === 'object') {
        const primerCampo = Object.keys(err.error)[0];
        const errorDetalle = err.error[primerCampo];

        if (Array.isArray(errorDetalle)) {
          mensaje = `${primerCampo}: ${errorDetalle[0]}`;
        } else if (typeof errorDetalle === 'string') {
          mensaje = errorDetalle;
        }
      }
    } else if (err?.message) {
      mensaje = err.message;
    }

    return mensaje;

  }


}