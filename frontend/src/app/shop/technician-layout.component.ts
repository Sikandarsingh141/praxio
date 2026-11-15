import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { NotificationCenterComponent } from '../core/notifications/notification-center.component';
import { ChatService } from '../shared/chat.service';
import { TechniciansService } from './technicians.service';
import { Technician } from './technicians.models';

@Component({
  selector: 'app-technician-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    NotificationCenterComponent,
  ],
  templateUrl: './technician-layout.component.html',
  styleUrl: './technician-layout.component.scss',
})
export class TechnicianLayoutComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly chat = inject(ChatService);
  readonly technician = signal<Technician | null>(null);
  readonly loadingAvailability = signal(false);
  readonly error = signal('');

  readonly navigation = [
    { label: 'Dashboard', route: '/technician', icon: 'dashboard', exact: true },
    { label: 'My Assigned Jobs', route: '/technician/jobs', icon: 'jobs' },
    { label: 'Job History', route: '/technician/history', icon: 'history' },
    { label: 'Messages', route: '/technician/messages', icon: 'messages' },
    { label: 'My Performance', route: '/technician/performance', icon: 'performance' },
    { label: 'Availability', route: '/technician/availability', icon: 'availability' },
    { label: 'My Profile', route: '/technician/profile', icon: 'profile' },
  ];

  private readonly router = inject(Router);

  constructor(private readonly technicians: TechniciansService) {}

  ngOnInit(): void {
    this.chat.refreshUnreadMessageCount();
    this.loadTechnician();
  }

  updateAvailability(event: Event): void {
    const preference = (event.target as HTMLSelectElement).value;
    if (preference !== 'available' && preference !== 'on_leave') return;
    this.loadingAvailability.set(true);
    this.error.set('');
    this.technicians
      .updateMyAvailability(preference)
      .pipe(finalize(() => this.loadingAvailability.set(false)))
      .subscribe({
        next: (technician) => this.technician.set(technician),
        error: (error: HttpErrorResponse) =>
          this.error.set(
            error.error?.message || 'Your availability could not be updated.',
          ),
      });
  }

  signOut(): void {
    this.auth.logout().subscribe({
      next: () => void this.router.navigate(['/auth/login']),
      error: () => {
        this.auth.clearSession();
        void this.router.navigate(['/auth/login']);
      },
    });
  }

  private loadTechnician(): void {
    this.technicians.myProfile().subscribe({
      next: (technician) => this.technician.set(technician),
      error: (error: HttpErrorResponse) =>
        this.error.set(
          error.error?.message || 'Technician profile could not be loaded.',
        ),
    });
  }
}
