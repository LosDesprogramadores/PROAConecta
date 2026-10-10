import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../../core/auth/auth.service';
import { Actividad } from '../../../model/actividad-model';
import { ActividadesService } from '../../../services/actividades.service';
import { MateriaService } from '../../../services/materia.service';
import { MensajesEstadoService } from '../../../services/mensajes-estado.service';
import { WelcomeProfesor } from './welcome-profesor';

const dias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

function actividad(id: number, datos: Partial<Actividad>): Actividad {
  return { id, materia: 4, titulo: `A${id}`, estado: 'PUBLICADA', fecha_limite: dias(3), ...datos } as Actividad;
}

describe('WelcomeProfesor', () => {
  let fixture: ComponentFixture<WelcomeProfesor>;
  let component: WelcomeProfesor;
  const noLeidos = signal(0);
  const getEntregasPagina = vi.fn();
  const getActividades = vi.fn();
  const dom = () => fixture.nativeElement as HTMLElement;
  const tarjeta = (nombre: string) =>
    Array.from(dom().querySelectorAll<HTMLAnchorElement>('[data-testid="tarjeta"]')).find((a) => a.textContent!.includes(nombre))!;

  async function crear() {
    await TestBed.configureTestingModule({
      imports: [WelcomeProfesor],
      providers: [
        provideRouter([]),
        { provide: ActividadesService, useValue: { getActividades, getEntregasPagina } },
        { provide: MateriaService, useValue: { obtenerMateriasPorProfesor: () => of([{ id: 4, titulo: 'Matemática I', total_estudiantes: 12 }]) } },
        { provide: AuthService, useValue: { currentUser: signal({ id: 1, rolId: 2, persona: { id: 5, nombre: 'Ana', apellido: 'P' } }) } },
        { provide: MensajesEstadoService, useValue: { noLeidos } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(WelcomeProfesor);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    noLeidos.set(0);
    getEntregasPagina.mockReset().mockReturnValue(of({ count: 12, next: null, previous: null, results: [] }));
    getActividades.mockReset().mockReturnValue(of([]));
  });

  it('should create', async () => {
    await crear();
    expect(component).toBeTruthy();
  });

  describe('Entregas card', () => {
    it('asks for the count of deliveries without a grade, one item only', async () => {
      await crear();

      expect(getEntregasPagina).toHaveBeenCalledWith({ calificada: false, page: 1, page_size: 1 });
    });

    it('shows the real count and links to the global deliveries view', async () => {
      await crear();

      expect(tarjeta('Entregas').textContent).toContain('12 por calificar');
      expect(tarjeta('Entregas').getAttribute('href')).toBe('/dashboard/entregas');
    });

    it('shows "Sin entregas por calificar" when there are none', async () => {
      getEntregasPagina.mockReturnValue(of({ count: 0, next: null, previous: null, results: [] }));
      await crear();

      expect(tarjeta('Entregas').textContent).toContain('Sin entregas por calificar');
    });

    it('shows "No disponible" instead of a made-up number when the count fails', async () => {
      getEntregasPagina.mockReturnValue(throwError(() => new Error('boom')));
      await crear();

      expect(tarjeta('Entregas').textContent).toContain('No disponible');
      expect(tarjeta('Entregas').textContent).not.toContain('12');
    });
  });

  describe('Consultas card', () => {
    it('shows the unread messages and links to the inbox', async () => {
      noLeidos.set(3);
      await crear();

      expect(tarjeta('Consultas').textContent).toContain('3 sin leer');
      expect(tarjeta('Consultas').getAttribute('href')).toBe('/dashboard/mensajes');
    });

    it('shows "Sin consultas pendientes" with no unread messages and follows the live counter', async () => {
      await crear();
      expect(tarjeta('Consultas').textContent).toContain('Sin consultas pendientes');

      noLeidos.set(2);
      fixture.detectChanges();

      expect(tarjeta('Consultas').textContent).toContain('2 sin leer');
    });

    it('no longer shows the hardcoded sample numbers', async () => {
      await crear();

      expect(dom().textContent).not.toContain('Sin responder');
      expect(dom().textContent).not.toContain('25 Ago');
    });
  });

  describe('Actividades card', () => {
    it('counts only published activities whose deadline has not passed', async () => {
      getActividades.mockReturnValue(
        of([
          actividad(1, {}),
          actividad(2, { fecha_limite: dias(-2) }),
          actividad(3, { estado: 'BORRADOR' }),
        ]),
      );
      await crear();

      expect(tarjeta('Actividades').textContent).toContain('1 Vigentes');
    });

    it('shows zero when there are no current activities instead of the total', async () => {
      getActividades.mockReturnValue(of([actividad(2, { fecha_limite: dias(-2) })]));
      await crear();

      expect(tarjeta('Actividades').textContent).toContain('0 Vigentes');
    });
  });

  describe('next delivery of each materia', () => {
    it('shows the nearest deadline of the published activities of the materia', async () => {
      getActividades.mockReturnValue(of([actividad(1, { fecha_limite: '2099-05-20T12:00:00Z' }), actividad(2, { fecha_limite: '2099-03-10T12:00:00Z' })]));
      await crear();

      expect(dom().textContent).toContain('Próxima entrega: 10/03/2099');
    });

    it('says there are no upcoming deliveries when the materia has none', async () => {
      await crear();

      expect(dom().textContent).toContain('Sin entregas próximas');
    });
  });
});
