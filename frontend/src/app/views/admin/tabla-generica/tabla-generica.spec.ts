import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TablaGenerica } from './tabla-generica';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('TablaGenerica', () => {
  let component: TablaGenerica;
  let fixture: ComponentFixture<TablaGenerica>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TablaGenerica],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TablaGenerica);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not show the export buttons by default (backward compatible)', async () => {
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-exportar-listado')).toBeNull();
  });

  it('shows the export buttons when an export url is given', async () => {
    component.exportarUrl = 'http://api.test/api/materias/exportar/';
    fixture.changeDetectorRef.detectChanges();
    await fixture.whenStable();

    const textos = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('app-exportar-listado button')).map(
      (b) => b.textContent?.trim(),
    );
    expect(textos).toEqual(['Exportar CSV', 'Exportar PDF']);
  });
});
