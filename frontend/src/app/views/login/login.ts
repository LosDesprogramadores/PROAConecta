import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ServiceAuth } from '../../services/service.auth';

@Component({
  selector: 'app-login',
  imports: [RouterModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  loginForm: FormGroup;

  constructor(private formbuilder: FormBuilder, private serviceAuth: ServiceAuth, private router: Router) {

    this.loginForm = this.formbuilder.group({
      dni: ['', [Validators.required, Validators.minLength(8), Validators.pattern('^[0-9]+$')]],
      password: ['', [Validators.required, Validators.minLength(4)]]
    });
  }

  login() {
    const { dni, password } = this.loginForm.value;

    const usuario = this.serviceAuth.login(
      dni ?? '',
      password ?? ''
    );

    console.log(usuario);
    if (usuario) {
      this.router.navigate(['/dashboard']);
      console.log(this.serviceAuth.getUsuario());
    } else {
      console.log('Formulario inválido');
    }
  }
}
