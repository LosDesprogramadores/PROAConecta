import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { Informacion } from '../informacion/informacion';
import { MateriasResumen } from '../materias-resumen/materias-resumen'; // Importar nuevo componente
import { ProximasEntregas } from '../proximas-entregas/proximas-entregas';

interface Noticia {
  fecha: string;
  hora: string;
  titulo: string;
  autor: string;
  contenido: string;
}

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, RouterLink, Informacion, MateriasResumen, ProximasEntregas],
  templateUrl: './welcome.html',
  styleUrls: ['./welcome.css'],
})
export class Welcome implements OnInit {
  noticias = signal<Noticia[]>([]);

  constructor(private readonly authService: AuthService) {}

  userName = computed(() => {
    const persona = this.authService.currentUser()?.persona;
    return persona ? `${persona.nombre} ${persona.apellido}` : 'Usuario';
  });

  ngOnInit(): void {
    this.loadNoticias();
  }

  private loadNoticias(): void {
    this.noticias.set([
      {
        fecha: '20/08/2026',
        hora: '08:00',
        titulo: 'Inicio del ciclo lectivo',
        autor: 'Dirección',
        contenido: 'El ciclo lectivo comienza oficialmente el lunes 24 de agosto.',
      },
    ]);
  }
}