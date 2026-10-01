import { Component, computed, effect, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { UserRole } from '../../core/auth/auth.model';
import { Toast } from '../toast/toast';
import { ToastService } from '../../services/toast.service';
import { NotificacionSocketService } from '../../services/notificacion-socket.service';
import { INotificacion } from '../../model/notificacion.model';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { NotificacionService } from '../../services/notificaciones.service';

interface NavLink {
  label: string;
  path: string;
}

interface Message {
  sender: string;
  text: string;
  time: string;
}

interface NotificationItem {
  title: string;
  description: string;
  time: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterModule, Toast, CommonModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private notiSocketService = inject(NotificacionSocketService);
  private router = inject(Router);
  private notiService = inject(NotificacionService);

  private socketSub$!: Subscription;

  currentUser = this.authService.currentUser;

  isMobileMenuOpen = signal<boolean>(false);
  isProfileMenuOpen = signal<boolean>(false);
  isProfileModalOpen = signal<boolean>(false);

  isMessagesOpen = signal<boolean>(false);
  isNotificationsOpen = signal<boolean>(false);

  unreadCount = signal<number>(0);

  messages = signal<Message[]>([
    { sender: 'Profesor Gomez', text: 'Hola, te escribo por la tarea...', time: 'Hace 10 min' },
    { sender: 'Maria Perez', text: '¿Nos juntamos a estudiar?', time: 'Hace 1 hora' }
  ]);

   notifications = signal<INotificacion[]>([]);

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
    this.cargarHistorialNotificaciones();

   this.socketSub$ = this.notiSocketService.escucharNotificaciones().subscribe({
      next: (nuevaNoti: INotificacion) => {
        const user = this.currentUser();
        if (!user) return;

        const rolUsuario = user.rolId;

        console.log('--- LLEGÓ NOTIFICACIÓN ---');
        console.log('Título:', nuevaNoti.titulo);
        console.log('Alcance crudo desde BD/WS:', JSON.stringify(nuevaNoti.alcance));
        console.log('Mi rol actual:', rolUsuario);
        console.log('Mi rol en el websocket:', nuevaNoti.alcance);
        const alcance = (nuevaNoti.alcance || '').toLowerCase().trim();
        let esParaMi = false;

         if (rolUsuario === UserRole.ADMIN) {
          esParaMi = true;
        } 
       else if (nuevaNoti.alcance === 'TODOS' || nuevaNoti.alcance === 'AMBOS') {
          esParaMi = true;
        } 
        else if (rolUsuario === UserRole.ESTUDIANTE && nuevaNoti.alcance === 'ESTUDIANTE') {
           if (!nuevaNoti.materia_id) {
            esParaMi = true; 
          } else {
        
            esParaMi = true; 
          }
        } 
     
         else if (rolUsuario === UserRole.DOCENTE && nuevaNoti.alcance === 'PROFESOR') {
          esParaMi = true;
        }

        if (!esParaMi) {
          return;
        }

        this.notifications.update(lista => [nuevaNoti, ...lista]);
        this.unreadCount.update(count => count + 1);
        this.toastService.info(`🔔 ${nuevaNoti.titulo}`);
      },
      error: (err) => {
        console.error('Error en el socket del navbar:', err);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.socketSub$) {
      this.socketSub$.unsubscribe();
    }
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

    if (this.isNotificationsOpen()) {
      this.unreadCount.set(0);
    }
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

  cargarHistorialNotificaciones(): void {
    this.notiService.obtenerNotificaciones().subscribe({
      next: (data: INotificacion[]) => {
        this.notifications.set(data);
        this.unreadCount.set(0); 
      },
      error: (err) => {
        console.error('Error al cargar historial de notificaciones:', err);
      }
    });
  }
}