import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContenidoUnidad } from '../../../../model/unidad-contenido.model';
import { ContenidoFormComponent } from './contenido-form';

const existente: ContenidoUnidad = {
  id: 'c1', titulo: 'Clase 1', descripcion: 'Intro', tipo: 'video', url: 'https://youtu.be/x',
  fechaCreacion: new Date('2026-03-01'), visible: false, profesor_id: 'p9',
};

describe('ContenidoFormComponent', () => {
  let fixture: ComponentFixture<ContenidoFormComponent>;
  let component: ContenidoFormComponent;
  let guardados: ContenidoUnidad[];
  let cancelados: number;

  function crear(contenido: ContenidoUnidad | null): void {
    fixture = TestBed.createComponent(ContenidoFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('contenido', contenido);
    guardados = [];
    cancelados = 0;
    component.guardar.subscribe((c) => guardados.push(c));
    component.cancelar.subscribe(() => cancelados++);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    await TestBed.configureTestingModule({ imports: [ContenidoFormComponent] }).compileComponents();
  });

  it('starts empty to add a content', () => {
    crear(null);
    expect(component.formulario.getRawValue()).toEqual({ tipo: 'documento', titulo: '', descripcion: '', url: '', visible: true });
    expect(fixture.nativeElement.textContent).toContain('➕ Nuevo Contenido');
  });

  it('starts with the values of the content being edited', () => {
    crear(existente);
    expect(component.formulario.getRawValue()).toEqual({
      tipo: 'video', titulo: 'Clase 1', descripcion: 'Intro', url: 'https://youtu.be/x', visible: false,
    });
    expect(fixture.nativeElement.textContent).toContain('✏️ Editar Contenido');
  });

  it('validates title, URL presence and URL format with an alert', () => {
    crear(null);
    (component as unknown as { enviar(): void }).enviar();
    component.formulario.patchValue({ titulo: 'T' });
    (component as unknown as { enviar(): void }).enviar();
    component.formulario.patchValue({ url: 'x' });
    (component as unknown as { enviar(): void }).enviar();
    expect(window.alert).toHaveBeenNthCalledWith(1, 'El título es requerido');
    expect(window.alert).toHaveBeenNthCalledWith(2, 'La URL es requerida');
    expect(window.alert).toHaveBeenNthCalledWith(3, 'Por favor ingresa una URL válida (ej: https://...)');
    expect(guardados).toEqual([]);
  });

  it('emits a new content with its own id and always visible', () => {
    crear(null);
    component.formulario.patchValue({ titulo: 'Nuevo', url: 'https://a.test', visible: false });
    (component as unknown as { enviar(): void }).enviar();
    expect(guardados[0]).toMatchObject({ titulo: 'Nuevo', visible: true });
    expect(guardados[0].id).toMatch(/^contenido-/);
  });

  it('emits the edited content keeping id, owner and date', () => {
    crear(existente);
    component.formulario.patchValue({ titulo: 'v2' });
    (component as unknown as { enviar(): void }).enviar();
    expect(guardados[0]).toEqual({ ...existente, titulo: 'v2' });
  });

  it('follows the selected type in the help text and cancels on demand', () => {
    crear(null);
    expect(fixture.nativeElement.textContent).toContain('Para documentos en Google Drive');
    component.formulario.patchValue({ tipo: 'enlace' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Para enlaces generales');

    Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Cancelar'))!.click();
    expect(cancelados).toBe(1);
  });
});
