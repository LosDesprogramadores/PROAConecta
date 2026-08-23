import { Component, Input, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from '../../shared/navbar/navbar';
import { Footer } from '../../shared/footer/footer';
import { SidebarMaterias } from '../../shared/sidebar-materias/sidebar-materias';
import { ForoComponent } from '../../views/materias-components/foro/foro';
@Component({
  selector: 'app-materias-layout',
  imports: [RouterOutlet,Navbar,Footer,SidebarMaterias, ForoComponent],
  templateUrl: './materias-layout.html',
  styleUrl: './materias-layout.css',
})

export class MateriasLayout {
  @Input() materiaId!: string;
  activeTab = signal<'portada' | 'foro'>('portada');
  // ...
}

