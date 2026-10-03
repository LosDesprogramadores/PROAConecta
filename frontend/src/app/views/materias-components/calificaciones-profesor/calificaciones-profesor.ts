import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { ActividadesService, Entrega } from '../../../services/actividades.service';

interface ColumnaActividad {
  id: number;
  titulo: string;
}

interface FilaAlumno {
  key: string | number;
  nombre: string;
  notas: (number | null)[];
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
    this.filas().map((fila) => {
      const cargadas = fila.notas.filter((nota): nota is number => nota !== null);

      if (cargadas.length === 0) {
        return null;
      }

      const suma = cargadas.reduce((total, nota) => total + nota, 0);

      return Number((suma / cargadas.length).toFixed(2));
    }),
  );

  ngOnInit(): void {
    const materiaId = Number(this.route.parent?.snapshot.paramMap.get('id'));

    if (!materiaId) {
      this.error.set('No se pudo identificar la materia.');
      return;
    }

    this.materiaId = materiaId;
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');

    this.actividadesService
      .getActividadesPorMateria(this.materiaId)
      .pipe(
        switchMap((actividades) => {
          const publicadas = actividades.filter((actividad) => actividad.estado === 'PUBLICADA');

          if (publicadas.length === 0) {
            return of({
              publicadas,
              entregas: [] as Entrega[][],
            });
          }

          return forkJoin(
            publicadas.map((actividad) => this.actividadesService.getEntregas(actividad.id)),
          ).pipe(
            map((entregas) => ({
              publicadas,
              entregas,
            })),
          );
        }),
      )
      .subscribe({
        next: ({ publicadas, entregas }) => {
          this.columnas.set(
            publicadas.map((actividad) => ({
              id: actividad.id,
              titulo: actividad.titulo,
            })),
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

  private armarFilas(entregasPorActividad: Entrega[][]): FilaAlumno[] {
    const mapa = new Map<string | number, FilaAlumno>();
    const total = entregasPorActividad.length;

    entregasPorActividad.forEach((entregas, indiceActividad) => {
      for (const entrega of entregas) {
        const key = entrega.estudiante ?? entrega.estudiante_nombre;

        if (!mapa.has(key)) {
          mapa.set(key, {
            key,
            nombre: entrega.estudiante_nombre,
            notas: Array(total).fill(null),
          });
        }

        mapa.get(key)!.notas[indiceActividad] = entrega.nota
          ? Number(entrega.nota.calificacion)
          : null;
      }
    });

    return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  irACalificar(actividadId: number): void {
    this.router.navigate(['/view-materia', this.materiaId, 'actividades', actividadId, 'entregas']);
  }

  exportarPDF(): void {
    window.print();
  }
}