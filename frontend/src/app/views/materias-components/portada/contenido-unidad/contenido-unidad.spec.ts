import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContenidoUnidad } from '../../../../model/unidad-contenido.model';
import { ContenidoUnidadComponent } from './contenido-unidad';

const existente: ContenidoUnidad = {
  id: 'c1',
  titulo: 'Clase 1',
  descripcion: 'Intro',
  tipo: 'video',
  url: 'https://youtu.be/x',
  fechaCreacion: new Date('2026-03-01'),
  visible: false,
  profesor_id: 'p9',
};

describe('ContenidoUnidadComponent', () => {
  let component: ContenidoUnidadComponent;
  let fixture: ComponentFixture<ContenidoUnidadComponent>;
  let emitidos: ContenidoUnidad[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContenidoUnidadComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ContenidoUnidadComponent);
    component = fixture.componentInstance;
    component.unidad = { id: 'u1', nombre: 'Unidad 1', contenidos: [] } as never;
    emitidos = [];
    component.contenidoGuardado.subscribe((c) => emitidos.push(c));
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens an empty reactive form for a new content', () => {
    component.mostrarFormularioNuevo();
    expect(component.formulario.getRawValue()).toEqual({
      tipo: 'documento', titulo: '', descripcion: '', url: '', visible: true,
    });
    expect(component.mostrarFormulario()).toBe(true);
  });

  it('rejects a content without title, without URL or with an invalid URL', () => {
    component.mostrarFormularioNuevo();
    component.guardarContenido();
    component.formulario.patchValue({ titulo: 'T' });
    component.guardarContenido();
    component.formulario.patchValue({ url: 'no-es-url' });
    component.guardarContenido();

    expect(emitidos).toEqual([]);
    expect(window.alert).toHaveBeenCalledTimes(3);
  });

  it('emits a new content with its own id, creation date and visible', () => {
    component.mostrarFormularioNuevo();
    component.formulario.patchValue({ titulo: 'Nuevo', url: 'https://a.test', visible: false });
    component.guardarContenido();

    expect(emitidos.length).toBe(1);
    expect(emitidos[0]).toMatchObject({ titulo: 'Nuevo', url: 'https://a.test', tipo: 'documento', visible: true });
    expect(emitidos[0].id).toMatch(/^contenido-/);
    expect(component.mostrarFormulario()).toBe(false);
  });

  it('keeps the id, owner and date of an edited content', () => {
    component.editarContenido(existente);
    expect(component.formulario.getRawValue().titulo).toBe('Clase 1');
    component.formulario.patchValue({ titulo: 'Clase 1 (v2)' });
    component.guardarContenido();

    expect(emitidos[0]).toEqual({ ...existente, titulo: 'Clase 1 (v2)' });
  });

  it('shows the help of the selected type', () => {
    component.mostrarFormularioNuevo();
    component.formulario.patchValue({ tipo: 'video' });
    expect(component.getTipoAyuda()).toContain('YouTube');
    expect(component.getAyudaLinks().length).toBe(3);
  });

  it('toggles visibility and tells the portada', () => {
    const c = { ...existente, visible: true };
    component.cambiarVisibilidad(c);
    expect(emitidos[0].visible).toBe(false);
  });
});
