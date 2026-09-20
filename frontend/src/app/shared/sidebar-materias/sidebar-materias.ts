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
    { label: 'Anuncios', path: '/view-materia/:id/anuncios' },
    { label: 'Material', path: '/view-materia/:id/material' },
    { label: 'Actividades', path: '/view-materia/:id/actividades' },
    { label: 'Foro', path: '/view-materia/:id/foro' },
    { label: 'Calificaciones', path: '/view-materia/:id/calificaciones' }
  ];
}
