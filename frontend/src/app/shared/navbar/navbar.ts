import { Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, RouterModule, Router } from '@angular/router';
import { filter, map } from 'rxjs';
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
  /** Highlight the link only when the URL matches it exactly. */
  exact?: boolean;
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

  // Reactive URL: the navbar lives across navigations, so the section links must follow it.
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Materia the user is in: the /view-materia/<id> path, or the "materia" filter of the inbox. */
  private readonly materiaId = computed(() => {
    const url = this.url();
    const deRuta = url.match(/^\/view-materia\/([^/?#]+)/)?.[1];
    if (deRuta) {
      return deRuta;
    }
    if (url.startsWith('/dashboard/mensajes')) {
      return this.router.parseUrl(url).queryParams['materia'] ?? null;
    }
    return null;
  });

  isMateriaRoute = computed(() => this.materiaId() !== null);

  /** Home of each role; visitors without a session go to the public home. */
  inicioPath = computed(() => {
    switch (this.currentUser()?.rolId) {
      case UserRole.ADMIN:
        return '/dashboard-admin';
      case UserRole.DOCENTE:
        return '/dashboard/welcome';
      case UserRole.ESTUDIANTE:
        return '/dashboard/estudiante/welcome';
      default:
        return '/';
    }
  });

  navLinksAdmi = computed<NavLink[]>(() => {
    if (this.isMateriaRoute() || this.currentUser()?.rolId !== UserRole.ADMIN) {
      return [];
    }
    return [
      { label: 'Profesores', path: '/dashboard-admin/profesores' },
      { label: 'Estudiantes', path: '/dashboard-admin/estudiantes' },
      { label: 'Materias', path: '/dashboard-admin/materias' },
      { label: 'Notificaciones', path: '/dashboard-admin/notificaciones' },
    ];
  });

  navLinksMateria = computed<NavLink[]>(() => {
    const materiaId = this.materiaId();
    return this.currentUser() && materiaId ? this.obtenerLinksMateria(materiaId) : [];
  });

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

  private obtenerLinksMateria(materiaId: string): NavLink[] {
    const user = this.currentUser();
    const esEstudiante = user?.rolId === UserRole.ESTUDIANTE;

    if (esEstudiante) {
      // Student routes. Material is reached from the materia cover page.
      return [
        {
          label: 'Portada',
          path: `/view-materia/${materiaId}/estudiante/portada`,
          exact: true,
        },
        {
          label: 'Anuncios',
          path: `/view-materia/${materiaId}/anuncios`,
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

    // Professor cover is role-specific; the administrator uses the shared materia cover.
    const portada: NavLink =
      user?.rolId === UserRole.DOCENTE
        ? { label: 'Portada', path: `/view-materia/${materiaId}/portada-profesor`, exact: true }
        : { label: 'Portada', path: `/view-materia/${materiaId}/portada`, exact: true };

    const links: NavLink[] = [
      portada,
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
