import { Component, signal, inject, computed } from '@angular/core';
import { Noticia } from '../../../model/noticia.model';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/auth/auth.service';
import { Materia } from '../../../model/materia.model';

@Component({
  selector: 'app-welcome',
  imports: [RouterModule, CommonModule],
  templateUrl: './welcome.html',
  styleUrl: './welcome.css',
})
export class Welcome {
 private authService = inject(AuthService);
 private currentUser = this.authService.currentUser
 
 
userName = computed(() => {
    
    const persona = this.currentUser()?.persona;;
    if (!persona) return 'Invitado';
    return `${persona.nombre} `;
  });


noticias = signal<Noticia[]>([
    {
      titulo: 'Inicio del ciclo lectivo',
      autor: 'Dirección',
      fecha: '20/08/2026',
      hora: '08:00',
      contenido: 'El ciclo lectivo comienza oficialmente el lunes 24 de agosto.'
    },
    {
      titulo: 'Taller de Robótica',
      autor: 'Profesor Gómez',
      fecha: '19/08/2026',
      hora: '15:30',
      contenido: 'Se dictará un taller de robótica para alumnos de 5° año en el laboratorio.'
    }
  ]);

  materias = signal<Materia[]>([
    { nombre: 'Matemática', color: 'bg-red-300', path: '/dashboard/materias/matematica' },
    { nombre: 'Lengua', color: 'bg-blue-300', path: '/dashboard/materias/lengua' },
    { nombre: 'Historia', color: 'bg-green-300', path: '/dashboard/materias/historia' }
  ]);
}
