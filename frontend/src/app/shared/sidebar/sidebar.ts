import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  imports: [RouterModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  links = [
    { label: 'Anuncios', path: '/dashboard/anuncios' },
    { label: 'Materias', path: '/dashboard/materias' },
    { label: 'Contacto', path: '/dashboard/contacto' }
  ];
}
