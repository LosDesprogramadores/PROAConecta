import { Component, inject , signal} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { UserRole } from '../../core/auth/auth.model';

import { Modal } from '../../shared/modal/modal';
import { ToastService } from '../../services/toast.service';
@Component({
  selector: 'app-login',
  imports: [Modal, RouterModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  
  private authService = inject(AuthService);
  private formbuilder = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toastService = inject(ToastService);
 
  isLoading = signal<boolean>(false);
  // Set by the auth interceptor when the session could not be renewed
  errorMessage = signal<string | null>(
    this.route.snapshot.queryParamMap.get('motivo') === 'sesion-expirada'
      ? 'Tu sesión expiró. Ingresá nuevamente.'
      : null,
  );
  showPassword = signal<boolean>(false);
  showModalRecuperar = signal<boolean>(false);
  emailRecuperacion = signal<string>('');
  isRecuperando = signal<boolean>(false);
  mensajeRecuperacion = signal<string | null>(null);
  errorRecuperacion = signal<string | null>(null);

  loginForm = this.formbuilder .nonNullable.group({
    dni: ['', [Validators.required]],
    password: ['', [Validators.required]]
  });

  abrirModalRecuperar(): void {
  this.mensajeRecuperacion.set(null);
  this.errorRecuperacion.set(null);
  this.emailRecuperacion.set('');
  this.showModalRecuperar.set(true);
  }

  cerrarModalRecuperar(): void {
    this.showModalRecuperar.set(false);
  }

  enviarSolicitudRecuperacion(): void {
    const email = this.emailRecuperacion().trim();
    if (!email) {
      this.errorRecuperacion.set('Ingresá tu correo electrónico.');
      return;
    }

    this.isRecuperando.set(true);
    this.errorRecuperacion.set(null);
    this.mensajeRecuperacion.set(null);

    this.authService.solicitarRecuperacion(email).subscribe({
      next: (res) => {
        this.isRecuperando.set(false);
        this.mensajeRecuperacion.set(
          res.mensaje || 'Si el correo se encuentra registrado, recibirás un enlace a la brevedad.'
        );
      },
      error: (err) => {
        this.isRecuperando.set(false);
        this.errorRecuperacion.set(this.toastService.readable_message_extraction(err));
      },
    });
  }

  toggleShowPassword(): void {
    this.showPassword.update(prev => !prev);
  }

  onSubmit(): void {
   
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const credentials = this.loginForm.getRawValue();

    this.authService.login(credentials).subscribe({
      next: (user) => {
        this.isLoading.set(false);

        if (user.debe_cambiar_password) {
          this.router.navigate(['/cambiar-password']);
          return;
        }
        
     switch (user.rolId) {
      case UserRole.ADMIN: 
        this.router.navigate(['/dashboard-admin']);
        break;

      case UserRole.DOCENTE: 
       this.router.navigate(['/dashboard']);
        break;

      case UserRole.ESTUDIANTE: 
        this.router.navigate(['/dashboard']);
        break;

      default:
        console.warn('Rol no reconocido:', user.rolId);
        this.router.navigate(['/home']);
        break;
    }
  },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(this.toastService.readable_message_extraction(err));
        console.error('Error en el login:', err);
      }
    });
  }
  
}


