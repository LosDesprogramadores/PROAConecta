import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

const CODIGO_CAMBIO_DE_CLAVE = 'cambio_de_clave_requerido';
const RUTAS_DE_AUTENTICACION = `${environment.apiUrl}auth/`;

const esApi = (req: HttpRequest<unknown>) => req.url.startsWith(environment.apiUrl);
const exigeCambioDeClave = (error: unknown) =>
  error instanceof HttpErrorResponse && error.status === 403 && error.error?.code === CODIGO_CAMBIO_DE_CLAVE;
const esAutenticacion = (req: HttpRequest<unknown>) => req.url.startsWith(RUTAS_DE_AUTENTICACION);

function conToken<T>(req: HttpRequest<T>, token: string): HttpRequest<T> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/**
 * Sends the access token only to our own API. On a 401 it renews the token once (single-flight,
 * shared by every concurrent request) and retries; if the session cannot be renewed it logs out.
 * Calls under `auth/` never trigger a refresh, which avoids loops. A 403 carrying the temporary-password code
 * sends the user to the password change screen.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!esApi(req)) {
    return next(req);
  }

  // Requests that already carry their own Authorization (login, logout) are left untouched
  const token = auth.token();
  const enviada = token && !req.headers.has('Authorization') ? conToken(req, token) : req;

  return next(enviada).pipe(
    catchError((error: unknown) => {
      if (exigeCambioDeClave(error)) {
        router.navigate(['/cambiar-password']);
        return throwError(() => error);
      }
      const noAutorizado = error instanceof HttpErrorResponse && error.status === 401;
      if (!noAutorizado || !token || esAutenticacion(req)) {
        return throwError(() => error);
      }
      return renovarYReintentar(req, next, auth, token, error);
    }),
  );
};

function renovarYReintentar(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  auth: AuthService,
  tokenUsado: string,
  errorOriginal: unknown,
) {
  const actual = auth.token();
  // Another request already renewed the session while this one was in flight: just retry with it
  if (actual && actual !== tokenUsado) {
    return next(conToken(req, actual));
  }

  return auth.refrescarToken().pipe(
    catchError(() => {
      auth.cerrarSesionPorExpiracion();
      return throwError(() => errorOriginal);
    }),
    switchMap((nuevo) => next(conToken(req, nuevo))),
  );
}
