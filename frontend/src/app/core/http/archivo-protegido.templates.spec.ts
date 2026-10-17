import { describe, expect, it } from 'vitest';

// The project has no @types/node: the two built-ins this scan needs are typed here (Node 22 getBuiltinModule)
interface Fs {
  readdirSync(ruta: string): string[];
  readFileSync(ruta: string, codificacion: 'utf8'): string;
  statSync(ruta: string): { isDirectory(): boolean };
}
const nodo = (globalThis as unknown as {
  process: { cwd(): string; getBuiltinModule(nombre: string): unknown };
}).process;
const { readdirSync, readFileSync, statSync } = nodo.getBuiltinModule('node:fs') as Fs;
const join = (...partes: string[]) => partes.join('/');

const RAIZ = join(nodo.cwd(), 'src', 'app');
// Anchors whose href is a file URL that comes from the API (`archivo`, `archivo_adjunto`) or from the
// helpers that return it (`obtenerUrl`, `urlDe`, or the `url` alias bound from `urlDe`): a plain href would not send the JWT
const ENLACE_DE_ARCHIVO = /<a\b[^>]*\[href\]="(?:[^"]*(?:archivo|obtenerUrl|urlDe)[^"]*|url)"[^>]*>/gs;

function plantillas(carpeta: string): string[] {
  return readdirSync(carpeta).flatMap((nombre: string) => {
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) {
      return plantillas(ruta);
    }
    return ruta.endsWith('.html') ? [ruta] : [];
  });
}

describe('templates that link to uploaded files', () => {
  const enlaces = plantillas(RAIZ).flatMap((ruta) =>
    (readFileSync(ruta, 'utf8').match(ENLACE_DE_ARCHIVO) ?? []).map((enlace: string) => ({ ruta, enlace })),
  );

  it('finds the known file links (guards the scan itself)', () => {
    const archivos = new Set(enlaces.map((e) => e.ruta.split('/').pop()));
    for (const esperado of [
      'actividad-entregas.html',
      'actividad-estudiante.html',
      'material.html',
      'material-estudiante.html',
      'recursos-clase.html',
      'unidades-material.html',
    ]) {
      expect(archivos.has(esperado), esperado).toBe(true);
    }
  });

  it('uses appArchivoProtegido on every one of them', () => {
    const sinDirectiva = enlaces.filter((e) => !e.enlace.includes('appArchivoProtegido'));
    expect(sinDirectiva.map((e) => e.ruta)).toEqual([]);
  });
});
