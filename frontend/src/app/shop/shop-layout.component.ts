import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { NotificationCenterComponent } from '../core/notifications/notification-center.component';
import { ChatService } from '../shared/chat.service';
import { ShopRepairRequestsService } from './shop-repair-requests.service';

@Component({
  selector: 'app-shop-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, NotificationCenterComponent],
  templateUrl: './shop-layout.component.html',
  styleUrl: './shop-layout.component.scss',
})
export class ShopLayout implements OnInit, OnDestroy {
  @ViewChild(NotificationCenterComponent) private notificationCenter?: NotificationCenterComponent;
  readonly authService = inject(AuthService);
  readonly chat = inject(ChatService);
  private readonly router = inject(Router);
  private readonly shopRequests = inject(ShopRepairRequestsService);
  readonly signingOut = signal(false);
  readonly accountMenuOpen = signal(false);
  readonly shopName = this.authService.shopName;
  readonly shopNameError = signal('');
  readonly searchQuery = signal('');
  readonly searchResults = signal<ShopActivitySearchResult[] | null>(null);
  readonly searchLoading = signal(false);
  readonly searchError = signal('');
  private searchRequestId = 0;

  ngOnInit(): void {
    this.chat.connect();
    this.chat.refreshUnreadMessageCount();
    this.authService.getShopDashboard().subscribe({
      error: () => this.shopNameError.set('Shop name could not be loaded.'),
    });
  }

  ngOnDestroy(): void {
    this.chat.disconnect();
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

  getUserInitial(): string {
    const user = this.authService.currentUser();
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
    return name ? name.slice(0, 1).toUpperCase() : 'P';
  }

  getUserDisplayName(): string {
    const user = this.authService.currentUser();
    return [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || 'Account';
  }

  updateSearchQuery(event: Event): void {
    this.searchRequestId += 1;
    this.searchLoading.set(false);
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.searchError.set('');
    this.searchResults.set(null);
  }

  searchShopActivity(): void {
    const query = this.searchQuery().trim();
    if (!query) {
      this.searchResults.set(null);
      this.searchError.set('Enter a search term to find repair requests or quotations.');
      return;
    }

    const requestId = ++this.searchRequestId;
    this.searchLoading.set(true);
    this.searchError.set('');
    this.searchResults.set(null);
    forkJoin({
      requests: this.shopRequests.list({ search: query, page: 1, limit: 5 }),
      quotations: this.shopRequests.listQuotations({ search: query, page: 1, limit: 5 }),
    }).subscribe({
      next: ({ requests, quotations }) => {
        if (requestId !== this.searchRequestId) return;
        this.searchResults.set([
          ...requests.requests.map((request) => ({
            id: request._id,
            kind: 'request' as const,
            title: request.appliance,
            details:
              request.customer.displayName ||
              `${request.customer.firstName} ${request.customer.lastName}`,
            requestReference: request._id.slice(-8).toUpperCase(),
            route: ['/shop/repair-requests', request._id],
          })),
          ...quotations.quotations.map((quotation) => ({
            id: quotation._id,
            kind: 'quotation' as const,
            title: quotation.repairRequest.appliance,
            details: `${quotation.customer.displayName || `${quotation.customer.firstName} ${quotation.customer.lastName}`} · ${quotation.amount} ${quotation.currency}`,
            requestReference: quotation.repairRequestId.slice(-8).toUpperCase(),
            route: ['/shop/quotations'],
            queryParams: { quotationId: quotation._id },
          })),
        ]);
        this.searchLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        if (requestId !== this.searchRequestId) return;
        this.searchError.set(
          error.error?.message || 'Shop activity search could not be completed.',
        );
        this.searchLoading.set(false);
      },
    });
  }

  closeGlobalSearch(): void {
    this.searchRequestId += 1;
    this.searchLoading.set(false);
    this.searchResults.set(null);
    this.searchError.set('');
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
}

interface ShopActivitySearchResult {
  id: string;
  kind: 'request' | 'quotation';
  title: string;
  details: string;
  requestReference?: string;
  route: string[];
  queryParams?: { quotationId: string };
}
