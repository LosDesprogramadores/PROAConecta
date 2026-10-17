import { FormControl, Validators } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import { mensajeErrorCampo } from './form-errors';

describe('mensajeErrorCampo', () => {
  it('is silent while the control is untouched', () => {
    expect(mensajeErrorCampo(new FormControl('', Validators.required))).toBeNull();
  });

  it('is silent for a valid control and for null', () => {
    const control = new FormControl('x', Validators.required);
    control.markAsTouched();
    expect(mensajeErrorCampo(control)).toBeNull();
    expect(mensajeErrorCampo(null)).toBeNull();
  });

  it('explains required, minlength and email in Spanish', () => {
    const requerido = new FormControl('', Validators.required);
    requerido.markAsTouched();
    expect(mensajeErrorCampo(requerido)).toBe('Este campo es obligatorio.');

    const corto = new FormControl('12', Validators.minLength(7));
    corto.markAsDirty();
    expect(mensajeErrorCampo(corto)).toBe('Debe tener al menos 7 caracteres.');

    const email = new FormControl('x', Validators.email);
    email.markAsTouched();
    expect(mensajeErrorCampo(email)).toBe('Ingrese un email válido.');
  });

  it('prefers a custom message for the error key', () => {
    const control = new FormControl('x', Validators.minLength(7));
    control.markAsTouched();
    expect(mensajeErrorCampo(control, { minlength: 'El DNI debe tener al menos 7 caracteres.' })).toBe(
      'El DNI debe tener al menos 7 caracteres.',
    );
  });
});
