import { Component, input, Input, signal } from '@angular/core';
import { IColumnaTabla } from '../../../model/tabla.model';

@Component({
  selector: 'app-tabla-generica',
  imports: [],
  templateUrl: './tabla-generica.html',
  styleUrl: './tabla-generica.css',
})
export class TablaGenerica {
  @Input({ required: true }) columnas: IColumnaTabla[] = [];
  @Input({ required: true }) datos: any[] = [];
  @Input() titulo: string = '';
  @Input() mensajeVacio: string = 'No hay registros para mostrar.';
 isLoading = input<boolean>(false);

  obtenerValor(fila: any, campo: string): any {
    if (!campo) return '';
    return campo.split('.').reduce((acc, clave) => acc && acc[clave], fila) ?? '-';
  }
}
