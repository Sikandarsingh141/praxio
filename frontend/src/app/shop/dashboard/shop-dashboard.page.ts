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
    if (trend.length >= 7) {
      const maxCount = Math.max(...trend.map((t) => t.count), 1);
      return trend.slice(-7).map((d, index, arr) => ({
        date: d._id,
        label: this.formatDateLabel(d._id),
        count: d.count,
        heightPercent: Math.max(8, Math.round((d.count / Math.max(maxCount, 10)) * 100)),
        isLatest: index === arr.length - 1,
      }));
    }
    const baseDate = new Date('2026-11-16T12:00:00Z');
    const defaultCounts = [1, 2, 2, 4, 5, 6, 8];
    const days: Array<{ date: string; label: string; count: number; heightPercent: number; isLatest: boolean }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(baseDate.getTime() - i * 86400000);
      const iso = d.toISOString().slice(0, 10);
      const existing = trend.find((t) => t._id === iso);
      const count = existing ? existing.count : defaultCounts[6 - i];
      days.push({
        date: iso,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
        count,
        heightPercent: Math.max(8, Math.round((count / 10) * 100)),
        isLatest: i === 0,
      });
    }
    return days;
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

  readonly fallbackRequests = [
    {
      _id: 'REQ-0821-SAM',
      appliance: 'Samsung TV',
      description: 'Display screen blank',
      createdAt: '2026-11-16T10:00:00.000Z',
      shopResponse: { status: 'new' as const },
      customer: { firstName: 'Nancy', lastName: 'Sharma' },
    },
    {
      _id: 'REQ-0820-CLR',
      appliance: 'Cooler',
      description: 'Motor not running',
      createdAt: '2026-11-16T09:30:00.000Z',
      shopResponse: { status: 'completed' as const },
      repairJob: { status: 'completed' },
      customer: { firstName: 'Nancy', lastName: 'Sharma' },
    },
    {
      _id: 'REQ-0819-HDP',
      appliance: 'HeadPhone',
      description: 'One side not working',
      createdAt: '2026-11-16T09:00:00.000Z',
      shopResponse: { status: 'completed' as const },
      repairJob: { status: 'completed' },
      customer: { firstName: 'Nancy', lastName: 'Sharma' },
    },
  ];

  readonly fallbackQuotations = [
    { _id: 'q-1', appliance: 'Cooler', customerName: 'Nancy Sharma', createdAt: '2026-11-16T12:00:00Z', amount: 100, currency: 'INR', status: 'accepted' },
    { _id: 'q-2', appliance: 'HeadPhone', customerName: 'Nancy Sharma', createdAt: '2026-11-16T12:00:00Z', amount: 50, currency: 'INR', status: 'accepted' },
    { _id: 'q-3', appliance: 'AC', customerName: 'Sikandar Customer', createdAt: '2026-11-16T12:00:00Z', amount: 100, currency: 'INR', status: 'accepted' },
    { _id: 'q-4', appliance: 'Mobile Phone', customerName: 'Sikandar Customer', createdAt: '2026-11-15T12:00:00Z', amount: 200, currency: 'INR', status: 'accepted' },
  ];

  readonly fallbackReviews: Array<{
    _id: string;
    customerName: string;
    overallRating: number;
    title?: string;
    reviewText: string;
    createdAt: string;
  }> = [
    { _id: 'r-1', customerName: 'Nancy Sharma', overallRating: 5, reviewText: 'Taking very extra charges', createdAt: '2026-11-17T10:00:00Z' },
    { _id: 'r-2', customerName: 'Nancy Sharma', overallRating: 5, reviewText: 'Good thank you', createdAt: '2026-11-16T10:00:00Z' },
    { _id: 'r-3', customerName: 'Sikandar Customer', overallRating: 5, reviewText: 'Working nice', createdAt: '2026-11-16T10:00:00Z' },
  ];

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

  customerName(request: any): string {
    const customer = request?.customer;
    if (typeof customer === 'string' && customer.trim()) return customer;
    if (customer?.displayName) return customer.displayName;
    const fullName = [customer?.firstName, customer?.lastName].filter(Boolean).join(' ').trim();
    return fullName || 'Nancy Sharma';
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
