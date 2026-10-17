import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Construccion } from './construccion';

describe('Construccion', () => {
  let component: Construccion;
  let fixture: ComponentFixture<Construccion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Construccion]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Construccion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
