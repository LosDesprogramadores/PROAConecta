import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';
import { UserRole } from '../../core/auth/auth.model';

interface Feature {
  icon: string;
  title: string;
  description: string;
}

interface Step {
  number: number;
  title: string;
  description: string;
}

interface Stat {
  value: string;
  label: string;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private authService = inject(AuthService);

  currentUser = this.authService.currentUser;
  userRole = UserRole;

  // Features - Lo que podés hacer en la plataforma
  features = signal<Feature[]>([
    {
      icon: '📚',
      title: 'Accedé a tus cursos',
      description: 'Materiales, videos, guías organizadas por unidad'
    },
    {
      icon: '💬',
      title: 'Participa en foros',
      description: 'Discute con compañeros y resuelve dudas'
    },
    {
      icon: '✓',
      title: 'Entrega trabajos',
      description: 'Sube tareas y recibe feedback de tus docentes'
    },
    {
      icon: '🔔',
      title: 'Recibe notificaciones',
      description: 'Nunca te pierdas fechas de entrega ni anuncios'
    }
  ]);

  // Steps - Cómo funciona la plataforma
  steps = signal<Step[]>([
    {
      number: 1,
      title: 'Dashboard personalizado',
      description: 'Ves tus cursos, tareas pendientes y anuncios al entrar'
    },
    {
      number: 2,
      title: 'Contenido organizado',
      description: 'Cada curso tiene sus unidades, materiales y cronograma'
    },
    {
      number: 3,
      title: 'Colabora en equipo',
      description: 'Foros, mensajes y espacios para trabajar junto con compañeros'
    }
  ]);

  // Stats - Actividad de la plataforma
  stats = signal<Stat[]>([
    { value: '200+', label: 'Usuarios activos' },
    { value: '500+', label: 'Posts en foros' },
    { value: '25', label: 'Cursos disponibles' },
    { value: '99%', label: 'Uptime' }
  ]);
}