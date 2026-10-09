import { HttpClient, HttpHeaders } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthResponse, User } from './auth.model';

import { finalize, Observable, shareReplay, switchMap, tap, throwError, map} from 'rxjs';

import { environment } from '../../../environments/environment';
import { Persona } from '../../model/Persona.model';


export interface LoginCredentials {
  dni: string;
  password: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly loginUrl = `${environment.apiUrl}auth/login/`;

  private readonly refreshUrl = `${environment.apiUrl}auth/refresh/`;
  private readonly logoutUrl = `${environment.apiUrl}auth/logout/`;

  private readonly perfilUrl = `${environment.apiUrl}auth/me/`;
  private readonly cambiarPasswordUrl = `${environment.apiUrl}auth/cambiar-password-primer-ingreso/`;
  private readonly solicitarRecuperacionUrl = `${environment.apiUrl}auth/solicitar-recuperacion/`;
  private readonly confirmarRecuperacionUrl = `${environment.apiUrl}auth/confirmar-recuperacion/`;

  private refrescando$: Observable<string> | null = null;

  token = signal<string | null>(localStorage.getItem('access_token'));

  currentUser = signal<User | null>(this.getUserFromStorage());

  readonly currentPersona = computed<Persona | null>(() => {
    return this.currentUser()?.persona ?? null;
  });

  private getUserFromStorage(): User | null {
    const userJson = localStorage.getItem('current_user');
    return userJson ? (JSON.parse(userJson) as User) : null;
  }

  login(credentials: LoginCredentials): Observable<User> {
    return this.http.post<AuthResponse>(this.loginUrl, credentials).pipe(
      tap((res: AuthResponse) => {
        this.token.set(res.access);

        localStorage.setItem('access_token', res.access);

        localStorage.setItem('refresh_token', res.refresh);
      }),

      switchMap((res: AuthResponse) => {
        const headers = new HttpHeaders({
          Authorization: `Bearer ${res.access}`,
        });

        return this.http.get<User>(this.perfilUrl, { headers }).pipe(map((userData: User) => ({
            ...userData,
            debe_cambiar_password: res.debe_cambiar_password,
          }))
        );
      }),
      tap((userData: User) => {

        localStorage.setItem('current_user', JSON.stringify(userData));
        this.currentUser.set(userData);

      }),
    );
  }

  cambiarPasswordPrimerIngreso(data: { password_actual: string; password_nuevo: string }): Observable<any> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.token()}`,
    });
    return this.http.post<Partial<AuthResponse>>(this.cambiarPasswordUrl, data, { headers }).pipe(
      tap((res) => {
        // El servidor revoca los refresh anteriores (incluido el nuestro) y entrega un par nuevo
        if (res.access && res.refresh) {
          this.token.set(res.access);
          localStorage.setItem('access_token', res.access);
          localStorage.setItem('refresh_token', res.refresh);
        }
      }),
    );
  }

  solicitarRecuperacion(email: string): Observable<any> {
    return this.http.post(this.solicitarRecuperacionUrl, { email });
  }

  confirmarRecuperacion(data: { uid: string; token: string; password_nuevo: string }): Observable<any> {
    return this.http.post(this.confirmarRecuperacionUrl, data);
  }

  rol(): number | undefined {
    return this.currentUser()?.rolId;
  }

  getCurrentUser(): Persona | null {
    return this.currentPersona();
  }

  isLoggedIn(): boolean {
    return this.token() !== null;
  }

  /**
   * Renews the access token with the stored refresh token. Single-flight: concurrent callers
   * share the same HTTP request, so a burst of 401s never rotates the refresh token twice.
   */
  refrescarToken(): Observable<string> {
    if (this.refrescando$) {
      return this.refrescando$;
    }
    const refresh = localStorage.getItem('refresh_token');
    if (!refresh) {
      return throwError(() => new Error('No hay token de renovación.'));
    }
    const peticion$ = this.http.post<{ access: string; refresh?: string }>(this.refreshUrl, { refresh }).pipe(
      map((res) => {
        this.token.set(res.access);
        localStorage.setItem('access_token', res.access);
        // Refresh rotation: the previous refresh token is already blacklisted
        if (res.refresh) {
          localStorage.setItem('refresh_token', res.refresh);
        }
        return res.access;
      }),
      finalize(() => (this.refrescando$ = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.refrescando$ = peticion$;
    return peticion$;
  }

  /** The session can no longer be renewed: clear it and send the user to the login with a notice. */
  cerrarSesionPorExpiracion(): void {
    this.limpiarSesionLocal();
    this.router.navigate(['/login'], { queryParams: { motivo: 'sesion-expirada' } });
  }

  /** Ends the session on the server (best effort) and then clears the local state. */
  logout(): void {
    const refresh = localStorage.getItem('refresh_token');
    if (refresh) {
      // The endpoint only needs the refresh token, so it works even when the access token has expired
      this.http.post(this.logoutUrl, { refresh }).subscribe({ error: () => undefined });
    }
    this.limpiarSesionLocal();
    this.router.navigate(['/login']);
  }

  private limpiarSesionLocal(): void {
    this.token.set(null);
    this.currentUser.set(null);

    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('current_user');
  }
}
