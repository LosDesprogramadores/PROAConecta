import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { UserRole } from '../../core/auth/auth.model';
import { INotificacion } from '../../model/notificacion.model';
import { NotificacionSocketService } from '../../services/notificacion-socket.service';
import { Navbar } from './navbar';

describe('Navbar', () => {
  let component: Navbar;
  let fixture: ComponentFixture<Navbar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Navbar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('Navbar notifications (logged in)', () => {
  const urlLista = `${environment.apiUrl}notificaciones/`;
  let fixture: ComponentFixture<Navbar>;
  let http: HttpTestingController;
  let socket$: Subject<INotificacion>;

  beforeEach(async () => {
    socket$ = new Subject<INotificacion>();
    await TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            token: signal('jwt'),
            currentUser: signal({ id: 1, rolId: UserRole.ESTUDIANTE, persona: { id: 5, nombre: 'Ana', apellido: 'P' } }),
          },
        },
        { provide: NotificacionSocketService, useValue: { escucharNotificaciones: () => socket$.asObservable() } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Navbar);
    fixture.detectChanges();
  });

  it('shows the real unread counter and the last notifications from the API', () => {
    const req = http.expectOne((r) => r.url === urlLista);
    expect(req.request.params.get('page_size')).toBe('5');
    req.flush({
      count: 1, next: null, previous: null, no_leidas: 3,
      results: [{ id: 'n1', titulo: 'Parcial', mensaje: 'Jueves', alcance: 'AMBOS', leida: false }],
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.unreadCount()).toBe(3);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Parcial');
  });

  it('raises the counter with a live notification and lowers it when marked as read', () => {
    http.expectOne((r) => r.url === urlLista).flush({ count: 0, next: null, previous: null, no_leidas: 0, results: [] });

    socket$.next({ id: 'n2', titulo: 'Nuevo', mensaje: 'm', alcance: 'AMBOS', leida: false });
    expect(fixture.componentInstance.unreadCount()).toBe(1);

    fixture.componentInstance.marcarNotificacionLeida(fixture.componentInstance.notifications()[0]);
    http.expectOne(`${urlLista}n2/leer/`).flush({ id: 'n2', leida: true });
    expect(fixture.componentInstance.unreadCount()).toBe(0);
  });
});
