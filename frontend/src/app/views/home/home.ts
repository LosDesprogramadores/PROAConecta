import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';
import { UserRole } from '../../core/auth/auth.model';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

interface Feature {
  iconHtml: SafeHtml;
  title: string;
  description: string;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private authService = inject(AuthService);
  private sanitizer = inject(DomSanitizer);

  currentUser = this.authService.currentUser;
  userRole = UserRole;

  primaryAction = computed(() => {
    const user = this.currentUser();
    if (!user) {
      return { label: 'Explorar', route: '/login' };
    }
    if (user.rolId === UserRole.ADMIN) {
      return { label: 'Ir a Panel', route: '/dashboard-admin' };
    }
    return { label: 'Ir a mi Panel', route: '/dashboard' };
  });

  // SVGs limpios de Lucide inyectados de forma segura sin errores de contexto
  features = signal<Feature[]>([
    {
      iconHtml: this.sanitizer.bypassSecurityTrustHtml(`
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h12"/><path d="M6 10h12"/></svg>
      `),
      title: 'Accedé a tus cursos',
      description: 'Materiales, videos, guías organizadas por unidad'
    },
    {
      iconHtml: this.sanitizer.bypassSecurityTrustHtml(`
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      `),
      title: 'Participa en foros',
      description: 'Discute con compañeros y resuelve dudas'
    },
    {
      iconHtml: this.sanitizer.bypassSecurityTrustHtml(`
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      `),
      title: 'Entrega trabajos',
      description: 'Sube tareas y recibe feedback de tus docentes'
    },
    {
      iconHtml: this.sanitizer.bypassSecurityTrustHtml(`
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-8 h-8"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
      `),
      title: 'Recibe notificaciones',
      description: 'Nunca te pierdas fechas de entrega ni anuncios'
    }
  ]);

  steps = signal([
    { number: 1, title: 'Dashboard personalizado', description: 'Ves tus cursos, tareas pendientes y anuncios al entrar' },
    { number: 2, title: 'Contenido organizado', description: 'Cada curso tiene sus unidades, materiales y cronograma' },
    { number: 3, title: 'Colabora en equipo', description: 'Foros, mensajes y espacios para trabajar junto con compañeros' }
  ]);

  stats = signal([
    { value: '200+', label: 'Usuarios activos' },
    { value: '500+', label: 'Posts en foros' },
    { value: '25', label: 'Cursos disponibles' },
    { value: '99%', label: 'Uptime' }
  ]);
}