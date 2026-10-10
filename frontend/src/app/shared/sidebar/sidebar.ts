import { Component, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { UserRole } from '../../core/auth/auth.model';

interface NavLink {
  label: string;
  path: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar implements OnInit {
  private authService = inject(AuthService);

  links: NavLink[] = [];

  areaPersonalPath = '';

  ngOnInit(): void {
    const rol = this.authService.rol();

    switch (rol) {
      case UserRole.ADMIN:
        this.areaPersonalPath = '/admin';

        this.links = [
          { label: 'Profesores', path: '/admin/Profesores' },
          { label: 'Estudiantes', path: '/admin/estudiantes' },
          { label: 'Materias', path: '/admin/Materias' },
        ];

        break;

      case UserRole.DOCENTE:
        this.areaPersonalPath = '/dashboard/welcome';

        this.links = [
          { label: 'Mis Clases', path: '/docente/materias' },
          { label: 'Calificaciones', path: '/docente/calificaciones' },
        ];

        break;

      case UserRole.ESTUDIANTE:
        this.areaPersonalPath = '/dashboard/estudiante/welcome';
        this.links = [
          { label: 'Anuncios', path: '/dashboard/anuncios' },
          { label: 'Materias', path: '/dashboard/estudiante/materias' },
          { label: 'Contacto', path: '/dashboard/estudiante/contacto' },
        ];

        break;

      default:
        console.warn('Rol no reconocido:', rol);

        this.areaPersonalPath = '';
        this.links = [];

        break;
    }
  }
}
