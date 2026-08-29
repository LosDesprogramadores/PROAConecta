import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PublicacionForo } from '../../../../model/publicacion.model';

@Component({
  selector: 'app-foro-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './foro-detalle.html'
})
export class ForoDetalleComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  temaId = signal<string | null>(null);
  tituloTema = signal('Espacio de consultas: Unidad 3 - Arquitectura en Angular y Signals');
  materia = signal('Ingeniería de Software - TSDS');
  ordenSeleccionado = signal('antiguo');
  publicaciones = signal<PublicacionForo[]>([]);
  nuevaRespuesta = signal('');
  mostrandoFormulario = signal(false);

  ngOnInit() {
    // Lee el ID enviado por la URL (/view-materia/foro/:id)
    const id = this.route.snapshot.paramMap.get('id');
    this.temaId.set(id);

    this.cargarPublicaciones();
  }

  volverAlForo() {
    this.router.navigate(['/view-materia/foro']);
  }

  cargarPublicaciones() {
    this.publicaciones.set([
      {
        id: 1,
        temaId: Number(this.temaId()) || 1,
        autor: 'Prof. Carlos Mendoza',
        inicialesAutor: 'C',
        fecha: new Date('2026-08-10T09:30:00'),
        contenido: 'Estimados alumnos, abrimos este espacio para resolver dudas sobre la implementación de Signals en Angular 18 y patrones de arquitectura limpia. ¡Los leo!'
      },
      {
        id: 2,
        temaId: Number(this.temaId()) || 1,
        autor: 'Sofía Martínez',
        inicialesAutor: 'S',
        fecha: new Date('2026-08-12T14:15:00'),
        contenido: 'Buenas tardes Profe. Una duda: ¿es conveniente reemplazar completamente BehaviorSubject por Signals en los servicios de datos compartidos?',
        esRespuesta: true
      }
    ]);
  }

  ordenarPublicaciones(e: Event) {
    const valor = (e.target as HTMLSelectElement).value;
    this.ordenSeleccionado.set(valor);
    
    const lista = [...this.publicaciones()];
    const principal = lista[0];
    const respuestas = lista.slice(1);

    respuestas.sort((a, b) => {
      return valor === 'antiguo' 
        ? a.fecha.getTime() - b.fecha.getTime() 
        : b.fecha.getTime() - a.fecha.getTime();
    });

    this.publicaciones.set([principal, ...respuestas]);
  }

  enviarRespuesta() {
    if (!this.nuevaRespuesta().trim()) return;

    const nueva: PublicacionForo = {
      id: Date.now(),
      temaId: Number(this.temaId()) || 1,
      autor: 'Juan Pérez',
      inicialesAutor: 'J',
      fecha: new Date(),
      contenido: this.nuevaRespuesta(),
      esRespuesta: true
    };

    this.publicaciones.update(pub => [...pub, nueva]);
    this.nuevaRespuesta.set('');
    this.mostrandoFormulario.set(false);
  }

  formatearFecha(fecha: Date): string {
    return new Date(fecha).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}