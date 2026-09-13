import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TablaGenerica } from './tabla-generica';

describe('TablaGenerica', () => {
  let component: TablaGenerica;
  let fixture: ComponentFixture<TablaGenerica>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TablaGenerica]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TablaGenerica);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
