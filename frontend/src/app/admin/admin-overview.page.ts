import { DatePipe, DecimalPipe, SlicePipe, TitleCasePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EMPTY, finalize, interval, Subject, switchMap, catchError } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../core/auth/auth.service';
import { NotificationRealtimeService } from '../core/notifications/notification-realtime.service';
import { getAuthErrorMessage } from '../core/auth/auth-error-message';
import {
  CommonFilterComponent,
  FilterConfig,
  FilterValues,
} from '../shared/common-filter.component';
import { AdminDashboardOverview, AdminService } from './admin.service';

type DashboardRange = 'today' | '7d' | '30d' | '90d' | 'month' | 'last-month' | 'year' | 'custom';

@Component({
  selector: 'app-admin-overview-page',
  standalone: true,
  imports: [CommonFilterComponent, DatePipe, DecimalPipe, RouterLink, SlicePipe, TitleCasePipe],
  templateUrl: './admin-overview.page.html',
})
export class AdminOverviewPage implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly authService = inject(AuthService);
  private readonly realtime = inject(NotificationRealtimeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refreshRequests = new Subject<boolean>();

  readonly overview = signal<AdminDashboardOverview | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly range = signal<DashboardRange>('30d');
  readonly fromDate = signal(this.daysAgo(29));
  readonly toDate = signal(this.today());
  readonly appliedFilters = signal<FilterValues>({ period: '30d' });
  readonly filterConfig: FilterConfig = {
    title: 'Dashboard filters',
    fields: [
      {
        key: 'period',
        label: 'Date range',
        type: 'select',
        defaultValue: '30d',
        options: [
          { label: 'Today', value: 'today' },
          { label: 'Last 7 days', value: '7d' },
          { label: 'Last 30 days', value: '30d' },
          { label: 'Last 90 days', value: '90d' },
          { label: 'This month', value: 'month' },
          { label: 'Last month', value: 'last-month' },
          { label: 'This year', value: 'year' },
          { label: 'Custom range', value: 'custom' },
        ],
      },
      { key: 'customRange', label: 'Custom dates', type: 'date-range' },
    ],
  };
  readonly adminName =
    [this.authService.currentUser()?.firstName, this.authService.currentUser()?.lastName]
      .filter(Boolean)
      .join(' ') || 'Administrator';

  ngOnInit(): void {
    this.refreshRequests
      .pipe(
        switchMap((silent) => {
          if (!silent || !this.overview()) {
            this.loading.set(true);
          }
          this.errorMessage.set('');
          return this.adminService
            .getDashboardOverview(this.fromDate(), this.toDate(), {
              silent: silent && !!this.overview(),
            })
            .pipe(
              catchError((error: unknown) => {
                this.errorMessage.set(
                  getAuthErrorMessage(error, 'Unable to load marketplace analytics.'),
                );
                return EMPTY;
              }),
              finalize(() => this.loading.set(false)),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((overview) => this.overview.set(overview));

    this.refresh();
    interval(60_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (document.visibilityState === 'visible') {
          this.refresh(true);
        }
      });
    this.realtime.notifications$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refresh(true));
  }

  applyDateFilters(filters: FilterValues): void {
    const rawPeriod = filters['period'];
    const period = this.isDashboardRange(rawPeriod) ? rawPeriod : '30d';
    const dates = this.getRangeDates(period, filters['customRange']);
    this.range.set(period);
    this.fromDate.set(dates.from);
    this.toDate.set(dates.to);
    this.appliedFilters.set(
      period === 'custom'
        ? { period, customRange: { from: dates.from, to: dates.to } }
        : { period },
    );
    this.refresh();
  }

  refresh(silent = false): void {
    this.refreshRequests.next(silent);
  }

  get trendMax(): number {
    const points = this.overview()?.trends ?? [];
    return Math.max(
      1,
      ...points.flatMap((point) => [point.customers, point.shops, point.repairs, point.quotations]),
    );
  }

  trendPoints(key: 'customers' | 'shops' | 'repairs' | 'quotations'): string {
    const points = this.overview()?.trends ?? [];
    if (!points.length) return '';
    const width = 600;
    const height = 180;
    return points
      .map((point, index) => {
        const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
        const y = height - (point[key] / this.trendMax) * (height - 12) - 6;
        return `${x},${y}`;
      })
      .join(' ');
  }

  percentWidth(value: number, total: number): string {
    return `${total ? Math.min(100, (value / total) * 100) : 0}%`;
  }

  repairStatusCount(overview: AdminDashboardOverview, status: string): number {
    return overview.repairStatuses.find((item) => item.status === status)?.count ?? 0;
  }

  repairStatusLabel(status: string): string {
    return status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  repairProgressCount(overview: AdminDashboardOverview): number {
    return overview.repairStatuses
      .filter((item) =>
        [
          'confirmed',
          'inspection_pending',
          'inspection_in_progress',
          'awaiting_customer_approval',
          'inspection_approved',
          'repair_declined',
          'in_progress',
          'on_hold',
          'repair_completed',
          'ready_for_pickup',
          'picked_up',
        ].includes(item.status),
      )
      .reduce((total, item) => total + item.count, 0);
  }

  repairRing(overview: AdminDashboardOverview): string {
    const open = this.repairStatusCount(overview, 'open');
    const inProgress = this.repairProgressCount(overview);
    const completed = this.repairStatusCount(overview, 'completed');
    const total = open + inProgress + completed;
    if (!total) return 'conic-gradient(#e7ece8 0 100%)';
    const openPercent = (open / total) * 100;
    const progressPercent = ((open + inProgress) / total) * 100;
    return `conic-gradient(#16803c 0 ${openPercent}%, #7acb8d ${openPercent}% ${progressPercent}%, #d9efdd ${progressPercent}% 100%)`;
  }

  trendLabel(period: string): string {
    return period.length === 7 ? period : period.slice(5);
  }

  changeLabel(change: number | null): string {
    if (change === null) return 'New activity · no previous period';
    const direction = change > 0 ? '↑' : change < 0 ? '↓' : '—';
    return `${direction} ${Math.abs(change)}% vs previous period`;
  }

  formatFinancialAmount(
    key: 'accountReceivableCents' | 'overdueAmountCents' | 'subscriptionRevenueCents',
  ): string {
    const totals = this.overview()?.subscriptionFinancials.currencyTotals ?? [];
    if (!totals.length) {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'USD',
      }).format(0);
    }

    return totals
      .map((total) =>
        new Intl.NumberFormat(undefined, {
          style: 'currency',
          currency: total.currency,
        }).format(total[key] / 100),
      )
      .join(' · ');
  }

  formatFinancialAmountForActivity(amountCents: number, currency: string): string {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(amountCents / 100);
  }

  subscriptionActivities(activities: AdminDashboardOverview['recentActivities']) {
    return activities
      .filter(
        (activity) =>
          activity.type.startsWith('subscription_') ||
          activity.type === 'shop_subscription_purchased',
      )
      .slice(0, 5);
  }

  private today(): string {
    return this.dateString(new Date());
  }

  private isDashboardRange(value: unknown): value is DashboardRange {
    return (
      typeof value === 'string' &&
      ['today', '7d', '30d', '90d', 'month', 'last-month', 'year', 'custom'].includes(value)
    );
  }

  private getRangeDates(
    range: DashboardRange,
    customRange: FilterValues['customRange'],
  ): { from: string; to: string } {
    if (range === 'custom') {
      const bounds =
        customRange &&
        typeof customRange === 'object' &&
        !Array.isArray(customRange) &&
        'from' in customRange
          ? customRange
          : {};
      const today = this.today();
      return {
        from: typeof bounds.from === 'string' && bounds.from ? bounds.from : today,
        to: typeof bounds.to === 'string' && bounds.to ? bounds.to : today,
      };
    }

    const current = new Date();
    const end = this.today();
    let start = end;
    let to = end;
    if (range === '7d') start = this.daysAgo(6);
    if (range === '30d') start = this.daysAgo(29);
    if (range === '90d') start = this.daysAgo(89);
    if (range === 'month') {
      start = this.dateString(new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1)));
    }
    if (range === 'last-month') {
      start = this.dateString(
        new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1)),
      );
      to = this.dateString(new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 0)));
    }
    if (range === 'year') start = `${current.getUTCFullYear()}-01-01`;
    return { from: start, to };
  }

  private daysAgo(days: number): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);
    return this.dateString(date);
  }

  private dateString(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
