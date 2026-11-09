import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { NotificationRealtimeService } from '../core/notifications/notification-realtime.service';
import {
  CommonFilterComponent,
  FilterConfig,
  FilterValues,
} from '../shared/common-filter.component';
import { ShopDashboardOverview } from './shop-repair-requests.models';
import { ShopRepairRequestsService } from './shop-repair-requests.service';

@Component({
  selector: 'app-shop-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink, CommonFilterComponent],
  templateUrl: './shop-dashboard.page.html',
  styleUrl: './shop-dashboard.page.scss',
})
export class ShopDashboardPage implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly repairRequests = inject(ShopRepairRequestsService);
  private readonly realtimeSubscription: Subscription;
  private refreshSubscription?: Subscription;
  readonly shopName = signal('');
  readonly errorMessage = signal('');
  readonly dashboardError = signal('');
  readonly dashboardLoading = signal(true);
  readonly dashboard = signal<ShopDashboardOverview | null>(null);
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly appliedDateFilters = signal<FilterValues>({});
  readonly dateFilterConfig: FilterConfig = {
    title: 'Dashboard filters',
    fields: [{ key: 'dateRange', label: 'Date range', type: 'date-range' }],
  };

  constructor(realtime: NotificationRealtimeService) {
    this.realtimeSubscription = realtime.notifications$.subscribe((notification) => {
      if (
        [
          'new_repair_request',
          'new_repair_quotation',
          'quotation_expired',
          'repair_request_declined',
          'customer_accepted_quotation',
          'customer_rejected_quotation',
          'repair_started',
          'repair_marked_complete',
          'repair_ready_for_pickup',
          'repair_picked_up',
          'repair_disputed',
          'repair_review_received',
          'repair_job_completed',
        ].includes(notification.type)
      ) {
        this.loadDashboard(true);
      }
    });
  }

  ngOnInit(): void {
    this.authService.getShopDashboard().subscribe({
      next: (dashboard) => this.shopName.set(dashboard.shopName),
      error: () =>
        this.errorMessage.set('Unable to verify Shop Portal access. Refresh or sign in again.'),
    });
    this.loadDashboard();
    this.refreshSubscription = interval(30_000).subscribe(() => this.loadDashboard(true));
  }

  ngOnDestroy(): void {
    this.realtimeSubscription.unsubscribe();
    this.refreshSubscription?.unsubscribe();
  }

  refreshDashboard(): void {
    this.loadDashboard();
  }

  loadDashboard(silent = false): void {
    if (!silent || !this.dashboard()) {
      this.dashboardLoading.set(true);
    }
    this.dashboardError.set('');
    this.repairRequests
      .getDashboardOverview(
        {
          from: this.dateFrom() || undefined,
          to: this.dateTo() || undefined,
        },
        { silent: silent && !!this.dashboard() },
      )
      .subscribe({
        next: (data) => {
          this.dashboard.set(data);
          this.dashboardLoading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.dashboardError.set(
            error.error?.message || 'Dashboard metrics could not be loaded.',
          );
          this.dashboardLoading.set(false);
        },
      });
  }

  applyDateFilters(filters: FilterValues): void {
    this.appliedDateFilters.set(filters);
    const dateRange = filters['dateRange'];
    const from =
      dateRange &&
      typeof dateRange === 'object' &&
      !Array.isArray(dateRange) &&
      'from' in dateRange
        ? dateRange.from
        : undefined;
    const to =
      dateRange &&
      typeof dateRange === 'object' &&
      !Array.isArray(dateRange) &&
      'to' in dateRange
        ? dateRange.to
        : undefined;
    this.dateFrom.set(typeof from === 'string' ? from : '');
    this.dateTo.set(typeof to === 'string' ? to : '');
    this.loadDashboard();
  }

  trendWidth(count: number, trend: Array<{ _id: string; count: number }>): number {
    const maximum = Math.max(...trend.map((entry) => entry.count), 1);
    return Math.max(8, (count / maximum) * 100);
  }

  quotationStatusLabel(status: string): string {
    if (status === 'sent') return 'Pending';
    if (status === 'declined') return 'Rejected';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }
}
