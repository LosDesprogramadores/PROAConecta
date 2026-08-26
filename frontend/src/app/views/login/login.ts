import { Component, inject , signal} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

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
 
// 2. Signals para manejar el estado visual (carga y error)
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  // 3. Definimos el formulario con sus validaciones
  loginForm = this.formbuilder .nonNullable.group({
    dni: ['', [Validators.required]],
    password: ['', [Validators.required]]
  });

  // 4. Método que se ejecuta al presionar el botón "Ingresar"
  onSubmit(): void {
    // Si el formulario no es válido, no hacemos nada
    if (this.loginForm.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const credentials = this.loginForm.getRawValue();

    // Llamamos al servicio que creamos en el paso anterior
    this.authService.login(credentials).subscribe({
      next: () => {
        this.isLoading.set(false);
         console.log("Redirigimos al panel de administración tras el login exitoso");
         //("Redirigimos al panel de administración tras el login exitoso")
        //this.router.navigate(['/admin/estudiantes']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set('Credenciales incorrectas o error en el servidor');
        console.error('Error en el login:', err);
      }
    });
  }



    //  loginForm = this.formbuilder.group({
    //   username: ['', [Validators.required, Validators.minLength(8), Validators.pattern('^[0-9]+$')]],
    //   password: ['', [Validators.required, Validators.minLength(4)]]
    // });
  

  // login() {
  //   const {  username, password } = this.loginForm.value;

  //   const usuario = this.authService.login(
  //      username ?? '',
  //     password ?? ''
  //   );

  //   console.log(usuario);
  //   if (usuario) {
  //     this.router.navigate(['/dashboard']);
  //     console.log(this.authService.getUsuario());
  //   } else {
  //     console.log('Formulario inválido');
  //   }
  // }

  
}


