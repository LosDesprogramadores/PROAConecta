import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from '../../shared/navbar/navbar';
import { Footer } from '../../shared/footer/footer';
import { AuthService } from '../../core/auth/auth.service';
import { UserRole } from '../../core/auth/auth.model';

@Component({
  selector: 'app-dashboard-layout',
  imports: [RouterOutlet, Navbar, Footer],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.css',
})
export class DashboardLayout {
  private readonly authService = inject(AuthService);

  // El docente no usa sidebar: sus links (/docente/...) no existen en las rutas.
  get mostrarSidebar(): boolean {
    return this.authService.rol() !== UserRole.DOCENTE;
  }
}