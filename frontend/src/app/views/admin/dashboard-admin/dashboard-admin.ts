import { Component } from '@angular/core';
import { Navbar } from '../../../shared/navbar/navbar';
import { Footer } from '../../../shared/footer/footer';
import { Sidebar } from '../../../shared/sidebar/sidebar';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-dashboard-admin',
  imports: [ Navbar, Footer, Sidebar, RouterOutlet],
  templateUrl: './dashboard-admin.html',
  styleUrl: './dashboard-admin.css',
})
export class DashboardAdmin {

}
