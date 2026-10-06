import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import { EstadoInscripcion, IAlumnoMateria } from '../../../model/materia.model';
import { MateriaService } from '../../../services/materia.service';
import { ToastService } from '../../../services/toast.service';

const ETIQUETA_ESTADO: Record<EstadoInscripcion, string> = {
  CURSANDO: 'Cursando',
  REGULAR: 'Regular',
  PROMOCIONADO: 'Promocionado',
  LIBRE: 'Libre',
  BAJA: 'Baja',
};

const CLASE_ESTADO: Record<EstadoInscripcion, string> = {
  CURSANDO: 'bg-sky-100 text-sky-700',
  REGULAR: 'bg-amber-100 text-amber-700',
  PROMOCIONADO: 'bg-emerald-100 text-emerald-700',
  LIBRE: 'bg-slate-100 text-slate-600',
  BAJA: 'bg-red-100 text-red-700',
};

@Component({
  selector: 'app-alumnos',
  imports: [DatePipe],
  templateUrl: './alumnos.html',
})
export class Alumnos implements OnInit {
  private route = inject(ActivatedRoute);
  private materiaService = inject(MateriaService);
  private toastService = inject(ToastService);

  readonly estados = (Object.keys(ETIQUETA_ESTADO) as EstadoInscripcion[]).map((valor) => ({
    valor,
    etiqueta: ETIQUETA_ESTADO[valor],
  }));

  private materiaId = 0;

  alumnos = signal<IAlumnoMateria[]>([]);
  cargando = signal(true);
  error = signal('');
  estadoFiltro = signal<EstadoInscripcion | ''>('');

  alumnosOrdenados = computed(() =>
    [...this.alumnos()].sort(
      (a, b) => a.apellido.localeCompare(b.apellido, 'es') || a.nombre.localeCompare(b.nombre, 'es'),
    ),
  );

  ngOnInit(): void {
    this.materiaId = Number(this.route.parent?.snapshot.paramMap.get('id'));
    if (!this.materiaId) {
      this.cargando.set(false);
      this.error.set('No se pudo identificar la materia.');
      return;
    }
    this.cargar();
  }

  cambiarEstado(estado: EstadoInscripcion | ''): void {
    this.estadoFiltro.set(estado);
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');

    this.materiaService.obtenerAlumnos(this.materiaId, this.estadoFiltro() || undefined).subscribe({
      next: (alumnos) => {
        this.alumnos.set(alumnos);
        this.cargando.set(false);
      },
      error: (err) => {
        const detalle = this.toastService.readable_message_extraction(err);
        this.alumnos.set([]);
        this.error.set(`No se pudo cargar la lista de alumnos. ${detalle}`);
        this.cargando.set(false);
      },
    });
  }

  etiqueta(estado: EstadoInscripcion): string {
    return ETIQUETA_ESTADO[estado] ?? estado;
  }

  claseEstado(estado: EstadoInscripcion): string {
    return CLASE_ESTADO[estado] ?? 'bg-slate-100 text-slate-600';
  }
}
