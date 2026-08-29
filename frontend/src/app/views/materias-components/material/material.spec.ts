import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Material } from './material';

describe('Material', () => {
  let component: Material;
  let fixture: ComponentFixture<Material>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Material]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Material);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
