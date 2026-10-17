// Dialogs can overlap (a confirmation over a form); the page scrolls again only
// when the last one releases its lock.
let bloqueos = 0;
let overflowPrevio = '';

export function bloquearScroll(): void {
  if (bloqueos++ === 0) {
    overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
}

export function liberarScroll(): void {
  if (bloqueos === 0) {
    return;
  }
  if (--bloqueos === 0) {
    document.body.style.overflow = overflowPrevio;
  }
}
