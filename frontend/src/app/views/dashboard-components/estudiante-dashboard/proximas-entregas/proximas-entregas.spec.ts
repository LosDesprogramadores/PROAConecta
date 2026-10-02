import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProximasEntregas } from './proximas-entregas';

describe('ProximasEntregas', () => {
  let component: ProximasEntregas;
  let fixture: ComponentFixture<ProximasEntregas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProximasEntregas]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProximasEntregas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
