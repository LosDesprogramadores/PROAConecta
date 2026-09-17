import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

interface Noticia {
  id: number;
  titulo: string;
  autor: string;
  fecha: string;
  hora: string;
  contenido: string;
  categoria?: 'Institucional' | 'Académica' | 'Recordatorio' | 'Sistema';
}

@Component({
  selector: 'app-anuncios',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './anuncios.html',
})
export class Anuncios implements OnInit {
  noticias = signal<Noticia[]>([]);
  anuncioSeleccionado = signal<Noticia | null>(null);

  vistaDetalle = computed(() => this.anuncioSeleccionado() !== null);

  constructor(private readonly route: ActivatedRoute) {}

  ngOnInit(): void {
    this.loadNoticias();

    this.route.queryParams.subscribe((params) => {
      const idParam = params['id'];
      if (idParam) {
        const id = Number(idParam);
        const encontrada = this.noticias().find((n) => n.id === id);
        if (encontrada) {
          this.anuncioSeleccionado.set(encontrada);
        }
      }
    });
  }

  private loadNoticias(): void {
    this.noticias.set([
      {
        id: 1,
        titulo: 'Inicio del ciclo lectivo',
        autor: 'Dirección',
        fecha: '20/08/2026',
        hora: '08:00',
        categoria: 'Institucional',
        contenido: `El ciclo lectivo comienza oficialmente el lunes 24 de agosto.

Las actividades académicas se iniciarán en horario de 8:00 de la mañana. 
Por favor, confirmar asistencia en la plataforma antes del viernes.

Recordar traer:
- Documentación completa
- Libreta de calificaciones
- Materiales básicos para cada materia`,
      },
      {
        id: 2,
        titulo: 'Taller de Robótica',
        autor: 'Profesor Gómez',
        fecha: '19/08/2026',
        hora: '15:30',
        categoria: 'Académica',
        contenido: `Se dictará un taller de robótica para alumnos de 5° año en el laboratorio.

Fecha: 28 de agosto de 2026
Horario: 15:00 a 17:00
Lugar: Laboratorio de Informática

El taller cubrirá:
- Introducción a Arduino
- Sensores y actuadores
- Programación básica
- Proyecto integrador

Inscripción obligatoria. Cupos limitados a 20 participantes.`,
      },
      {
        id: 3,
        titulo: 'Cierre de calificaciones',
        autor: 'Coordinación Académica',
        fecha: '18/08/2026',
        hora: '10:15',
        categoria: 'Recordatorio',
        contenido: `Recordamos que el cierre de calificaciones del período anterior será el 30 de agosto.

Todos los docentes deben completar sus calificaciones antes de esa fecha.
Los estudiantes podrán visualizar sus notas a partir del 31 de agosto.

En caso de dudas, contactar a coordinacion@proa.edu.ar`,
      },
      {
        id: 4,
        titulo: 'Mantenimiento del sistema',
        autor: 'Equipo de Sistemas',
        fecha: '17/08/2026',
        hora: '14:45',
        categoria: 'Sistema',
        contenido: `Aviso de mantenimiento programado.

Fecha: Sábado 24 de agosto de 2026
Horario: 22:00 a 06:00 (domingo)

Durante este período, la plataforma ProA Conecta no estará disponible.
Se recomienda realizar todas las tareas pendientes antes de esa fecha.

Disculpamos las molestias.`,
      },
    ]);
  }

  seleccionarAnuncio(noticia: Noticia): void {
    this.anuncioSeleccionado.set(noticia);
  }

  volver(): void {
    this.anuncioSeleccionado.set(null);
  }

  getCategoryBadgeClass(categoria?: string): string {
    const baseClass =
      'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border';

    switch (categoria) {
      case 'Institucional':
        return `${baseClass} bg-blue-50 text-blue-700 border-blue-200`;
      case 'Académica':
        return `${baseClass} bg-purple-50 text-purple-700 border-purple-200`;
      case 'Recordatorio':
        return `${baseClass} bg-amber-50 text-amber-700 border-amber-200`;
      case 'Sistema':
        return `${baseClass} bg-slate-50 text-slate-700 border-slate-200`;
      default:
        return `${baseClass} bg-slate-50 text-slate-700 border-slate-200`;
    }
  }
}