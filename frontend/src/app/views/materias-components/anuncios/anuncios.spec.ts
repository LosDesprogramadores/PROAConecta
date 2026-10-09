import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { UserRole } from '../../../core/auth/auth.model';
import { AnuncioMateria } from '../../../model/anuncio-materia.model';
import { EventoSocket, NotificacionSocketService } from '../../../services/notificacion-socket.service';
import { ToastService } from '../../../services/toast.service';
import { AnunciosMateriaComponent } from './anuncios';

const urlAnuncios = `${environment.apiUrl}materias/7/anuncios/`;
const urlMateria = `${environment.apiUrl}materias/7/`;

const anuncio = (id: string, materia_id = 7): AnuncioMateria => ({
  id,
  titulo: `Anuncio ${id}`,
  mensaje: 'cuerpo',
  autor: 'Pérez, Ana',
  materia_id,
  materia_nombre: 'Matemática I',
  fecha_creacion: '2026-10-08T13:00:00Z',
  leida: false,
});

describe('AnunciosMateriaComponent', () => {
  let fixture: ComponentFixture<AnunciosMateriaComponent>;
  let http: HttpTestingController;
  let eventos$: Subject<EventoSocket>;
  const toast = { success: vi.fn(), error: vi.fn(), readable_message_extraction: vi.fn(() => 'Mensaje') };

  const texto = () => fixture.nativeElement.textContent as string;
  const lista = (results: AnuncioMateria[], count = results.length) =>
    http.expectOne((r) => r.url === urlAnuncios).flush({ count, next: null, previous: null, results, no_leidas: 0 });

  async function crear(rolId: UserRole, personaId = 12, profesorDeLaMateria: number | null = 12): Promise<void> {
    eventos$ = new Subject<EventoSocket>();
    toast.success.mockReset();
    toast.error.mockReset();
    await TestBed.configureTestingModule({
      imports: [AnunciosMateriaComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '7' }) } } },
        { provide: AuthService, useValue: { currentUser: signal({ rolId, persona: { id: personaId } }) } },
        { provide: NotificacionSocketService, useValue: { eventos: () => eventos$.asObservable() } },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AnunciosMateriaComponent);
    fixture.detectChanges();
    if (rolId === UserRole.DOCENTE) {
      http.expectOne(urlMateria).flush({ id: 7, profesor: profesorDeLaMateria });
    }
  }

  it('shows loading, then the real list without the form for a student', async () => {
    await crear(UserRole.ESTUDIANTE);
    expect(texto()).toContain('Cargando anuncios');
    lista([anuncio('a'), anuncio('b')]);
    fixture.detectChanges();
    expect(texto()).toContain('Anuncio a');
    expect(texto()).toContain('Anuncio b');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('shows the form only to the titular professor', async () => {
    await crear(UserRole.DOCENTE, 12, 12);
    lista([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
    expect(texto()).toContain('Todavía no hay anuncios');
  });

  it('hides the form from a professor who is not the titular', async () => {
    await crear(UserRole.DOCENTE, 12, 99);
    lista([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('shows the error state', async () => {
    await crear(UserRole.ESTUDIANTE);
    http.expectOne((r) => r.url === urlAnuncios).flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(texto()).toContain('No se pudieron cargar los anuncios.');
  });

  it('validates the reactive form: required and max lengths', async () => {
    await crear(UserRole.DOCENTE);
    lista([]);
    const c = fixture.componentInstance;
    expect(c.formulario.valid).toBe(false);

    c.formulario.setValue({ titulo: 'x'.repeat(121), mensaje: 'ok' });
    expect(c.formulario.controls.titulo.errors?.['maxlength']).toBeTruthy();

    c.formulario.setValue({ titulo: 'ok', mensaje: 'y'.repeat(2001) });
    expect(c.formulario.controls.mensaje.errors?.['maxlength']).toBeTruthy();

    c.formulario.setValue({ titulo: 'ok', mensaje: 'ok' });
    expect(c.formulario.valid).toBe(true);
  });

  it('does not send an invalid form', async () => {
    await crear(UserRole.DOCENTE);
    lista([]);
    fixture.componentInstance.publicar();
    http.expectNone(urlAnuncios);
  });

  it('publishes, adds the announcement once (REST + own live event) and resets the form', async () => {
    await crear(UserRole.DOCENTE);
    lista([anuncio('a')]);
    const c = fixture.componentInstance;
    c.formulario.setValue({ titulo: 'Nuevo', mensaje: 'Texto' });

    c.publicar();
    const req = http.expectOne(urlAnuncios);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ titulo: 'Nuevo', mensaje: 'Texto' });
    req.flush(anuncio('n'));
    eventos$.next({ tipo: 'anuncio.creado', fecha: '', datos: anuncio('n') });

    expect(c.anuncios().map((a) => a.id)).toEqual(['n', 'a']);
    expect(c.formulario.getRawValue()).toEqual({ titulo: '', mensaje: '' });
    expect(toast.success).toHaveBeenCalled();
  });

  it('reports a server error through the toast and keeps the text', async () => {
    await crear(UserRole.DOCENTE);
    lista([]);
    const c = fixture.componentInstance;
    c.formulario.setValue({ titulo: 'Nuevo', mensaje: 'Texto' });
    c.publicar();
    http.expectOne(urlAnuncios).flush({ detail: 'No' }, { status: 403, statusText: 'Forbidden' });

    expect(toast.error).toHaveBeenCalled();
    expect(c.enviando()).toBe(false);
    expect(c.formulario.controls.titulo.value).toBe('Nuevo');
  });

  it('adds a live announcement of this subject and ignores other subjects', async () => {
    await crear(UserRole.ESTUDIANTE);
    lista([anuncio('a')]);

    eventos$.next({ tipo: 'anuncio.creado', fecha: '', datos: anuncio('b', 8) });
    eventos$.next({ tipo: 'mensaje.nuevo', fecha: '', datos: anuncio('c') });
    expect(fixture.componentInstance.anuncios().length).toBe(1);

    eventos$.next({ tipo: 'anuncio.creado', fecha: '', datos: anuncio('d') });
    expect(fixture.componentInstance.anuncios().map((a) => a.id)).toEqual(['d', 'a']);
  });
});
