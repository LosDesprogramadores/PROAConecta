import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-sidebar-materias',
  imports: [RouterModule],
  templateUrl: './sidebar-materias.html',
  styleUrl: './sidebar-materias.css',
})
export class SidebarMaterias {
  links = [
    { label: 'Anuncios', path: '/view-materia/anuncios' },
    { label: 'Material', path: '/view-materia/material' },
    { label: 'Actividades', path: '/view-materia/actividades' },
    { label: 'Foro', path: '/view-materia/foro' },
    { label: 'Calificaciones', path: '/view-materia/calificaciones' }
  ];
}
