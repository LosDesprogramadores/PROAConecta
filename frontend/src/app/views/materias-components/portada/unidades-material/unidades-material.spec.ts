import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UnidadesMaterial } from './unidades-material';

describe('UnidadesMaterial', () => {
  let component: UnidadesMaterial;
  let fixture: ComponentFixture<UnidadesMaterial>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UnidadesMaterial]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UnidadesMaterial);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
