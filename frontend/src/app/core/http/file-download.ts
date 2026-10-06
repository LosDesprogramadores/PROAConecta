import { DOCUMENT } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, from, map, switchMap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';

export type ParametrosDescarga = Record<string, string | number | boolean | null | undefined>;

const NOMBRE_RESPALDO = 'descarga';
const RUTA_ARCHIVOS = /^\/?api\/archivos\//;

/** True for the authorized download route the API returns for uploaded files (`/api/archivos/<tipo>/<id>/`). */
export function esRutaDeArchivo(valor: string | null | undefined): boolean {
  return !!valor && (RUTA_ARCHIVOS.test(valor) || valor.startsWith(`${environment.apiUrl}archivos/`));
}

/**
 * Resolves the site-relative route the API returns into the URL the HTTP client must call, so that the
 * auth interceptor adds the token (it only does so for URLs under `environment.apiUrl`).
 */
export function urlDeArchivo(ruta: string): string {
  return RUTA_ARCHIVOS.test(ruta) ? `${environment.apiUrl}${ruta.replace(/^\/?api\//, '')}` : ruta;
}

/** Reads the file name from a Content-Disposition header (RFC 6266, quoted or filename*=UTF-8). */
export function nombreDesdeContentDisposition(cabecera: string | null): string | null {
  if (!cabecera) {
    return null;
  }
  const extendido = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(cabecera);
  if (extendido) {
    try {
      return decodeURIComponent(extendido[1].trim());
    } catch {
      // falls through to the plain form
    }
  }
  const simple = /filename\s*=\s*"?([^";]+)"?/i.exec(cabecera);
  return simple ? simple[1].trim() : null;
}

// Blob.text() is missing in some runtimes (jsdom), FileReader works everywhere
function leerTexto(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result ?? ''));
    lector.onerror = () => reject(lector.error);
    lector.readAsText(blob);
  });
}

/** Downloads a file served by the API as an attachment, keeping the server-provided file name. */
@Injectable({ providedIn: 'root' })
export class FileDownloadService {
  private readonly http = inject(HttpClient);
  private readonly document = inject(DOCUMENT);

  descargar(url: string, params: ParametrosDescarga = {}, nombreRespaldo = NOMBRE_RESPALDO): Observable<void> {
    let httpParams = new HttpParams();
    for (const [clave, valor] of Object.entries(params)) {
      if (valor !== null && valor !== undefined && valor !== '') {
        httpParams = httpParams.set(clave, String(valor));
      }
    }

    return this.http.get(url, { params: httpParams, responseType: 'blob', observe: 'response' }).pipe(
      map((respuesta) => this.guardar(respuesta, nombreRespaldo)),
      catchError((err) => this.errorLegible(err)),
    );
  }

  private guardar(respuesta: HttpResponse<Blob>, nombreRespaldo: string): void {
    const nombre =
      nombreDesdeContentDisposition(respuesta.headers.get('Content-Disposition')) ?? nombreRespaldo;
    const enlace = this.document.createElement('a');
    const direccion = URL.createObjectURL(respuesta.body as Blob);
    enlace.href = direccion;
    enlace.download = nombre;
    enlace.style.display = 'none';
    this.document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(direccion);
  }

  // With responseType 'blob' an error body arrives as a Blob: it is parsed back to JSON so that
  // the callers (ToastService.readable_message_extraction) can read `detail`
  private errorLegible(err: unknown): Observable<never> {
    if (!(err instanceof HttpErrorResponse) || !(err.error instanceof Blob)) {
      return throwError(() => err);
    }
    const original = err;
    return from(leerTexto(original.error as Blob)).pipe(
      map((texto) => {
        try {
          return JSON.parse(texto) as unknown;
        } catch {
          return null;
        }
      }),
      switchMap((cuerpo) =>
        throwError(
          () =>
            new HttpErrorResponse({
              error: cuerpo,
              headers: original.headers,
              status: original.status,
              statusText: original.statusText,
              url: original.url ?? undefined,
            }),
        ),
      ),
    );
  }
}
