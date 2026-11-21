import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationRealtimeService } from '../../core/notifications/notification-realtime.service';
import {
  CommonFilterComponent,
  FilterConfig,
  FilterValues,
} from '../../shared/components/filters/common-filter.component';
import { ShopDashboardOverview } from '../repair-requests/shop-repair-requests.models';
import { ShopRepairRequestsService } from '../repair-requests/shop-repair-requests.service';
import { AdminPageHeaderComponent } from '../../shared/components/page-header/admin-page-header.component';
import { profileImageSource } from '../../shared/utils/appliance-thumbnail.util';

@Component({
  selector: 'app-shop-dashboard-page',
  standalone: true,
  imports: [AdminPageHeaderComponent, CommonModule, RouterLink, CommonFilterComponent],
  templateUrl: './shop-dashboard.page.html',
  styleUrl: './shop-dashboard.page.scss',
})
export class ShopDashboardPage implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly repairRequests = inject(ShopRepairRequestsService);
  private readonly realtimeSubscription: Subscription;
  readonly shopName = this.authService.shopName;
  readonly dashboardError = signal('');
  readonly dashboardLoading = signal(true);
  readonly dashboard = signal<ShopDashboardOverview | null>(null);
  readonly unavailableReviewAvatarIds = signal<Set<string>>(new Set());
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly appliedDateFilters = signal<FilterValues>({});
  readonly dateFilterConfig: FilterConfig = {
    title: 'Dashboard filters',
    fields: [{ key: 'dateRange', label: 'Date range', type: 'date-range' }],
  };

  readonly quotationChartData = computed(() => {
    const data = this.dashboard();
    const trend = data?.quotations.trend ?? [];
    const trendByDate = new Map(trend.map((entry) => [entry._id, entry.count]));
    const latestTrendDate = trend.reduce(
      (latest, entry) => (entry._id > latest ? entry._id : latest),
      '',
    );
    const latestDateKey =
      data?.range.to?.slice(0, 10) ||
      latestTrendDate ||
      new Date().toISOString().slice(0, 10);
    const latestDate = new Date(`${latestDateKey}T12:00:00Z`);
    const days: Array<{ date: string; label: string; count: number; isLatest: boolean }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(latestDate.getTime() - i * 86400000);
      const iso = d.toISOString().slice(0, 10);
      const count = trendByDate.get(iso) ?? 0;
      days.push({
        date: iso,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
        count,
        isLatest: i === 0,
      });
    }
    const maximum = Math.max(...days.map((day) => day.count), 0);
    const chartMaximum = Math.max(10, Math.ceil(maximum / 10) * 10);
    return days.map((day) => ({
      ...day,
      heightPercent:
        day.count === 0
          ? 0
          : Math.max(8, Math.round((day.count / chartMaximum) * 100)),
    }));
  });

  readonly quotationChartAxisLabels = computed(() => {
    const maximum = Math.max(
      ...this.quotationChartData().map((day) => day.count),
      0,
    );
    const chartMaximum = Math.max(10, Math.ceil(maximum / 10) * 10);
    return Array.from({ length: 6 }, (_, index) =>
      Math.round(chartMaximum * (1 - index / 5)),
    );
  });

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
          'repair_invoice_payment_received',
          'repair_review_received',
          'repair_job_completed',
        ].includes(notification.type)
      ) {
        this.loadDashboard(true);
      }
    });
  }

  ngOnInit(): void {
    this.loadDashboard();
  }

  ngOnDestroy(): void {
    this.realtimeSubscription.unsubscribe();
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
          this.dashboardError.set(error.error?.message || 'Dashboard metrics could not be loaded.');
          this.dashboardLoading.set(false);
        },
      });
  }

  applyDateFilters(filters: FilterValues): void {
    this.appliedDateFilters.set(filters);
    const dateRange = filters['dateRange'];
    const from =
      dateRange && typeof dateRange === 'object' && !Array.isArray(dateRange) && 'from' in dateRange
        ? dateRange.from
        : undefined;
    const to =
      dateRange && typeof dateRange === 'object' && !Array.isArray(dateRange) && 'to' in dateRange
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
    if (!status) return 'Accepted';
    if (status === 'sent') return 'Pending';
    if (status === 'declined') return 'Rejected';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  reviewPhotoSource(review: ShopDashboardOverview['reviews']['recent'][number]): string | null {
    const source = profileImageSource(review.customerProfileImageUrl);
    return source && !this.unavailableReviewAvatarIds().has(review._id) ? source : null;
  }

  onReviewPhotoError(reviewId: string): void {
    this.unavailableReviewAvatarIds.update((ids) => new Set(ids).add(reviewId));
  }

  customerName(request: any): string {
    const customer = request?.customer;
    if (typeof customer === 'string' && customer.trim()) return customer;
    if (customer?.displayName) return customer.displayName;
    const fullName = [customer?.firstName, customer?.lastName].filter(Boolean).join(' ').trim();
    return fullName || 'Customer';
  }

  deviceType(appliance?: string): string {
    const name = (appliance || '').toLowerCase();
    if (name.includes('tv') || name.includes('television')) return 'tv';
    if (name.includes('cooler')) return 'cooler';
    if (name.includes('headphone') || name.includes('audio') || name.includes('earphone')) return 'headphone';
    if (name.includes('mobile') || name.includes('phone')) return 'mobile';
    if (name.includes('ac') || name.includes('air')) return 'ac';
    if (name.includes('laptop') || name.includes('computer')) return 'laptop';
    if (name.includes('washing') || name.includes('washer')) return 'washing_machine';
    if (name.includes('refrigerator') || name.includes('fridge')) return 'refrigerator';
    return 'default';
  }

  formatDateLabel(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    } catch {
      return dateStr;
    }
  }
}
