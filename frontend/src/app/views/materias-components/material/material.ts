import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AuthService } from '../../../core/auth/auth.service';
import { UserRole } from '../../../core/auth/auth.model';

interface MaterialItem {
  id: number;
  titulo: string;
  descripcion: string;
  tipo: 'PDF' | 'LINK' | 'VIDEO' | 'DOCUMENTO';
  fecha: string;
  url: string;
}

@Component({
  selector: 'app-material',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './material.html',
  styleUrl: './material.css',
})
export class Material {

  private authService = inject(AuthService);

  private currentUser = this.authService.currentUser;

  esDocente = computed(() =>
    this.currentUser()?.rolId === UserRole.DOCENTE
  );

  materiales = signal<MaterialItem[]>([
    {
      id: 1,
      titulo: 'Programa de la materia',
      descripcion: 'Programa completo correspondiente al ciclo lectivo 2026.',
      tipo: 'PDF',
      fecha: '20/08/2026',
      url: '#'
    },
    {
      id: 2,
      titulo: 'Unidad 1 - Introducción',
      descripcion: 'Material introductorio de la primera unidad.',
      tipo: 'PDF',
      fecha: '22/08/2026',
      url: '#'
    },
    {
      id: 3,
      titulo: 'Material bibliográfico',
      descripcion: 'Bibliografía recomendada para acompañar la materia.',
      tipo: 'LINK',
      fecha: '23/08/2026',
      url: '#'
    },
    {
      id: 4,
      titulo: 'Video de introducción',
      descripcion: 'Video explicativo sobre los conceptos iniciales.',
      tipo: 'VIDEO',
      fecha: '25/08/2026',
      url: '#'
    }
  ]);

  abrirMaterial(material: MaterialItem): void {
    console.log('Abrir material:', material);
  }

  subirMaterial(): void {
    console.log('Abrir formulario para subir material');
  }

  editarMaterial(material: MaterialItem): void {
    console.log('Editar material:', material);
  }

  eliminarMaterial(material: MaterialItem): void {
    console.log('Eliminar material:', material);
  }
}