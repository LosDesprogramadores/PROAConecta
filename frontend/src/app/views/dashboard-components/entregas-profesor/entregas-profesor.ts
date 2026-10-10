import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, catchError, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { RespuestaPaginada } from '../../../core/models/api-response.interface';
import { IMateria } from '../../../model/materia.model';
import { ActividadesService, Entrega, FiltroEntregas } from '../../../services/actividades.service';
import { MateriaService } from '../../../services/materia.service';
import { ToastService } from '../../../services/toast.service';

export type PestanaEntregas = 'sin-calificar' | 'calificadas' | 'todas';

const TAMANO_PAGINA = 20;

interface ResultadoPagina {
  filtro: FiltroEntregas;
  respuesta?: RespuestaPaginada<Entrega>;
  err?: unknown;
}

const PESTANAS: readonly { clave: PestanaEntregas; etiqueta: string }[] = [
  { clave: 'sin-calificar', etiqueta: 'Sin calificar' },
  { clave: 'calificadas', etiqueta: 'Calificadas' },
  { clave: 'todas', etiqueta: 'Todas' },
];

/** Deliveries across all the professor's materias, with the "Sin calificar" tab by default. */
@Component({
  selector: 'app-entregas-profesor',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './entregas-profesor.html',
})
export class EntregasProfesor implements OnInit {
  private readonly actividadesService = inject(ActividadesService);
  private readonly materiaService = inject(MateriaService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);

  protected readonly pestanas = PESTANAS;

  pestana = signal<PestanaEntregas>('sin-calificar');
  materiaId = signal<number | null>(null);
  pagina = signal(1);
  total = signal(0);
  entregas = signal<Entrega[]>([]);
  materias = signal<IMateria[]>([]);
  cargando = signal(false);
  error = signal('');

  /** Every request goes through here: switchMap drops the response of a superseded one. */
  private readonly solicitudes = new Subject<void>();

  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / TAMANO_PAGINA)));

  constructor() {
    this.solicitudes
      .pipe(
        switchMap(() => this.pedirPagina()),
        takeUntilDestroyed(),
      )
      .subscribe((resultado) => this.aplicar(resultado));
  }

  ngOnInit(): void {
    const personaId = this.authService.currentUser()?.persona?.id;
    if (personaId) {
      this.materiaService
        .obtenerMateriasPorProfesor(personaId)
        .pipe(catchError(() => of([] as IMateria[])))
        .subscribe((materias) => this.materias.set(materias));
    }
    this.cargar();
  }

  setPestana(pestana: PestanaEntregas): void {
    this.pestana.set(pestana);
    this.pagina.set(1);
    this.cargar();
  }

  setMateria(materiaId: number | null): void {
    this.materiaId.set(materiaId);
    this.pagina.set(1);
    this.cargar();
  }

  irAPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas()) return;
    this.pagina.set(pagina);
    this.cargar();
  }

  cargar(): void {
    this.solicitudes.next();
  }

  private pedirPagina() {
    const filtro: FiltroEntregas = { page: this.pagina(), page_size: TAMANO_PAGINA };
    const pestana = this.pestana();
    if (pestana !== 'todas') filtro.calificada = pestana === 'calificadas';
    const materia = this.materiaId();
    if (materia !== null) filtro.materia = materia;

    this.cargando.set(true);
    this.error.set('');
    return this.actividadesService.getEntregasPagina(filtro).pipe(
      map((respuesta): ResultadoPagina => ({ respuesta, filtro })),
      catchError((err: unknown) => of<ResultadoPagina>({ err, filtro })),
    );
  }

  private aplicar(resultado: ResultadoPagina): void {
    if (resultado.respuesta) {
      this.entregas.set(resultado.respuesta.results);
      this.total.set(resultado.respuesta.count);
      this.cargando.set(false);
      return;
    }
    const err = resultado.err;
    // A page that no longer exists (e.g. the last one emptied): go back to the first one.
    if (err instanceof HttpErrorResponse && err.status === 404 && (resultado.filtro.page ?? 1) > 1) {
      this.pagina.set(1);
      this.cargar();
      return;
    }
    this.error.set(this.toastService.readable_message_extraction(err));
    this.cargando.set(false);
  }

  estadoDe(entrega: Entrega): string {
    if (entrega.nota) return 'Corregido';
    return entrega.fuera_de_termino ? 'Fuera de término' : 'Sin calificar';
  }

  mensajeVacio(): string {
    switch (this.pestana()) {
      case 'sin-calificar':
        return 'No hay entregas sin calificar.';
      case 'calificadas':
        return 'Todavía no hay entregas calificadas.';
      default:
        return 'Todavía no hay entregas.';
    }
  }

  onMateriaChange(valor: string): void {
    this.setMateria(valor ? Number(valor) : null);
  }
}
