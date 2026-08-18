import { Component, HostListener, signal } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-navbar',
  imports: [RouterModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {

isMobileMenuOpen = signal<boolean>(false);
  isProfileMenuOpen = signal<boolean>(false);
  unreadCount = signal<number>(4);

  userName = signal<string>('Juan Pérez');
  userAvatar = signal<string>('https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80');

  navLinks = [
    { label: 'Materias', path: '/materias' },
    { label: 'Foros', path: '/foros' },
    { label: 'Actividades', path: '/actividades' }
  ];

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update(v => !v);
  }

  toggleProfileMenu(): void {
    this.isProfileMenuOpen.update(v => !v);
  }

  closeMenus(): void {
    this.isMobileMenuOpen.set(false);
    this.isProfileMenuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('#user-menu-button') && !target.closest('#user-menu-dropdown')) {
      this.isProfileMenuOpen.set(false);
    }
  }
}