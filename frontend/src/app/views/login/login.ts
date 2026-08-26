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

  loginForm = this.formbuilder .nonNullable.group({
    dni: ['', [Validators.required]],
    password: ['', [Validators.required]]
  });

  onSubmit(): void {
   
    if (this.loginForm.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const credentials = this.loginForm.getRawValue();

    this.authService.login(credentials).subscribe({
      next: (user) => {
        this.isLoading.set(false);
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


