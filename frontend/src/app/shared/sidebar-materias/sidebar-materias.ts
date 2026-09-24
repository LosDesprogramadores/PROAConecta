import { Component, OnInit } from '@angular/core';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';

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

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.materiaId =
      this.route.snapshot.paramMap.get('id') ??
      this.route.snapshot.parent?.paramMap.get('id') ??
      null;

    if (this.materiaId) {
      this.links = [
        { label: 'Anuncios', path: `/view-materia/${this.materiaId}/anuncios` },
        { label: 'Material', path: `/view-materia/${this.materiaId}/material` },
        { label: 'Actividades', path: `/view-materia/${this.materiaId}/actividades` },
        { label: 'Foro', path: `/view-materia/${this.materiaId}/foro` },
        { label: 'Calificaciones', path: `/view-materia/${this.materiaId}/calificaciones` }
      ];
    }
  }

  onVolver(): void {
    const currentUrl = this.router.url;
    const portadaUrl = `/view-materia/${this.materiaId}/portada`;

    if (this.materiaId && !currentUrl.includes('/portada')) {
      this.router.navigate([portadaUrl]);
    } else {
      this.router.navigate(['/dashboard/welcome']);
    }
  }
}