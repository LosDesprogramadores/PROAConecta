import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, map, of, switchMap } from 'rxjs';

import { ActividadesService, Entrega } from '../../../services/actividades.service'; // ajustá la ruta

interface ColumnaActividad {
  id: number;
  titulo: string;
}

interface FilaAlumno {
  key: string | number;
  nombre: string;
  notas: (number | null)[]; // mismo orden que las columnas
}

@Component({
  selector: 'app-calificaciones-profesor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calificaciones-profesor.html',
})
export class CalificacionesProfesor implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private actividadesService = inject(ActividadesService);

  materiaId!: number;

  columnas = signal<ColumnaActividad[]>([]);
  filas = signal<FilaAlumno[]>([]);
  cargando = signal(false);
  error = signal('');

  promedios = computed(() =>
    this.filas().map(f => {
      const cargadas = f.notas.filter((n): n is number => n !== null);
      if (cargadas.length === 0) return null;
      const suma = cargadas.reduce((t, n) => t + n, 0);
      return Number((suma / cargadas.length).toFixed(2));
    })
  );

  ngOnInit(): void {
    const p = this.route.snapshot.paramMap;
    const pp = this.route.parent?.snapshot.paramMap;
    this.materiaId = Number(
      p.get('materiaId') ?? p.get('id') ?? pp?.get('materiaId') ?? pp?.get('id')
    );
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');

    this.actividadesService
      .getActividadesPorMateria(this.materiaId)
      .pipe(
        switchMap(actividades => {
          const publicadas = actividades.filter(a => a.estado === 'PUBLICADA');
          if (publicadas.length === 0) {
            return of({ publicadas, entregas: [] as Entrega[][] });
          }
          return forkJoin(
            publicadas.map(a => this.actividadesService.getEntregas(a.id))
          ).pipe(map(entregas => ({ publicadas, entregas })));
        })
      )
      .subscribe({
        next: ({ publicadas, entregas }) => {
          this.columnas.set(
            publicadas.map(a => ({ id: a.id, titulo: a.titulo }))
          );
          this.filas.set(this.armarFilas(entregas));
          this.cargando.set(false);
        },
        error: () => {
          this.error.set('No se pudieron cargar las calificaciones.');
          this.cargando.set(false);
        },
      });
  }

  // entregasPorActividad[i] = entregas de la actividad i (mismo orden que columnas)
  private armarFilas(entregasPorActividad: Entrega[][]): FilaAlumno[] {
    const mapa = new Map<string | number, FilaAlumno>();
    const total = entregasPorActividad.length;

    entregasPorActividad.forEach((entregas, i) => {
      for (const e of entregas) {
        const key = e.estudiante ?? e.estudiante_nombre;
        if (!mapa.has(key)) {
          mapa.set(key, {
            key,
            nombre: e.estudiante_nombre,
            notas: Array(total).fill(null),
          });
        }
        mapa.get(key)!.notas[i] = e.nota ? Number(e.nota.calificacion) : null;
      }
    });

    return [...mapa.values()].sort((a, b) =>
      a.nombre.localeCompare(b.nombre)
    );
  }

  irACalificar(actividadId: number): void {
    this.router.navigate([
      '/view-materia', this.materiaId, 'actividades', actividadId, 'entregas',
    ]);
  }
}