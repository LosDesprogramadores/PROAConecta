import { Component, computed, input, output } from '@angular/core';

/** Accessible previous/next pager for server-side pagination (1-based pages). */
@Component({
  selector: 'app-paginador',
  standalone: true,
  templateUrl: './paginador.html',
})
export class Paginador {
  total = input.required<number>();
  pagina = input(1);
  tamano = input(50);

  paginaCambiada = output<number>();

  totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / Math.max(1, this.tamano()))));
  hayAnterior = computed(() => this.pagina() > 1);
  haySiguiente = computed(() => this.pagina() < this.totalPaginas());

  anterior(): void {
    if (this.hayAnterior()) {
      this.paginaCambiada.emit(this.pagina() - 1);
    }
  }

  siguiente(): void {
    if (this.haySiguiente()) {
      this.paginaCambiada.emit(this.pagina() + 1);
    }
  }
}
