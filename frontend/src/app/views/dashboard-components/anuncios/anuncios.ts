import { Component, signal } from '@angular/core';

interface Noticia {
  titulo: string;
  autor: string;
  fecha: string;
  hora: string;
  contenido: string;
}

@Component({
  selector: 'app-anuncios',
  imports: [],
  templateUrl: './anuncios.html',
  styleUrl: './anuncios.css',
})
export class Anuncios {
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
}
