import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Navbar } from '../../shared/navbar/navbar';
import { Footer } from '../../shared/footer/footer';
import { AuthService } from '../../core/auth/auth.service';
import { SidebarMaterias } from '../../shared/sidebar-materias/sidebar-materias';
import { filter } from 'rxjs';

@Component({
  selector: 'app-dashboard-layout',
  imports: [RouterOutlet, Navbar, Footer, SidebarMaterias],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.css',
})
export class DashboardLayout {
  private readonly authService = inject(AuthService);
  private router = inject(Router);
  mostrarSidebar = signal<boolean>(false);

  constructor() {
    // Evaluar la ruta al cargar o al cambiar de navegación
    this.evaluarRuta(this.router.url);

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.evaluarRuta(event.urlAfterRedirects);
      });
  }

  private evaluarRuta(url: string): void {
    // Habilita el sidebar solo si la ruta incluye '/anuncios'
    const esAnuncios = url.includes('/anuncios');
    this.mostrarSidebar.set(esAnuncios);
  }
}