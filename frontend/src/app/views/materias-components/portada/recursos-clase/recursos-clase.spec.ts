import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../../../core/auth/auth.service';
import { MaterialesService } from '../../../../services/materiales.service';
import { ToastService } from '../../../../services/toast.service';
import { RecursosClaseComponent } from './recursos-clase';

describe('RecursosClaseComponent', () => {
  let component: RecursosClaseComponent;
  let fixture: ComponentFixture<RecursosClaseComponent>;
  let materiales: Record<string, ReturnType<typeof vi.fn>>;
  const toast = { success: vi.fn(), error: vi.fn() };

  beforeEach(async () => {
    toast.error.mockClear();
    materiales = {
      obtenerMaterialesGenerales: vi.fn(() => of([])),
      crearMaterial: vi.fn(() => of({})),
      actualizarMaterial: vi.fn(() => of({})),
    };
    await TestBed.configureTestingModule({
      imports: [RecursosClaseComponent],
      providers: [
        { provide: MaterialesService, useValue: materiales },
        { provide: ToastService, useValue: toast },
        { provide: AuthService, useValue: { currentUser: signal({ rolNombre: 'Profesor' }) } },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecursosClaseComponent);
    component = fixture.componentInstance;
    component.materiaId = 7;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens the form with the defaults', () => {
    component.abrirFormularioRecurso();
    fixture.detectChanges();
    expect(component.formulario.getRawValue()).toEqual({ tipo: 'DOCUMENTO', titulo: '', url: '', visible: true });
    expect(fixture.nativeElement.querySelector('label[for="recurso-titulo"]')).not.toBeNull();
  });

  it('refuses to save without a title', () => {
    component.abrirFormularioRecurso();
    component.guardarRecurso();
    expect(materiales['crearMaterial']).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('El título es requerido');
  });

  it('refuses to save without URL or file', () => {
    component.abrirFormularioRecurso();
    component.formulario.patchValue({ titulo: 'Programa' });
    component.guardarRecurso();
    expect(toast.error).toHaveBeenCalledWith('Debes ingresar una URL o seleccionar un archivo');
  });

  it('creates the resource with the typed values and https:// prefix', () => {
    component.abrirFormularioRecurso();
    component.formulario.patchValue({ tipo: 'video', titulo: ' Clase 1 ', url: 'youtube.com/x', visible: false });
    component.guardarRecurso();

    expect(materiales['crearMaterial']).toHaveBeenCalledWith(
      { materia: 7, unidad: null, tipo: 'VIDEO', titulo: 'Clase 1', enlace: 'https://youtube.com/x', visible: false },
      undefined,
    );
    expect(component.mostrarFormulario()).toBe(false);
  });

  it('fills the form to edit a resource and updates it', () => {
    component.prepararEditarRecurso({ id: 3, materia: 7, tipo: 'ENLACE', titulo: 'Sitio', enlace: 'https://a.test', visible: true });
    expect(component.formulario.getRawValue()).toEqual({ tipo: 'ENLACE', titulo: 'Sitio', url: 'https://a.test', visible: true });

    component.guardarRecurso();
    expect(materiales['actualizarMaterial']).toHaveBeenCalledWith(3, expect.objectContaining({ titulo: 'Sitio' }), undefined);
  });
});
