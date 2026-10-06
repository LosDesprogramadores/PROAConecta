import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { INotificacion } from '../../model/notificacion.model';
import { NotificacionService } from '../../services/notificaciones.service';
import { NotificacionesEstadoService, idDe } from '../../services/notificaciones-estado.service';
import { Paginador } from '../../shared/paginador/paginador';

const TAMANO_PAGINA = 10;

@Component({
  selector: 'app-notificaciones',
  standalone: true,
  imports: [CommonModule, Paginador],
  templateUrl: './notificaciones.html',
})
export class NotificacionesComponent implements OnInit {
  private readonly api = inject(NotificacionService);
  private readonly estado = inject(NotificacionesEstadoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tamanoPagina = TAMANO_PAGINA;
  readonly notificaciones = signal<INotificacion[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(1);
  readonly cargando = signal(true);
  readonly error = signal(false);
  readonly noLeidas = this.estado.noLeidas;

  ngOnInit(): void {
    this.cargar(1);
    // Live: on the first page a new notification goes to the top without reloading.
    this.estado
      .nuevas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((noti) => {
        if (this.pagina() !== 1) {
          this.total.update((n) => n + 1);
          return;
        }
        const id = idDe(noti);
        if (id && this.notificaciones().some((n) => idDe(n) === id)) {
          return;
        }
        this.total.update((n) => n + 1);
        this.notificaciones.update((lista) => [noti, ...lista].slice(0, TAMANO_PAGINA));
      });
  }

  cargar(pagina: number): void {
    this.cargando.set(true);
    this.error.set(false);
    this.api.listarPaginado({ page: pagina, page_size: TAMANO_PAGINA }).subscribe({
      next: (respuesta) => {
        this.notificaciones.set(respuesta.results);
        this.total.set(respuesta.count);
        this.pagina.set(pagina);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
      },
    });
  }

  marcarComoLeida(noti: INotificacion): void {
    const id = idDe(noti);
    this.marcarLocal(id, true);
    this.estado.marcarLeida(noti).subscribe({ error: () => this.marcarLocal(id, false) });
  }

  idDe(noti: INotificacion): string | undefined {
    return idDe(noti);
  }

  private marcarLocal(id: string | undefined, leida: boolean): void {
    this.notificaciones.update((lista) => lista.map((n) => (idDe(n) === id ? { ...n, leida } : n)));
  }
}
