import { describe, expect, it } from 'vitest';

import { fechaFormato, iconoTipo, pasosAyuda, tipoLabel, tipoLabelCorto, tituloAyuda } from './contenido-tipo';

describe('contenido-tipo helpers', () => {
  it('labels and icons per type, with a fallback for unknown ones', () => {
    expect(tipoLabel('video')).toBe('🎥 Video');
    expect(tipoLabelCorto('enlace')).toBe('Enlace');
    expect(iconoTipo('documento')).toBe('📄');
    expect(tipoLabel('otro')).toBe('otro');
    expect(iconoTipo('otro')).toBe('📎');
  });

  it('help title and three steps per type; nothing for an unknown one', () => {
    expect(tituloAyuda('documento')).toContain('Google Drive');
    expect(pasosAyuda('video').length).toBe(3);
    expect(tituloAyuda('otro')).toBe('');
    expect(pasosAyuda('otro')).toEqual([]);
  });

  it('formats a date as day, short month and year', () => {
    expect(fechaFormato(new Date(2026, 2, 5))).toMatch(/05/);
    expect(fechaFormato('2026-03-05T12:00:00')).toMatch(/2026/);
  });
});
