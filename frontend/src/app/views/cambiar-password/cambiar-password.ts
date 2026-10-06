import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { UserRole } from '../../core/auth/auth.model';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-cambiar-password',
  imports: [RouterModule, ReactiveFormsModule],
  templateUrl: './cambiar-password.html',
  styleUrl: './cambiar-password.css',
})
export class CambiarPassword {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  showActual = signal<boolean>(false);
  showNuevo = signal<boolean>(false);
  showConfirm = signal<boolean>(false);

  form = this.fb.nonNullable.group({
    password_actual: ['', [Validators.required]],
    password_nuevo: ['', [Validators.required, Validators.minLength(8)]],
    confirmar_password: ['', [Validators.required]],
  });

  toggleShowActual(): void {
    this.showActual.update((prev) => !prev);
  }

  toggleShowNuevo(): void {
    this.showNuevo.update((prev) => !prev);
  }

  toggleShowConfirm(): void {
    this.showConfirm.update((prev) => !prev);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { password_actual, password_nuevo, confirmar_password } = this.form.getRawValue();

    if (password_nuevo !== confirmar_password) {
      this.errorMessage.set('Las contraseñas no coinciden.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.cambiarPasswordPrimerIngreso({ password_actual, password_nuevo }).subscribe({
      next: () => {
        this.isLoading.set(false);
        const user = this.authService.currentUser();

        if (user?.rolId === UserRole.ADMIN) {
          this.router.navigate(['/dashboard-admin']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(this.toastService.readable_message_extraction(err));
      },
    });
  }

  volverAlLogin(): void {
    this.authService.logout();
  }
}