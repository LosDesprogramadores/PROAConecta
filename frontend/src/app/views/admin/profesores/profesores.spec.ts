import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Profesores } from './profesores';

describe('Profesores', () => {
  let component: Profesores;
  let fixture: ComponentFixture<Profesores>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Profesores]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Profesores);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
