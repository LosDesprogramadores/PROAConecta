/** Indica si la URL pertenece a las vistas de una materia (MateriasLayout), donde el sidebar ya trae el botón "Volver". */
export function estaEnVistaMateria(url: string): boolean {
  return url.startsWith('/view-materia');
}
