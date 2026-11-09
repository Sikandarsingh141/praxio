import { CommonModule } from '@angular/common';
import { Component, computed, HostListener, inject, signal, ViewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { NotificationCenterComponent } from '../core/notifications/notification-center.component';

@Component({
  selector: 'app-customer-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, NotificationCenterComponent],
  templateUrl: './customer-layout.component.html',
  styleUrl: './customer-layout.component.scss',
})
export class CustomerLayout {
  @ViewChild(NotificationCenterComponent) private notificationCenter?: NotificationCenterComponent;
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly menuOpen = signal(false);
  readonly accountMenuOpen = signal(false);
  readonly signingOut = signal(false);
  shopSearchQuery = '';
  readonly mobileSearchOpen = signal(false);
  readonly profileOnly = computed(() => {
    const user = this.authService.currentUser();
    return (
      user?.accountStatus !== 'active' ||
      user.customerAuthorization?.registrationStatus === 'pending' ||
      user.customerAuthorization?.registrationStatus === 'declined'
    );
  });

  readonly navigation = [
    { label: 'Dashboard', icon: 'grid', route: '/customer', available: true },
    { label: 'Find repair shops', icon: 'search', route: '/customer/shops', available: true },
    {
      label: 'My repair requests',
      icon: 'tool',
      route: '/customer/repair-requests',
      available: true,
    },
    {
      label: 'My quotations',
      icon: 'receipt',
      route: '/customer/quotations',
      available: true,
    },
    {
      label: 'Disputes',
      icon: 'message',
      route: '/customer/disputes',
      available: true,
    },
    {
      label: 'Completed Repairs',
      icon: 'tool',
      route: '/customer/repair-requests/completed',
      available: true,
    },
    { label: 'Messages', icon: 'message', available: false },
  ];

  readonly accountNavigation: Array<{
    label: string;
    icon: string;
    route?: string;
  }> = [
    { label: 'My profile', icon: 'user', route: '/customer/profile' },
    { label: 'My addresses', icon: 'pin' },
    { label: 'Settings', icon: 'settings' },
  ];

  get visibleNavigation(): Array<{
    label: string;
    icon: string;
    route?: string;
    available: boolean;
  }> {
    return this.profileOnly()
      ? [{ label: 'My profile', icon: 'user', route: '/customer/profile', available: true }]
      : this.navigation;
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  submitShopSearch(): void {
    const query = this.shopSearchQuery.trim();
    void this.router.navigate(['/customer/shops'], {
      queryParams: query ? { query } : {},
    });
    this.mobileSearchOpen.set(false);
    this.closeMenu();
  }

  updateShopSearchQuery(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.shopSearchQuery = event.target.value;
    }
  }

  toggleAccountMenu(): void {
    this.notificationCenter?.close();
    this.accountMenuOpen.update((open) => !open);
  }

  @HostListener('document:click', ['$event'])
  closeHeaderMenusOutside(event: MouseEvent): void {
    const target = event.target;
    if (target instanceof Element && target.closest('.notification-center, .account-menu')) {
      return;
    }
    this.closeAccountMenu();
    this.notificationCenter?.close();
  }

  closeAccountMenu(): void {
    this.accountMenuOpen.set(false);
  }

  signOut(): void {
    if (this.signingOut()) {
      return;
    }

    this.signingOut.set(true);
    this.authService.logout().subscribe({
      next: () => void this.router.navigateByUrl('/login'),
      error: () =>
        void this.router.navigate(['/login'], {
          queryParams: { reason: 'logout-unconfirmed' },
        }),
    });
  }

  getUserInitial(): string {
    const user = this.authService.currentUser();
    return (
      user?.fullName?.trim().slice(0, 1).toUpperCase() ??
      user?.email.slice(0, 1).toUpperCase() ??
      'P'
    );
  }

  getUserFirstName(): string {
    const fullName = this.authService.currentUser()?.fullName?.trim();
    return fullName || 'Account';
  }

  get breadcrumbPage(): string {
    const url = this.router.url;
    if (url.startsWith('/customer/shops/')) {
      return 'Shop details';
    }
    if (url.startsWith('/customer/shops')) {
      return 'Find repair shops';
    }
    if (url.startsWith('/customer/quotations')) {
      return 'My quotations';
    }
    if (url.startsWith('/customer/repair-requests')) {
      return url.startsWith('/customer/repair-requests/completed')
        ? 'Completed Repairs'
        : 'My repair requests';
    }
    return url.startsWith('/customer/profile') ? 'My profile' : 'Dashboard';
  }
}
