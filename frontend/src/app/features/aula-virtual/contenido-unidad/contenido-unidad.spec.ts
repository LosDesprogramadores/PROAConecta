import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContenidoUnidad, UnidadMateria } from '../../../model/unidad-contenido.model';
import { ConfirmDialogService } from '../../../services/confirm-dialog.service';
import { ToastService } from '../../../services/toast.service';
import { ContenidoUnidadComponent } from './contenido-unidad';

const visible: ContenidoUnidad = {
  id: 'c1', titulo: 'Clase 1', descripcion: 'Intro', tipo: 'video',
  url: 'https://youtu.be/x', fechaCreacion: new Date('2026-03-01'), visible: true, profesor_id: 'p9',
};
const oculto: ContenidoUnidad = {
  id: 'c2', titulo: 'Borrador', tipo: 'documento', url: 'https://drive.test/d',
  fechaCreacion: new Date('2026-03-02'), visible: false,
};

/**
 * Characterization of the observable behavior of the unit content block. It drives the rendered
 * DOM only, so it stays valid while the component is split into container and presentational parts.
 */
describe('ContenidoUnidadComponent (characterization)', () => {
  let fixture: ComponentFixture<ContenidoUnidadComponent>;
  let guardados: ContenidoUnidad[];
  let eliminados: string[];
  let confirmacion: boolean;
  const dom = () => fixture.nativeElement as HTMLElement;
  const texto = () => dom().textContent ?? '';

  function botonPorTexto(fragmento: string): HTMLButtonElement | undefined {
    return Array.from(dom().querySelectorAll('button')).find((b) => b.textContent?.includes(fragmento));
  }

  function escribir(selector: string, valor: string): void {
    const el = dom().querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector)!;
    el.value = valor;
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input'));
    fixture.detectChanges();
  }

  function enviarFormulario(): void {
    dom().querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  async function crear(contenidos: ContenidoUnidad[], esDocente = true): Promise<void> {
    confirmacion = true;
    await TestBed.configureTestingModule({
      imports: [ContenidoUnidadComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfirmDialogService, useValue: { confirmar: () => of(confirmacion) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContenidoUnidadComponent);
    const unidad: UnidadMateria = { id: 'u1', numero: 1, nombre: 'Unidad 1', descripcion: 'Descripción', contenidos };
    fixture.componentRef.setInput('unidad', unidad);
    fixture.componentRef.setInput('esDocente', signal(esDocente));
    guardados = [];
    eliminados = [];
    fixture.componentInstance.contenidoGuardado.subscribe((c) => guardados.push(c));
    fixture.componentInstance.contenidoEliminado.subscribe((id) => eliminados.push(id));
    vi.spyOn(TestBed.inject(ToastService), 'warning').mockImplementation(() => undefined);
    fixture.detectChanges();
  }

  it('shows the unit header and the empty state', async () => {
    await crear([]);
    expect(texto()).toContain('Unidad 1');
    expect(texto()).toContain('Descripción');
    expect(texto()).toContain('No hay contenido cargado aún.');
  });

  it('lists the contents with type, visibility and link', async () => {
    await crear([visible, oculto]);
    expect(texto()).toContain('Clase 1');
    expect(texto()).toContain('Visible para alumnos');
    expect(texto()).toContain('Oculto para alumnos');
    const enlace = dom().querySelector<HTMLAnchorElement>('a[target="_blank"]')!;
    expect(enlace.getAttribute('href')).toBe('https://youtu.be/x');
    expect(enlace.getAttribute('rel')).toBe('noopener noreferrer');
    expect(enlace.textContent).toContain('Abrir Video');
  });

  it('hides the edit actions and the hidden contents link from a student', async () => {
    await crear([visible, oculto], false);
    expect(botonPorTexto('Agregar Contenido')).toBeUndefined();
    expect(botonPorTexto('Editar')).toBeUndefined();
    expect(botonPorTexto('Eliminar')).toBeUndefined();
    expect(dom().querySelectorAll('a[target="_blank"]').length).toBe(1);
  });

  it('shows the teacher the add button, the actions and the link of hidden contents', async () => {
    await crear([visible, oculto]);
    expect(botonPorTexto('Agregar Contenido')).toBeDefined();
    expect(dom().querySelectorAll('a[target="_blank"]').length).toBe(2);
    expect(dom().querySelectorAll('button[title="Editar contenido"]').length).toBe(2);
  });

  it('opens an empty form with the documento type to add a content', async () => {
    await crear([]);
    botonPorTexto('Agregar Contenido')!.click();
    fixture.detectChanges();
    expect(texto()).toContain('➕ Nuevo Contenido');
    expect(dom().querySelector<HTMLSelectElement>('#contenido-tipo')!.value).toBe('documento');
    expect(dom().querySelector<HTMLInputElement>('#contenido-titulo')!.value).toBe('');
    expect(dom().querySelector('label[for="contenido-titulo"]')).not.toBeNull();
  });

  it('emits a new content with its own id and date and always visible', async () => {
    await crear([]);
    botonPorTexto('Agregar Contenido')!.click();
    fixture.detectChanges();
    escribir('#contenido-tipo', 'enlace');
    escribir('#contenido-titulo', 'Sitio');
    escribir('#contenido-url', 'https://a.test');
    enviarFormulario();

    expect(guardados.length).toBe(1);
    expect(guardados[0]).toMatchObject({ titulo: 'Sitio', tipo: 'enlace', url: 'https://a.test', visible: true });
    expect(guardados[0].id).toMatch(/^contenido-/);
    expect(guardados[0].fechaCreacion).toBeInstanceOf(Date);
    expect(dom().querySelector('form')).toBeNull();
  });

  it('rejects a content without title, without URL or with an invalid URL', async () => {
    await crear([]);
    botonPorTexto('Agregar Contenido')!.click();
    fixture.detectChanges();
    enviarFormulario();
    escribir('#contenido-titulo', 'T');
    enviarFormulario();
    escribir('#contenido-url', 'no-es-url');
    enviarFormulario();

    expect(guardados).toEqual([]);
    expect(TestBed.inject(ToastService).warning).toHaveBeenCalledTimes(3);
    expect(dom().querySelector('form')).not.toBeNull();
  });

  it('edits a content keeping its id, owner and creation date', async () => {
    await crear([visible]);
    dom().querySelector<HTMLButtonElement>('button[title="Editar contenido"]')!.click();
    fixture.detectChanges();
    expect(texto()).toContain('✏️ Editar Contenido');
    expect(dom().querySelector<HTMLInputElement>('#contenido-titulo')!.value).toBe('Clase 1');

    escribir('#contenido-titulo', 'Clase 1 (v2)');
    enviarFormulario();
    expect(guardados[0]).toEqual({ ...visible, titulo: 'Clase 1 (v2)' });
  });

  it('cancels the form without emitting', async () => {
    await crear([]);
    botonPorTexto('Agregar Contenido')!.click();
    fixture.detectChanges();
    botonPorTexto('Cancelar')!.click();
    fixture.detectChanges();
    expect(dom().querySelector('form')).toBeNull();
    expect(guardados).toEqual([]);
  });

  it('shows the help of the selected type', async () => {
    await crear([]);
    botonPorTexto('Agregar Contenido')!.click();
    fixture.detectChanges();
    expect(texto()).toContain('Para documentos en Google Drive');
    escribir('#contenido-tipo', 'video');
    expect(texto()).toContain('Para videos en YouTube/Vimeo');
    expect(texto()).toContain('Copia la URL de YouTube o Vimeo');
  });

  it('toggles the visibility and tells the parent', async () => {
    await crear([visible]);
    dom().querySelector<HTMLButtonElement>('button[title="Ocultar para alumnos"]')!.click();
    expect(guardados[0]).toMatchObject({ id: 'c1', visible: false });
  });

  it('asks for confirmation before deleting and emits the id', async () => {
    await crear([visible]);
    dom().querySelector<HTMLButtonElement>('button[title="Eliminar contenido"]')!.click();
    expect(eliminados).toEqual(['c1']);
  });

  it('does not delete when the confirmation is cancelled', async () => {
    await crear([visible]);
    confirmacion = false;
    dom().querySelector<HTMLButtonElement>('button[title="Eliminar contenido"]')!.click();
    expect(eliminados).toEqual([]);
  });
});
