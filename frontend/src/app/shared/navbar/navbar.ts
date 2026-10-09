import { Component, computed, effect, HostListener, inject, OnInit, signal } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { UserRole } from '../../core/auth/auth.model';
import { ToastService } from '../../services/toast.service';
import { INotificacion } from '../../model/notificacion.model';
import { CommonModule } from '@angular/common';
import { NotificacionesEstadoService } from '../../services/notificaciones-estado.service';
import { MensajesEstadoService } from '../../services/mensajes-estado.service';

import { Modal } from '../modal/modal';
interface NavLink {
  label: string;
  path: string;
  queryParams?: Record<string, string>;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [Modal, RouterModule, CommonModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar implements OnInit {
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private notificacionesEstado = inject(NotificacionesEstadoService);
  private mensajesEstado = inject(MensajesEstadoService);

  currentUser = this.authService.currentUser;

  isMobileMenuOpen = signal<boolean>(false);
  isProfileMenuOpen = signal<boolean>(false);
  isProfileModalOpen = signal<boolean>(false);

  isMessagesOpen = signal<boolean>(false);
  isNotificationsOpen = signal<boolean>(false);

  // Real unread counter and last five notifications, shared with the notifications page.
  unreadCount = this.notificacionesEstado.noLeidas;
  notifications = this.notificacionesEstado.ultimas;
  notificationsLoading = this.notificacionesEstado.cargando;
  notificationsError = this.notificacionesEstado.error;

  // Last five received messages and the real unread counter (live through the socket).
  messages = this.mensajesEstado.ultimos;
  unreadMessages = this.mensajesEstado.noLeidos;
  messagesLoading = this.mensajesEstado.cargando;
  messagesError = this.mensajesEstado.error;

  navLinksAdmi: NavLink[] = [];

  navLinks: NavLink[] = [];

  navLinksMateria: NavLink[] = [];

  userAvatar = signal<string>(
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
  );

  userName = computed(() => {
    const persona = this.currentUser()?.persona;

    if (!persona) {
      return 'invitado';
    }

    return `${persona.nombre} ${persona.apellido}`;
  });

  isMateriaRoute = computed(() => {
    return this.router.url.startsWith('/view-materia/');
  });

  constructor() {
    effect(() => {
      const user = this.currentUser();

      if (!user) {
        this.navLinksAdmi = [];
        this.navLinks = [];
        this.navLinksMateria = [];
        return;
      }

      if (this.isMateriaRoute()) {
        this.navLinksAdmi = [];
        this.navLinks = [];
        this.navLinksMateria = this.obtenerLinksMateria();
        return;
      }

      this.navLinksMateria = [];

      switch (user.rolId) {
        case UserRole.ADMIN:
          this.navLinksAdmi = [
            {
              label: 'Profesores',
              path: '/dashboard-admin/profesores',
            },
            {
              label: 'Estudiantes',
              path: '/dashboard-admin/estudiantes',
            },
            {
              label: 'Materias',
              path: '/dashboard-admin/materias',
            },
            {
              label: 'Notificaciones',
              path: '/dashboard-admin/notificaciones',
            },
          ];

          this.navLinks = [];
          break;

        case UserRole.DOCENTE:
          this.navLinksAdmi = [];
          this.navLinks = []; // Limpiamos para que no aparezcan links sueltos arriba
          break;

        case UserRole.ESTUDIANTE:
          this.navLinksAdmi = [];
          this.navLinks = []; // Limpiamos para que no aparezcan links sueltos arriba
          break;

        default:
          console.warn('Rol no reconocido:', user.rolId);

          this.navLinksAdmi = [];
          this.navLinks = [];
          break;
      }
    });
  }

  ngOnInit(): void {
    const user = this.currentUser();
    if (user) {
      this.notificacionesEstado.iniciar();
      // The administrator has no private inbox (the server answers 403).
      if (user.rolId !== UserRole.ADMIN) {
        this.mensajesEstado.iniciar();
      }
    }
  }

  marcarNotificacionLeida(notif: INotificacion): void {
    this.notificacionesEstado.marcarLeida(notif).subscribe({ error: () => undefined });
  }

  private obtenerLinksMateria(): NavLink[] {
    const url = this.router.url;

    const match = url.match(/^\/view-materia\/([^/]+)/);
    const materiaId = match?.[1];

    if (!materiaId) {
      return [];
    }
    const user = this.currentUser();
    const esEstudiante = user?.rolId === UserRole.ESTUDIANTE;

    if (esEstudiante) {
      // Rutas específicas del Estudiante
      return [
        {
          label: 'Anuncios',
          path: `/view-materia/${materiaId}/anuncios`,
        },
        {
          label: 'Material',
          path: `/view-materia/${materiaId}/estudiante/material`,
        },
        {
          label: 'Actividades',
          path: `/view-materia/${materiaId}/estudiante/actividades`,
        },
        {
          label: 'Calificaciones',
          path: `/view-materia/${materiaId}/estudiante/calificaciones`,
        },
        { label: 'Mensajes', path: '/dashboard/mensajes', queryParams: { materia: materiaId } },
      ];
    }

    const links: NavLink[] = [
      {
        label: 'Anuncios',
        path: `/view-materia/${materiaId}/anuncios`,
      },
      {
        label: 'Material',
        path: `/view-materia/${materiaId}/material`,
      },
      {
        label: 'Actividades',
        path: `/view-materia/${materiaId}/actividades`,
      },
      {
        label: 'Calificaciones',
        path: `/view-materia/${materiaId}/calificaciones`,
      },
    ];

    if (user?.rolId === UserRole.DOCENTE) {
      links.push({ label: 'Alumnos', path: `/view-materia/${materiaId}/alumnos` });
      links.push({ label: 'Mensajes', path: '/dashboard/mensajes', queryParams: { materia: materiaId } });
    }

    return links;
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
