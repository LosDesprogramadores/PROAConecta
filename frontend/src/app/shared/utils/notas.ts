/** Grade range accepted by the backend (`NOTA_MINIMA` / `NOTA_MAXIMA`): 1.00 to 10.00. */
export const NOTA_MINIMA = 1;
export const NOTA_MAXIMA = 10;
export const NOTA_PASO = 0.01;

/** Returns the Spanish error for an invalid grade, or `null` when it is valid. */
export function validarNota(nota: number | null | undefined): string | null {
  if (nota === null || nota === undefined || Number.isNaN(nota)) {
    return `Ingrese una nota entre ${NOTA_MINIMA} y ${NOTA_MAXIMA}.`;
  }
  if (nota < NOTA_MINIMA || nota > NOTA_MAXIMA) {
    return `La nota debe estar entre ${NOTA_MINIMA} y ${NOTA_MAXIMA}.`;
  }
  if (Math.abs(nota * 100 - Math.round(nota * 100)) > 1e-6) {
    return 'La nota admite hasta dos decimales.';
  }
  return null;
}
