import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { UserRole } from '../../core/auth/auth.model';


interface NavLink {
  label: string;
  path: string;
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar implements OnInit{
 private authService = inject(AuthService);
 private rol = this.authService.rol()
 private router = inject(Router);
 links: NavLink[] = [];

  ngOnInit(): void {
    
    switch (this.rol) {
      case UserRole.ADMIN: 
      this.links = [
          { label: 'Profesores', path: '/admin/Profesores' },
          { label: 'Estudiantes', path: 'admin/estudiantes' },
          { label: 'Materias', path: '/admin/Materias' }
        ];
        break;

      case UserRole.DOCENTE: 
      this.links = [
          { label: 'Mis Clases', path: '/docente/materias' },
          { label: 'Calificaciones', path: '/docente/calificaciones' }
        ];
        break;

      case UserRole.ESTUDIANTE: 
        this.links = [
          { label: 'Anuncios', path: '/dashboard/anuncios' },
          { label: 'Materias', path: '/dashboard/materias' },
          { label: 'Contacto', path: '/dashboard/contacto' }
        ]
        break;

      default:
        console.warn('Rol no reconocido:', this.rol);
       this.links = [];
        break;
    }
  }

 
 
 
 

  
}
