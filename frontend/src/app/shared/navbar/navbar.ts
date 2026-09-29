import { Component, computed, effect, HostListener, inject, signal } from '@angular/core';

import { RouterModule } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { UserRole } from '../../core/auth/auth.model';

import { Toast } from '../toast/toast';
import { ToastService } from '../../services/toast.service';

interface NavLink {
  label: string;
  path: string;
}

@Component({
  selector: 'app-navbar',
  imports: [RouterModule, Toast],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  private authService = inject(AuthService);
  private toastService = inject(ToastService);

  currentUser = this.authService.currentUser;

  loading = signal<boolean>(true);

  isMobileMenuOpen = signal<boolean>(false);

  isProfileMenuOpen = signal<boolean>(false);

  isProfileModalOpen = signal<boolean>(false);

  // Estados para los nuevos menús desplegables
  isMessagesOpen = signal<boolean>(false);
  isNotificationsOpen = signal<boolean>(false);

  unreadCount = signal<number>(4);

  // Datos mock de prueba visual
  messages = [
    { sender: 'Ana López', text: 'Hola profe, le consulto sobre la consigna...', time: 'Hace 10 min' },
    { sender: 'Carlos Ruiz', text: '¿Hay clases de consulta esta semana?', time: 'Hace 1 hora' }
  ];

  notifications = [
    { title: 'Nueva entrega', description: 'Juan Pérez subió la actividad de Backend.', time: 'Hace 5 min' },
    { title: 'Recordatorio', description: 'Cierre de calificaciones en 3 días.', time: 'Hace 2 horas' }
  ];

  navLinksAdmi: NavLink[] = [];

  userAvatar = signal<string>(
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
  );

  navLinks = [
    {
      label: 'Materias',
      path: '/materias',
    },
    {
      label: 'Foros',
      path: '/foros',
    },
    {
      label: 'Actividades',
      path: '/actividades',
    },
  ];

  userName = computed(() => {
    const persona = this.currentUser()?.persona;

    if (!persona) {
      return 'invitado';
    }

    return `${persona.nombre} ${persona.apellido}`;
  });

  constructor() {
    effect(() => {
      const user = this.currentUser();

      if (!user) {
        this.navLinksAdmi = [];

        return;
      }

      switch (user.rolId) {
        case UserRole.ADMIN:
          this.navLinksAdmi = [
            {
              label: 'Profesores',
              path: 'admin/profesores',
            },
            {
              label: 'Estudiantes',
              path: 'admin/estudiantes',
            },
            {
              label: 'Materias',
              path: 'admin/materias',
            },
            {
              label: 'Notificaciones',
              path: 'admin/notificaciones',
            },
          ];

          break;

        case UserRole.DOCENTE:
        case UserRole.ESTUDIANTE:
          this.navLinksAdmi = [];

          break;

        default:
          console.warn('Rol no reconocido:', user.rolId);

          this.navLinksAdmi = [];

          break;
      }
    });
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update((value) => !value);
  }

  toggleProfileMenu(): void {
    this.isProfileMenuOpen.update((value) => !value);
    this.isMessagesOpen.set(false);
    this.isNotificationsOpen.set(false);
  }

  toggleMessages(): void {
    this.isMessagesOpen.update((value) => !value);
    this.isNotificationsOpen.set(false);
    this.isProfileMenuOpen.set(false);
  }

  toggleNotifications(): void {
    this.isNotificationsOpen.update((value) => !value);
    this.isMessagesOpen.set(false);
    this.isProfileMenuOpen.set(false);
  }

  closeMenus(): void {
    this.isMobileMenuOpen.set(false);
    this.isProfileMenuOpen.set(false);
    this.isMessagesOpen.set(false);
    this.isNotificationsOpen.set(false);
  }

  openProfileModal(): void {
    this.closeMenus();

    this.isProfileModalOpen.set(true);
  }

  closeProfileModal(): void {
    this.isProfileModalOpen.set(false);
  }

  logout(): void {
    this.closeMenus();

    this.authService.logout();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    if (
      !target.closest('#user-menu-button') &&
      !target.closest('#user-menu-dropdown') &&
      !target.closest('#messages-button') &&
      !target.closest('#messages-dropdown') &&
      !target.closest('#notifications-button') &&
      !target.closest('#notifications-dropdown')
    ) {
      this.isProfileMenuOpen.set(false);
      this.isMessagesOpen.set(false);
      this.isNotificationsOpen.set(false);
    }
  }

  configuracion(): void {
    this.closeMenus();

    const persona = this.currentUser()?.persona;

    if (persona) {
      this.toastService.info(`Configuración para ${persona.nombre}: en desarrollo`);
    } else {
      this.toastService.info('Configuración: en desarrollo');
    }
  }
}