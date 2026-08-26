import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthResponse, User, UserRole } from './auth.model';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';


export interface LoginCredentials {
  dni: string;
  password: string;
}

@Injectable({
  providedIn: 'root' 
})
export class AuthService {
  
  private http = inject(HttpClient);

   private readonly apiUrl = `${environment.apiUrl}auth/login/`; 
  

  token = signal<string | null>(null);
  currentUser = signal<User | null>(null);

  login(credentials: LoginCredentials): Observable<AuthResponse> {
     return this.http.post<AuthResponse>(this.apiUrl, credentials).pipe(
        tap((response: AuthResponse) => {
               this.token.set(response.token);
        this.currentUser.set(response.user);
        
        console.log('Login exitoso. Token guardado:', response.token);
        console.log('Usuario conectado:', response.user);
      })
    );
  }

  logout(): void {
    this.token.set(null);
    this.currentUser.set(null);
  }
}