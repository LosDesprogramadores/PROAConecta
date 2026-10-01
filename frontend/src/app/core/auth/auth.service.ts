import { HttpClient, HttpHeaders } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthResponse, User } from './auth.model';

import { catchError, Observable, switchMap, tap, throwError, map} from 'rxjs';

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

  private readonly perfilUrl = `${environment.apiUrl}auth/me/`;
  private readonly cambiarPasswordUrl = `${environment.apiUrl}auth/cambiar-password-primer-ingreso/`;
  private readonly solicitarRecuperacionUrl = `${environment.apiUrl}auth/solicitar-recuperacion/`;
  private readonly confirmarRecuperacionUrl = `${environment.apiUrl}auth/confirmar-recuperacion/`;

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
    return this.http.post(this.cambiarPasswordUrl, data, { headers });
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

  logout(): void {
    this.token.set(null);
    this.currentUser.set(null);

    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('current_user');

    this.router.navigate(['/login']);
  }
}
