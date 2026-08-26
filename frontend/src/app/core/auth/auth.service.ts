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
  providedIn: 'root' // Significa que este servicio es único y global para toda la app
})
export class AuthService {
  // A. Inyectamos la herramienta para hacer llamadas HTTP
  private http = inject(HttpClient);

  // B. Construimos la URL completa usando tu environment
  private readonly apiUrl = `${environment.apiUrl}auth/login/`; 
  

  // C. Las "cajas" reactivas (Signals) donde guardamos los datos de sesión
  token = signal<string | null>(null);
  currentUser = signal<User | null>(null);

  // D. La función principal: Login
  login(credentials: LoginCredentials): Observable<AuthResponse> {
    console.log("url prueba " + this.apiUrl);
    return this.http.post<AuthResponse>(this.apiUrl, credentials).pipe(
      // 'tap' sirve para interceptar la respuesta exitosa antes de que llegue al componente
      tap((response: AuthResponse) => {
        // Guardamos los datos recibidos en las señales
        this.token.set(response.token);
        this.currentUser.set(response.user);
        
        console.log('Login exitoso. Token guardado:', response.token);
        console.log('Usuario conectado:', response.user);
      })
    );
  }

  // E. Función para cerrar sesión
  logout(): void {
    this.token.set(null);
    this.currentUser.set(null);
  }
}