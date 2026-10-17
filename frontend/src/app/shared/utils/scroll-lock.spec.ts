import { beforeEach, describe, expect, it } from 'vitest';

import { bloquearScroll, liberarScroll } from './scroll-lock';

describe('scroll lock', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('locks the page and restores the previous overflow', () => {
    document.body.style.overflow = 'auto';
    bloquearScroll();
    expect(document.body.style.overflow).toBe('hidden');
    liberarScroll();
    expect(document.body.style.overflow).toBe('auto');
  });

  it('releases only when the last lock is released', () => {
    bloquearScroll();
    bloquearScroll();
    liberarScroll();
    expect(document.body.style.overflow).toBe('hidden');
    liberarScroll();
    expect(document.body.style.overflow).toBe('');
  });

  it('ignores a release without a lock', () => {
    liberarScroll();
    expect(document.body.style.overflow).toBe('');
  });
});
