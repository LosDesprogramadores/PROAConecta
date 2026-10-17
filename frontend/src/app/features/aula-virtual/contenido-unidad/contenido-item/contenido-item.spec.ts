import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ContenidoUnidad } from '../../../../model/unidad-contenido.model';
import { ContenidoItemComponent } from './contenido-item';

const contenido: ContenidoUnidad = {
  id: 'c1', titulo: 'Clase 1', tipo: 'video', url: 'https://youtu.be/x',
  fechaCreacion: new Date('2026-03-01'), visible: true,
};

describe('ContenidoItemComponent', () => {
  let fixture: ComponentFixture<ContenidoItemComponent>;
  const dom = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ContenidoItemComponent] }).compileComponents();
    fixture = TestBed.createComponent(ContenidoItemComponent);
    fixture.componentRef.setInput('contenido', contenido);
    fixture.componentRef.setInput('esDocente', true);
    fixture.detectChanges();
  });

  it('renders the content and the link', () => {
    expect(dom().textContent).toContain('Clase 1');
    expect(dom().querySelector('a')?.getAttribute('href')).toBe('https://youtu.be/x');
  });

  it('raises the teacher actions without changing the content', () => {
    const editados: ContenidoUnidad[] = [];
    const visibilidad: ContenidoUnidad[] = [];
    const eliminados: string[] = [];
    fixture.componentInstance.editar.subscribe((c) => editados.push(c));
    fixture.componentInstance.cambiarVisibilidad.subscribe((c) => visibilidad.push(c));
    fixture.componentInstance.eliminar.subscribe((id) => eliminados.push(id));

    dom().querySelector<HTMLButtonElement>('button[title="Editar contenido"]')!.click();
    dom().querySelector<HTMLButtonElement>('button[title="Ocultar para alumnos"]')!.click();
    dom().querySelector<HTMLButtonElement>('button[title="Eliminar contenido"]')!.click();

    expect(editados).toEqual([contenido]);
    expect(visibilidad).toEqual([contenido]);
    expect(eliminados).toEqual(['c1']);
    expect(contenido.visible).toBe(true);
  });

  it('shows no actions to a student', () => {
    fixture.componentRef.setInput('esDocente', false);
    fixture.detectChanges();
    expect(dom().querySelectorAll('button').length).toBe(0);
  });
});
