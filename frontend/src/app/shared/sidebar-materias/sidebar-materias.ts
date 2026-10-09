import { Component, OnInit, inject } from '@angular/core';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { UserRole } from '../../core/auth/auth.model';

@Component({
  selector: 'app-sidebar-materias',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './sidebar-materias.html',
  styleUrl: './sidebar-materias.css',
})
export class SidebarMaterias implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);

  materiaId: string | null = null;

  links: { label: string; path: string; queryParams?: Record<string, string> }[] = [];

  areaPersonalPath = '';

  ngOnInit(): void {
    this.materiaId =
      this.route.snapshot.paramMap.get('id') ??
      this.route.snapshot.parent?.paramMap.get('id') ??
      null;

    this.configurarRutaAreaPersonal();
    this.configurarLinks();
  }

  private configurarRutaAreaPersonal(): void {
    switch (this.authService.rol()) {
      case UserRole.ESTUDIANTE:
        this.areaPersonalPath = '/dashboard/estudiante/welcome';
        break;

      case UserRole.DOCENTE:
        this.areaPersonalPath = '/dashboard/welcome';
        break;

      default:
        this.areaPersonalPath = '/dashboard/welcome';
        break;
    }
  }

  private configurarLinks(): void {
    if (!this.materiaId) {
      return;
    }

    const linksGenerales = [
      {
        label: 'Anuncios',
        path: `/view-materia/${this.materiaId}/anuncios`,
      },
      {
        label: 'Material',
        path: `/view-materia/${this.materiaId}/material`,
      },
      {
        label: 'Actividades',
        path: `/view-materia/${this.materiaId}/actividades`,
      },
    ];

    // The inbox is global; the query param filters it by this subject.
    const linkMensajes = {
      label: 'Mensajes',
      path: '/dashboard/mensajes',
      queryParams: { materia: this.materiaId },
    };

    switch (this.authService.rol()) {
      case UserRole.ESTUDIANTE:
        this.links = [
          ...linksGenerales,
          {
            label: 'Calificaciones',
            path: `/view-materia/${this.materiaId}/calificaciones`,
          },
          linkMensajes,
        ];
        break;

      case UserRole.DOCENTE:
        this.links = [
          ...linksGenerales,
          {
            label: 'Calificaciones',
            path: `/view-materia/${this.materiaId}/calificaciones-profesor`,
          },
          {
            label: 'Alumnos',
            path: `/view-materia/${this.materiaId}/alumnos`,
          },
          linkMensajes,
        ];
        break;

      default:
        this.links = linksGenerales;
        break;
    }
  }

  onVolver(): void {
    const currentUrl = this.router.url;
    const portadaUrl = `/view-materia/${this.materiaId}`;

    if (this.materiaId && !currentUrl.includes('/portada')) {
      this.router.navigate([portadaUrl]);
    } else if (this.areaPersonalPath) {
      this.router.navigate([this.areaPersonalPath]);
    }
  }
}
