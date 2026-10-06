import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnunciosMateriaComponent } from './anuncios';

describe('AnunciosMateriaComponent', () => {
  let component: AnunciosMateriaComponent;
  let fixture: ComponentFixture<AnunciosMateriaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnunciosMateriaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AnunciosMateriaComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
