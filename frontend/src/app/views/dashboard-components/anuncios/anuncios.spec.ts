import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../../../environments/environment';
import { INotificacion } from '../../../model/notificacion.model';
import { NotificacionesEstadoService } from '../../../services/notificaciones-estado.service';
import { Anuncios } from './anuncios';

const base = `${environment.apiUrl}notificaciones/`;
const noti = (id: string, leida = false): INotificacion => ({
  id,
  titulo: `Aviso ${id}`,
  mensaje: 'texto',
  alcance: 'AMBOS',
  leida,
  fecha_creacion: '2026-10-08T13:00:00Z',
});

describe('Anuncios (single notices page)', () => {
  let fixture: ComponentFixture<Anuncios>;
  let http: HttpTestingController;
  let nuevas$: Subject<INotificacion>;
  const estado = {
    noLeidas: signal(2),
    nuevas: () => nuevas$.asObservable(),
    marcarLeida: (n: INotificacion) => marcar(n),
  };
  let marcar: (n: INotificacion) => Subject<void>;

  const texto = () => fixture.nativeElement.textContent as string;
  const lista = (results: INotificacion[], count = results.length) =>
    http.expectOne((r) => r.url === base).flush({ count, next: null, previous: null, results, no_leidas: 2 });

  beforeEach(async () => {
    nuevas$ = new Subject<INotificacion>();
    marcar = () => {
      const s = new Subject<void>();
      queueMicrotask(() => s.next());
      return s;
    };
    await TestBed.configureTestingModule({
      imports: [Anuncios],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotificacionesEstadoService, useValue: estado },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Anuncios);
    fixture.detectChanges();
  });

  it('shows the loading state, then the real list', async () => {
    expect(texto()).toContain('Cargando notificaciones');
    lista([noti('1'), noti('2', true)]);
    fixture.detectChanges();
    expect(texto()).toContain('Aviso 1');
    expect(texto()).toContain('Aviso 2');
  });

  it('asks the server for page 1 with a page size', () => {
    const req = http.expectOne((r) => r.url === base);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('page_size')).toBe('10');
    req.flush({ count: 0, next: null, previous: null, results: [], no_leidas: 0 });
  });

  it('shows the empty state', () => {
    lista([]);
    fixture.detectChanges();
    expect(texto()).toContain('No tienes notificaciones.');
  });

  it('shows the error state and retries', () => {
    http.expectOne((r) => r.url === base).flush({}, { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect(texto()).toContain('No se pudieron cargar las notificaciones.');

    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    lista([noti('1')]);
    fixture.detectChanges();
    expect(texto()).toContain('Aviso 1');
  });

  it('offers "Marcar como leída" only for unread items and marks locally', async () => {
    lista([noti('1'), noti('2', true)]);
    fixture.detectChanges();
    const botones = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    expect(botones.filter((b) => b.textContent?.includes('Marcar como leída')).length).toBe(1);

    botones[0].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.notificaciones()[0].leida).toBe(true);
  });

  it('prepends a live notification on the first page', () => {
    lista([noti('1')]);
    nuevas$.next(noti('9'));
    fixture.detectChanges();
    expect(fixture.componentInstance.notificaciones().map((n) => n.id)).toEqual(['9', '1']);
    expect(fixture.componentInstance.total()).toBe(2);
  });

  it('does not duplicate a live notification already in the list (same id delivered twice)', () => {
    lista([noti('1')]);
    nuevas$.next(noti('9'));
    nuevas$.next(noti('9'));
    nuevas$.next(noti('1'));
    fixture.detectChanges();
    expect(fixture.componentInstance.notificaciones().map((n) => n.id)).toEqual(['9', '1']);
    expect(fixture.componentInstance.total()).toBe(2);
  });

  it('counts a duplicated live event only once even when not on the first page', () => {
    lista([noti('1')], 25);
    fixture.componentInstance.cargar(2);
    http.expectOne((r) => r.url === base).flush({ count: 25, next: null, previous: null, results: [noti('11')], no_leidas: 2 });
    nuevas$.next(noti('9'));
    nuevas$.next(noti('9'));
    expect(fixture.componentInstance.total()).toBe(26);
    expect(fixture.componentInstance.notificaciones().map((n) => n.id)).toEqual(['11']);
  });

  it('shows the "Anuncios" heading', () => {
    lista([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Anuncios');
    expect(texto()).not.toContain('Todas las Notificaciones');
  });

  it('does not filter by scope on the client: shows notices of any scope', () => {
    lista([{ ...noti('1'), alcance: 'PROFESOR' }, { ...noti('2'), alcance: 'ESTUDIANTE' }]);
    fixture.detectChanges();
    expect(texto()).toContain('Aviso 1');
    expect(texto()).toContain('Aviso 2');
  });

  it('shows the paginator only when there is more than one page and loads the chosen page', () => {
    lista([noti('1')], 25);
    fixture.detectChanges();
    expect(texto()).toContain('Página 1 de 3');

    fixture.componentInstance.cargar(2);
    const req = http.expectOne((r) => r.url === base);
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ count: 25, next: null, previous: null, results: [noti('11')], no_leidas: 2 });
    expect(fixture.componentInstance.pagina()).toBe(2);
  });
});
