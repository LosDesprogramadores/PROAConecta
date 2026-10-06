import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';

import { ContenidoUnidad } from '../../../../model/unidad-contenido.model';
import { TipoContenido, pasosAyuda, tituloAyuda } from '../contenido-tipo';

/**
 * Presentational: the add/edit form of a content. `contenido` is the one being edited (null to add).
 * It validates, builds the result and emits it; the container decides what to do with it.
 */
@Component({
  selector: 'app-contenido-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './contenido-form.html',
})
export class ContenidoFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly contenido = input<ContenidoUnidad | null>(null);

  readonly guardar = output<ContenidoUnidad>();
  readonly cancelar = output<void>();

  readonly formulario = this.fb.group({
    tipo: this.fb.control<TipoContenido>('documento'),
    titulo: '',
    descripcion: '',
    url: '',
    visible: true,
  });

  private readonly tipo = toSignal(this.formulario.controls.tipo.valueChanges, {
    initialValue: this.formulario.controls.tipo.value,
  });
  protected readonly tituloAyuda = computed(() => tituloAyuda(this.tipo()));
  protected readonly pasosAyuda = computed(() => pasosAyuda(this.tipo()));

  ngOnInit(): void {
    const existente = this.contenido();
    if (existente) {
      this.formulario.setValue({
        tipo: existente.tipo,
        titulo: existente.titulo,
        descripcion: existente.descripcion ?? '',
        url: existente.url,
        visible: existente.visible ?? true,
      });
    }
  }

  protected enviar(): void {
    const valores = this.formulario.getRawValue();

    if (!valores.titulo.trim()) {
      alert('El título es requerido');
      return;
    }
    if (!valores.url.trim()) {
      alert('La URL es requerida');
      return;
    }
    try {
      new URL(valores.url);
    } catch {
      alert('Por favor ingresa una URL válida (ej: https://...)');
      return;
    }

    const existente = this.contenido();
    this.guardar.emit(
      existente
        ? { ...existente, ...valores }
        : {
            ...valores,
            // New content: its own id and date, always visible
            id: `contenido-${Date.now()}`,
            fechaCreacion: new Date(),
            visible: true,
          },
    );
  }
}
