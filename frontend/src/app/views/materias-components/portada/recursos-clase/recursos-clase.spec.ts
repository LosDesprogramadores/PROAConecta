import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecursosClase } from './recursos-clase';

describe('RecursosClase', () => {
  let component: RecursosClase;
  let fixture: ComponentFixture<RecursosClase>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecursosClase]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecursosClase);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
