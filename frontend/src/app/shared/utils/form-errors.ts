import { AbstractControl } from '@angular/forms';

/**
 * Returns the Spanish message for the first error of a control, or `null` while the
 * control is valid or still untouched (so the text does not appear before the user acts).
 * `personalizados` overrides the default text per Angular error key.
 */
export function mensajeErrorCampo(
  control: AbstractControl | null,
  personalizados: Record<string, string> = {},
): string | null {
  if (!control || control.valid || !(control.touched || control.dirty)) {
    return null;
  }

  const errores = control.errors ?? {};
  const clave = Object.keys(errores)[0];
  if (clave && personalizados[clave]) {
    return personalizados[clave];
  }

  switch (clave) {
    case 'required':
      return 'Este campo es obligatorio.';
    case 'minlength':
      return `Debe tener al menos ${errores['minlength'].requiredLength} caracteres.`;
    case 'maxlength':
      return `No puede superar los ${errores['maxlength'].requiredLength} caracteres.`;
    case 'email':
      return 'Ingrese un email válido.';
    case 'min':
      return `El valor mínimo es ${errores['min'].min}.`;
    case 'max':
      return `El valor máximo es ${errores['max'].max}.`;
    case 'pattern':
      return 'El formato no es válido.';
    default:
      return 'El valor ingresado no es válido.';
  }
}
