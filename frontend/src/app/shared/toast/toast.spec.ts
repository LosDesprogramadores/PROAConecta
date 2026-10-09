import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Toast } from './toast';
import { ToastService } from '../../services/toast.service';

describe('Toast', () => {
  let component: Toast;
  let fixture: ComponentFixture<Toast>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Toast]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Toast);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('Toast markup', () => {
  let fixture: ComponentFixture<Toast>;
  let service: ToastService;
  const dom = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Toast] }).compileComponents();
    fixture = TestBed.createComponent(Toast);
    service = TestBed.inject(ToastService);
    await fixture.whenStable();
  });

  it('renders error toasts as alerts with an accessible close button that dismisses them', () => {
    service.error('Falló el guardado');
    fixture.detectChanges();
    const aviso = dom().querySelector('[role="alert"]');
    expect(aviso).not.toBeNull();
    const cerrar = aviso!.querySelector<HTMLButtonElement>('button[aria-label="Cerrar aviso"]')!;
    expect(cerrar).not.toBeNull();
    cerrar.click();
    fixture.detectChanges();
    expect(dom().querySelector('[role="alert"]')).toBeNull();
  });

  it('renders non-error toasts as status', () => {
    service.success('Listo');
    fixture.detectChanges();
    expect(dom().querySelector('[role="status"]')).not.toBeNull();
    expect(dom().querySelector('[role="alert"]')).toBeNull();
  });

  it('shows the draining progress bar only on auto-dismissing toasts', () => {
    service.error('Falló el guardado');
    fixture.detectChanges();
    expect(dom().querySelector('.toast-progress')).toBeNull();

    service.success('Listo');
    fixture.detectChanges();
    expect(dom().querySelectorAll('.toast-progress').length).toBe(1);
  });
});
