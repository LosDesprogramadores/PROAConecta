import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

export const NOMBRE_APP = 'PROA Conecta';

/** Browser tab title: "<screen> · PROA Conecta", or just the app name when the route has no title. */
@Injectable({ providedIn: 'root' })
export class TituloStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const pantalla = this.buildTitle(snapshot);
    this.title.setTitle(pantalla ? `${pantalla} · ${NOMBRE_APP}` : NOMBRE_APP);
  }
}
