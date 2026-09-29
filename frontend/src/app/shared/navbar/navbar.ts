import { Component, computed, effect, HostListener, inject, signal } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
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
  private router = inject(Router);

  currentUser = this.authService.currentUser;

  isMobileMenuOpen = signal<boolean>(false);
  isProfileMenuOpen = signal<boolean>(false);
  isProfileModalOpen = signal<boolean>(false);

  unreadCount = signal<number>(4);

  /**
   * Rutas administrativas.
   * Se muestran únicamente dentro del toggler en pantallas menores a lg.
   */
  navLinksAdmi: NavLink[] = [];

  /**
   * Rutas del dashboard según el rol.
   * Se muestran únicamente dentro del toggler en pantallas menores a lg.
   */
  navLinks: NavLink[] = [];

  /**
   * Rutas específicas de una materia.
   * Se muestran únicamente dentro del toggler cuando estamos
   * dentro de /view-materia/:id.
   */
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

  /**
   * Indica si actualmente estamos dentro del dashboard de una materia.
   */
  isMateriaRoute = computed(() => {
    return this.router.url.startsWith('/view-materia/');
  });

  constructor() {
    effect(() => {
      const user = this.currentUser();

      // Limpiamos todas las rutas si no hay usuario autenticado.
      if (!user) {
        this.navLinksAdmi = [];
        this.navLinks = [];
        this.navLinksMateria = [];
        return;
      }

      // Si estamos dentro de una materia, solamente cargamos
      // las rutas propias de la materia.
      if (this.isMateriaRoute()) {
        this.navLinksAdmi = [];
        this.navLinks = [];

        this.navLinksMateria = this.obtenerLinksMateria();

        return;
      }

      // Si estamos fuera de una materia, limpiamos sus rutas.
      this.navLinksMateria = [];

      switch (user.rolId) {
        case UserRole.ADMIN:
          this.navLinksAdmi = [
            {
              label: 'Profesores',
              path: '/admin/profesores',
            },
            {
              label: 'Estudiantes',
              path: '/admin/estudiantes',
            },
            {
              label: 'Materias',
              path: '/admin/materias',
            },
            {
              label: 'Notificaciones',
              path: '/admin/notificaciones',
            },
          ];

          this.navLinks = [];
          break;

        case UserRole.DOCENTE:
          this.navLinksAdmi = [];

          this.navLinks = [
            {
              label: 'Mis Clases',
              path: '/docente/materias',
            },
            {
              label: 'Calificaciones',
              path: '/docente/calificaciones',
            },
          ];

          break;

        case UserRole.ESTUDIANTE:
          this.navLinksAdmi = [];

          this.navLinks = [
            {
              label: 'Anuncios',
              path: '/dashboard/estudiante/anuncios',
            },
            {
              label: 'Materias',
              path: '/dashboard/estudiante/materias',
            },
            {
              label: 'Contacto',
              path: '/dashboard/estudiante/contacto',
            },
          ];

          break;

        default:
          console.warn('Rol no reconocido:', user.rolId);

          this.navLinksAdmi = [];
          this.navLinks = [];
          break;
      }
    });
  }

  private obtenerLinksMateria(): NavLink[] {
    const url = this.router.url;

    const match = url.match(/^\/view-materia\/([^/]+)/);
    const materiaId = match?.[1];

    if (!materiaId) {
      return [];
    }

    return [
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
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update((value) => !value);
  }

  toggleProfileMenu(): void {
    this.isProfileMenuOpen.update((value) => !value);
  }

  closeMenus(): void {
    this.isMobileMenuOpen.set(false);
    this.isProfileMenuOpen.set(false);
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

    if (!target.closest('#user-menu-button') && !target.closest('#user-menu-dropdown')) {
      this.isProfileMenuOpen.set(false);
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
