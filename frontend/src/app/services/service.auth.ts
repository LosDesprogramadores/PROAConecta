import { Injectable, signal } from '@angular/core';
import { Usuario } from '../model/usuario.model';

@Injectable({
  providedIn: 'root',
})
export class ServiceAuth {

  private usuarios = [
    {
      dni: '12345678',
      password: '1234',
      usuario: {
        dni: '12345678',
        nombre: 'Juan',
        apellido: 'Pérez',
        rol: 'alumno' as const
      }
    },
    {
      dni: '87654321',
      password: 'abcd',
      usuario: {
        dni: '87654321',
        nombre: 'María',
        apellido: 'Gómez',
        rol: 'docente' as const
      }
    }
  ];

  private usuario = signal<Usuario | null>(this.getUsuario());

  login(dni: string, password: string): Usuario | null {
    const resultado = this.usuarios.find(
      u => u.dni === dni && u.password === password
    );

    if (resultado) {
      localStorage.setItem(
        'usuario',
        JSON.stringify(resultado.usuario)
      );

      this.usuario.set(resultado.usuario);

      return resultado.usuario;
    }

    return null;
  }

  getUsuario(): Usuario | null {
    const usuario = localStorage.getItem('usuario');

    if (!usuario) {
      return null;
    }

    return JSON.parse(usuario);
  }

  isLoggedIn(): boolean {
    return this.usuario() !== null;
  }

  logout(): void {
    localStorage.removeItem('usuario');
    this.usuario.set(null);
  }

}
