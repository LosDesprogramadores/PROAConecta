import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-restablecer-password',
  imports: [ReactiveFormsModule, RouterModule],
  templateUrl: './restablecer-password.html',
  styleUrl: './restablecer-password.css',
})
export class RestablecerPassword implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);

  uid = signal<string>('');
  token = signal<string>('');

  isLoading = signal<boolean>(false);
  mensajeExito = signal<string | null>(null);
  errorMessage = signal<string | null>(null);
  showPassword = signal<boolean>(false);

  form = this.fb.nonNullable.group({
    password_nuevo: ['', [Validators.required, Validators.minLength(8)]],
    confirmar_password: ['', [Validators.required]],
  });

  ngOnInit(): void {
    const uidParam = this.route.snapshot.queryParamMap.get('uid') || '';
    const tokenParam = this.route.snapshot.queryParamMap.get('token') || '';

    this.uid.set(uidParam);
    this.token.set(tokenParam);

    if (!uidParam || !tokenParam) {
      this.errorMessage.set('El enlace de recuperación es inválido o se encuentra incompleto.');
    }
  }

  toggleShowPassword(): void {
    this.showPassword.update((prev) => !prev);
  }

  onSubmit(): void {
    if (this.form.invalid || !this.uid() || !this.token()) {
      this.form.markAllAsTouched();
      return;
    }

    const { password_nuevo, confirmar_password } = this.form.getRawValue();

    if (password_nuevo !== confirmar_password) {
      this.errorMessage.set('Las contraseñas no coinciden.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.confirmarRecuperacion({
      uid: this.uid(),
      token: this.token(),
      password_nuevo,
    }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.mensajeExito.set('¡Contraseña restablecida exitosamente! Redirigiendo a Inicio de Sesión...');
        const redireccion = setTimeout(() => this.router.navigate(['/login']), 2500);
        this.destroyRef.onDestroy(() => clearTimeout(redireccion));
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(this.toastService.readable_message_extraction(err));
      },
    });
  }
}