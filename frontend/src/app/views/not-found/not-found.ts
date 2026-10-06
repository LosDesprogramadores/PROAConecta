import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <main class="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
      <p class="text-6xl font-bold text-sky-600">404</p>
      <h1 class="text-2xl font-semibold text-gray-800">Página no encontrada</h1>
      <p class="text-gray-600">La dirección que buscas no existe o fue movida.</p>
      <a routerLink="/" class="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700">
        Volver al inicio
      </a>
    </main>
  `,
})
export class NotFound {}
