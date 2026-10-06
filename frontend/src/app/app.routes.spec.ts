import { describe, expect, it } from 'vitest';

import { routes } from './app.routes';
import { ActividadForm } from './views/dashboard-components/actividad-form/actividad-form';
import { NotFound } from './views/not-found/not-found';

/**
 * The router picks the first route that matches, so these specs assert the
 * resolution order on the real route table.
 */
describe('app routes', () => {
  const hijosDe = (path: string) => routes.find((r) => r.path === path)?.children ?? [];

  function primeraCoincidencia(hijos: typeof routes, segmentos: string[]) {
    return hijos.find((r) => {
      const partes = (r.path ?? '').split('/');
      return partes.length === segmentos.length && partes.every((p, i) => p.startsWith(':') || p === segmentos[i]);
    });
  }

  it('resolves dashboard/actividades/nueva to the form and not to :id', () => {
    const ruta = primeraCoincidencia(hijosDe('dashboard'), ['actividades', 'nueva']);
    expect(ruta?.component).toBe(ActividadForm);
  });

  it('keeps the wildcard last and pointed at the 404 screen', () => {
    const ultima = routes[routes.length - 1];
    expect(ultima.path).toBe('**');
    expect(ultima.component).toBe(NotFound);
  });
});
