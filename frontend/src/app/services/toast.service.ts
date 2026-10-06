import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, isDevMode, signal } from '@angular/core';

export type ToastType = 'exito' | 'error' | 'información' | 'atención';

export interface Toast {
  id: number;
  tipo: ToastType;
  titulo?: string;
  mensaje: string;
}

const TITULO_ERROR_POR_DEFECTO = 'Error al cargar los datos';
const MENSAJE_INESPERADO = 'Ocurrió un error inesperado. Intenta nuevamente.';
const LARGO_MAXIMO_DETALLE = 200;

const MENSAJES_POR_ESTADO: Record<number, string> = {
  0: 'No se pudo conectar con el servidor. Revisa tu conexión.',
  400: 'Los datos enviados no son válidos.',
  401: 'Tu sesión expiró. Inicia sesión nuevamente.',
  403: 'No tienes permisos para realizar esta acción.',
  404: 'No se encontró lo que buscas.',
  409: 'La operación entra en conflicto con el estado actual.',
  429: 'Demasiadas solicitudes. Espera un momento e intenta nuevamente.',
  500: 'Ocurrió un error en el servidor. Intenta nuevamente más tarde.',
};

/** A server text is safe to show only if it is short, single-purpose plain text. */
function esTextoSeguro(texto: string): boolean {
  const limpio = texto.trim();
  return (
    limpio.length > 0 &&
    limpio.length <= LARGO_MAXIMO_DETALLE &&
    !/[<>]/.test(limpio) &&
    !/traceback/i.test(limpio)
  );
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
    this.show(mensaje, 'error', titulo || TITULO_ERROR_POR_DEFECTO, 4000);
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

  /**
   * Returns a user-safe Spanish message for an error. It never returns a raw
   * server body (HTML, traceback): technical detail only goes to the console in dev.
   */
  readable_message_extraction(err: any): string {
    if (isDevMode()) {
      console.error('[ToastService] error técnico:', err);
    }

    const status = err instanceof HttpErrorResponse ? err.status : undefined;
    if (status === undefined) {
      return MENSAJE_INESPERADO;
    }
    if (status >= 500) {
      return MENSAJES_POR_ESTADO[500];
    }

    return this.extraerDetalleSeguro(err.error) ?? MENSAJES_POR_ESTADO[status] ?? MENSAJES_POR_ESTADO[400];
  }

  private extraerDetalleSeguro(body: unknown): string | null {
    if (typeof body === 'string') {
      return esTextoSeguro(body) ? body : null;
    }
    if (!body || typeof body !== 'object') {
      return null;
    }

    const cuerpo = body as Record<string, unknown>;
    if (typeof cuerpo['detail'] === 'string') {
      return esTextoSeguro(cuerpo['detail']) ? cuerpo['detail'] : null;
    }

    const campo = Object.keys(cuerpo)[0];
    const valor = campo ? cuerpo[campo] : undefined;
    const texto = Array.isArray(valor) ? valor[0] : valor;
    if (typeof texto === 'string' && esTextoSeguro(texto)) {
      return texto;
    }
    return null;
  }
}
