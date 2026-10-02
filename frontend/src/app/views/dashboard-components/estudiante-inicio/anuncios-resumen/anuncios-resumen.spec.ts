import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnunciosResumen } from './anuncios-resumen';

describe('AnunciosResumen', () => {
  let component: AnunciosResumen;
  let fixture: ComponentFixture<AnunciosResumen>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnunciosResumen]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AnunciosResumen);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
