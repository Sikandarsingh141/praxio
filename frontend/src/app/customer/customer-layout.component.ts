import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { NotificationCenterComponent } from '../core/notifications/notification-center.component';
import { ChatService } from '../shared/chat.service';

@Component({
  selector: 'app-customer-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, NotificationCenterComponent],
  templateUrl: './customer-layout.component.html',
  styleUrl: './customer-layout.component.scss',
})
export class CustomerLayout implements OnInit, OnDestroy {
  @ViewChild(NotificationCenterComponent) private notificationCenter?: NotificationCenterComponent;
  readonly authService = inject(AuthService);
  readonly chat = inject(ChatService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    if (this.profileOnly()) return;
    this.chat.connect();
    this.chat.refreshUnreadMessageCount();
  }

  ngOnDestroy(): void {
    this.chat.disconnect();
  }

  readonly menuOpen = signal(false);
  readonly accountMenuOpen = signal(false);
  readonly signingOut = signal(false);
  readonly searchingShops = signal(false);
  shopSearchQuery = '';
  readonly mobileSearchOpen = signal(false);
  readonly profileOnly = computed(() => {
    const user = this.authService.currentUser();
    return (
      user?.accountStatus !== 'active' ||
      user?.accountLifecycleStatus === 'inactive' ||
      user?.accountLifecycleStatus === 'suspended'
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
      label: 'Messages',
      icon: 'message',
      route: '/customer/messages',
      available: true,
    },
    {
      label: 'Completed Repairs',
      icon: 'tool',
      route: '/customer/repair-requests/completed',
      available: true,
    },
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
    this.searchingShops.set(true);
    void this.router
      .navigate(['/customer/shops'], {
        queryParams: query ? { query } : {},
      })
      .finally(() => this.searchingShops.set(false));
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
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
    return (
      name.slice(0, 1).toUpperCase() ||
      user?.email.slice(0, 1).toUpperCase() ||
      'P'
    );
  }

  getUserDisplayName(): string {
    const user = this.authService.currentUser();
    return [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || 'Account';
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
