import { HttpClient, HttpHeaders } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthResponse, User, UserRole } from './auth.model';
import { catchError, Observable, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Persona } from '../../model/Persona.model';


export interface LoginCredentials {
  dni: string;
  password: string;
}

@Injectable({
  providedIn: 'root' 
})
export class AuthService {
  
  private http = inject(HttpClient);

   private readonly loginUrl = `${environment.apiUrl}auth/login/`; 
   private readonly perfilUrl = `${environment.apiUrl}auth/me/`;

  token = signal<string | null>(localStorage.getItem('access_token'));
  currentUser = signal<User | null>(null);

readonly currentPersona = computed<Persona | null>(() => {
    return this.currentUser()?.persona ?? null;
  });

  login(credentials: LoginCredentials): Observable<User> {
     return this.http.post<AuthResponse>(this.loginUrl, credentials).pipe(
        tap((res: AuthResponse) => {
             this.token.set(res.access);
        localStorage.setItem('access_token', res.access);
        localStorage.setItem('refresh_token', res.refresh);
       }),
      switchMap((res: AuthResponse) => {
        const headers = new HttpHeaders({
          Authorization: `Bearer ${res.access}`
        });
        return this.http.get<User>(this.perfilUrl, { headers });
      }),
      tap((userData: User) => {
        this.currentUser.set(userData);
        console.log('Datos de la persona asociada:', userData);
      })
    );
  }
  rol(){
    return this.currentUser()?.rolId;

  }
    getCurrentUser(): Persona| null{
      return this.currentPersona();
  }
  logout(): void {
    this.token.set(null);
    this.currentUser.set(null);
  }
}