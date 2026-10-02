import { Component, inject , signal} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { UserRole } from '../../core/auth/auth.model';

@Component({
  selector: 'app-login',
  imports: [RouterModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  
  private authService = inject(AuthService);
  private formbuilder = inject(FormBuilder);
  private router = inject(Router);
 
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
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
        this.errorRecuperacion.set(err.error?.error || 'No se pudo procesar la solicitud.');
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
        this.errorMessage.set('Credenciales incorrectas o error en el servidor');
        console.error('Error en el login:', err);
      }
    });
  }
  
}


