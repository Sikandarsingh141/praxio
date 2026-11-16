import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { NotificationCenterComponent } from '../core/notifications/notification-center.component';
import { NotificationRealtimeService } from '../core/notifications/notification-realtime.service';
import { ChatService } from '../shared/chat.service';
import { TechniciansService } from './technicians.service';
import { Technician, TechnicianSearchResult } from './technicians.models';

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
export class TechnicianLayoutComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  readonly chat = inject(ChatService);
  private readonly technicians = inject(TechniciansService);
  private readonly router = inject(Router);
  private readonly notificationRealtime = inject(NotificationRealtimeService);
  private notificationCountSubscription?: Subscription;

  readonly technician = signal<Technician | null>(null);
  readonly loadingAvailability = signal(false);
  readonly error = signal('');
  readonly accountMenuOpen = signal(false);
  readonly sidebarOpen = signal(false);
  readonly unreadNotificationCount = signal(0);

  // Global search state
  readonly searchQuery = signal('');
  readonly searchLoading = signal(false);
  readonly searchResults = signal<TechnicianSearchResult[] | null>(null);
  readonly searchError = signal('');
  private searchDebounce?: ReturnType<typeof setTimeout>;

  readonly navigation = [
    { label: 'Dashboard', route: '/technician', icon: 'dashboard', exact: true },
    { label: 'My Assigned Jobs', route: '/technician/jobs', icon: 'jobs', exact: true },
    { label: 'Active Jobs', route: '/technician/active-jobs', icon: 'active' },
    { label: 'Completed Jobs', route: '/technician/completed-jobs', icon: 'completed' },
    { label: 'Messages', route: '/technician/messages', icon: 'messages' },
    { label: 'My Profile', route: '/technician/profile', icon: 'profile' },
  ];

  ngOnInit(): void {
    this.chat.refreshUnreadMessageCount();
    this.loadTechnician();
    this.notificationCountSubscription =
      this.notificationRealtime.unreadCount$.subscribe((count) =>
        this.unreadNotificationCount.set(count),
      );
  }

  ngOnDestroy(): void {
    this.notificationCountSubscription?.unsubscribe();
  }

  @HostListener('window:keydown', ['$event'])
  handleGlobalKeyDown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      const input = document.getElementById('technician-global-search') as HTMLInputElement | null;
      input?.focus();
    }
  }

  toggleAccountMenu(): void {
    this.accountMenuOpen.update((open) => !open);
  }

  closeAccountMenu(): void {
    this.accountMenuOpen.set(false);
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (!target.closest('.account-menu') && this.accountMenuOpen()) {
      this.closeAccountMenu();
    }
    if (!target.closest('.global-search') && this.searchResults() !== null) {
      this.closeGlobalSearch();
    }
  }

  updateSearchQuery(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.searchQuery.set(query);
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    if (!query.trim()) {
      this.searchResults.set(null);
      this.searchLoading.set(false);
      this.searchError.set('');
      return;
    }
    this.searchDebounce = setTimeout(() => {
      this.searchJobs();
    }, 280);
  }

  searchJobs(): void {
    const query = this.searchQuery().trim();
    if (!query) {
      this.searchResults.set(null);
      return;
    }
    this.searchLoading.set(true);
    this.searchError.set('');
    this.technicians.search(query).subscribe({
      next: (results) => {
        this.searchResults.set(results);
        this.searchLoading.set(false);
      },
      error: () => {
        this.searchError.set('Could not load search results. Please try again.');
        this.searchLoading.set(false);
      },
    });
  }

  closeGlobalSearch(): void {
    this.searchResults.set(null);
    this.searchError.set('');
  }

  getUserDisplayName(): string {
    const tech = this.technician();
    if (tech?.name) return tech.name;
    const user = this.auth.currentUser();
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
    if (name) return name;
    return 'Technician';
  }

  getUserInitial(): string {
    return this.getUserDisplayName().slice(0, 1).toUpperCase() || 'T';
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
    this.closeAccountMenu();
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
