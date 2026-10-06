import { describe, expect, it } from 'vitest';

import { NOTA_MAXIMA, NOTA_MINIMA, validarNota } from './notas';

describe('validarNota', () => {
  it('matches the backend range 1.00 to 10.00', () => {
    expect(NOTA_MINIMA).toBe(1);
    expect(NOTA_MAXIMA).toBe(10);
  });

  it('accepts the limits and values with up to two decimals', () => {
    for (const nota of [1, 10, 7.5, 6.25, 9.99]) {
      expect(validarNota(nota), String(nota)).toBeNull();
    }
  });

  it('rejects values below 1 (including 0) and above 10', () => {
    expect(validarNota(0)).toBe('La nota debe estar entre 1 y 10.');
    expect(validarNota(0.99)).toBe('La nota debe estar entre 1 y 10.');
    expect(validarNota(10.01)).toBe('La nota debe estar entre 1 y 10.');
  });

  it('rejects empty and non numeric input', () => {
    expect(validarNota(null)).toBe('Ingrese una nota entre 1 y 10.');
    expect(validarNota(undefined)).toBe('Ingrese una nota entre 1 y 10.');
    expect(validarNota(Number.NaN)).toBe('Ingrese una nota entre 1 y 10.');
  });

  it('rejects more than two decimals', () => {
    expect(validarNota(7.123)).toBe('La nota admite hasta dos decimales.');
  });
});
