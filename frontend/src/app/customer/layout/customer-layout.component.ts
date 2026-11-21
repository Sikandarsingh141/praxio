import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationCenterComponent } from '../../core/notifications/notification-center.component';
import { ChatService } from '../../shared/services/chat.service';
import { CustomerJobCounts, JobSharedService } from '../../shared/services/job-shared.service';

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
  private readonly jobs = inject(JobSharedService);
  private readonly destroyRef = inject(DestroyRef);
  private requestCountsRequestId = 0;

  readonly requestSubmenus: Array<{
    label: string;
    route: string;
    countKey: keyof CustomerJobCounts;
  }> = [
    { label: 'New Requests', route: '/customer/jobs/new-jobs', countKey: 'new' },
    { label: 'Pending Requests', route: '/customer/jobs/pending-jobs', countKey: 'pending' },
    { label: 'Active Repairs', route: '/customer/jobs/active-jobs', countKey: 'active' },
    { label: 'Disputes', route: '/customer/jobs/disputed-jobs', countKey: 'disputed' },
    { label: 'Completed Repairs', route: '/customer/jobs/completed-jobs', countKey: 'completed' },
  ];

  ngOnInit(): void {
    if (this.profileOnly()) return;
    this.loadRequestCounts();
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (this.isRequestSectionActive()) this.requestSectionExpanded.set(true);
        if (this.isRequestListRouteActive()) this.loadRequestCounts();
      });
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
  readonly requestSectionExpanded = signal(this.isRequestSectionActive());
  readonly requestCounts = signal<CustomerJobCounts | null>(null);
  readonly requestCountsLoading = signal(false);
  readonly requestCountsError = signal('');
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
      label: 'My Requests',
      icon: 'tool',
      available: true,
    },
    {
      label: 'All Requests',
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
      label: 'Messages',
      icon: 'message',
      route: '/customer/messages',
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

  @HostListener('window:keydown', ['$event'])
  focusShopSearch(event: KeyboardEvent): void {
    if (
      this.profileOnly() ||
      !(event.ctrlKey || event.metaKey) ||
      event.key.toLowerCase() !== 'k'
    ) {
      return;
    }

    event.preventDefault();
    const mobile = window.innerWidth <= 560;
    if (!mobile) {
      const input = document.getElementById('customer-global-search');
      if (input instanceof HTMLInputElement) input.focus();
      return;
    }

    this.mobileSearchOpen.set(true);
    setTimeout(() => {
      const input = document.getElementById('customer-mobile-search');
      if (input instanceof HTMLInputElement) input.focus();
    });
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  toggleRequestSection(): void {
    this.requestSectionExpanded.update((expanded) => !expanded);
  }

  isRequestSectionActive(): boolean {
    return this.requestSubmenus.some((item) => this.isRequestSubmenuActive(item.route));
  }

  isRequestSubmenuActive(route: string): boolean {
    const currentRoute = this.router.url.split('?')[0].replace(/\/+$/, '');
    return currentRoute === route || currentRoute.startsWith(`${route}/`);
  }

  private isRequestListRouteActive(): boolean {
    const currentRoute = this.router.url.split('?')[0].replace(/\/+$/, '');
    return this.requestSubmenus.some((item) => currentRoute === item.route);
  }

  private loadRequestCounts(): void {
    const requestId = ++this.requestCountsRequestId;
    if (!this.requestCounts()) this.requestCountsLoading.set(true);
    this.requestCountsError.set('');
    this.jobs
      .customerJobCounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (counts) => {
          if (requestId !== this.requestCountsRequestId) return;
          this.requestCounts.set(counts);
          this.requestCountsLoading.set(false);
        },
        error: () => {
          if (requestId !== this.requestCountsRequestId) return;
          this.requestCountsError.set('Request counts could not be loaded.');
          this.requestCountsLoading.set(false);
        },
      });
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
        : 'All Requests';
    }
    return url.startsWith('/customer/profile') ? 'My profile' : 'Dashboard';
  }
}
