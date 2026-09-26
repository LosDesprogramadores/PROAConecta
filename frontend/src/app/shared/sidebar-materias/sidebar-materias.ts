import { Component, OnInit } from '@angular/core';
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
  materiaId: string | null = null;

  links: { label: string; path: string }[] = [];

  areaPersonalPath = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.materiaId =
      this.route.snapshot.paramMap.get('id') ??
      this.route.snapshot.parent?.paramMap.get('id') ??
      null;

    this.configurarRutaAreaPersonal();

    if (this.materiaId) {
      this.links = [
        { label: 'Anuncios', path: `/view-materia/${this.materiaId}/anuncios` },
        { label: 'Material', path: `/view-materia/${this.materiaId}/material` },
        { label: 'Actividades', path: `/view-materia/${this.materiaId}/actividades` },
        { label: 'Calificaciones', path: `/view-materia/${this.materiaId}/calificaciones` },
      ];
    }
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

  onVolver(): void {
    const currentUrl = this.router.url;
    const portadaUrl = `/view-materia/${this.materiaId}/portada`;

    if (this.materiaId && !currentUrl.includes('/portada')) {
      this.router.navigate([portadaUrl]);
    } else if (this.areaPersonalPath) {
      this.router.navigate([this.areaPersonalPath]);
    }
  }
}
