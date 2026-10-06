import { Component, input, output } from '@angular/core';

import { ContenidoUnidad } from '../../../../model/unidad-contenido.model';
import { fechaFormato, iconoTipo, tipoLabel, tipoLabelCorto } from '../contenido-tipo';

/** Presentational: shows one content and raises the teacher's actions. It owns no state. */
@Component({
  selector: 'app-contenido-item',
  standalone: true,
  templateUrl: './contenido-item.html',
})
export class ContenidoItemComponent {
  readonly contenido = input.required<ContenidoUnidad>();
  readonly esDocente = input(false);

  readonly editar = output<ContenidoUnidad>();
  readonly cambiarVisibilidad = output<ContenidoUnidad>();
  readonly eliminar = output<string>();

  protected readonly tipoLabel = tipoLabel;
  protected readonly tipoLabelCorto = tipoLabelCorto;
  protected readonly iconoTipo = iconoTipo;
  protected readonly fechaFormato = fechaFormato;
}
