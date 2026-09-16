import { TestBed } from '@angular/core/testing';

import { Materiales } from './materiales';

describe('Materiales', () => {
  let service: Materiales;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Materiales);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
