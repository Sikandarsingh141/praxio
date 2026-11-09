import { DatePipe, DecimalPipe, SlicePipe, TitleCasePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EMPTY, finalize, interval, Subject, switchMap, catchError } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../core/auth/auth.service';
import { NotificationRealtimeService } from '../core/notifications/notification-realtime.service';
import { getAuthErrorMessage } from '../core/auth/auth-error-message';
import { AdminDashboardOverview, AdminService } from './admin.service';

type DashboardRange = 'today' | '7d' | '30d' | '90d' | 'month' | 'last-month' | 'year' | 'custom';

@Component({
  selector: 'app-admin-overview-page',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink, SlicePipe, TitleCasePipe],
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
  readonly adminName = this.authService.currentUser()?.fullName || 'Administrator';

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

  selectRange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }
    const value = target.value as DashboardRange;
    if (!['today', '7d', '30d', '90d', 'month', 'last-month', 'year', 'custom'].includes(value)) {
      return;
    }
    this.range.set(value);
    if (value !== 'custom') {
      const current = new Date();
      const end = this.today();
      let start = end;
      if (value === '7d') start = this.daysAgo(6);
      if (value === '30d') start = this.daysAgo(29);
      if (value === '90d') start = this.daysAgo(89);
      if (value === 'month') {
        start = this.dateString(
          new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1)),
        );
      }
      if (value === 'last-month') {
        start = this.dateString(
          new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1)),
        );
        this.toDate.set(
          this.dateString(new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 0))),
        );
      } else {
        this.toDate.set(end);
      }
      if (value === 'year') start = `${current.getUTCFullYear()}-01-01`;
      this.fromDate.set(start);
      this.refresh();
    }
  }

  updateDate(kind: 'from' | 'to', event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.value) {
      return;
    }
    if (kind === 'from') this.fromDate.set(target.value);
    else this.toDate.set(target.value);
    this.range.set('custom');
    this.refresh();
  }

  refresh(silent = false): void {
    this.refreshRequests.next(silent);
  }

  get trendMax(): number {
    const points = this.overview()?.trends ?? [];
    return Math.max(1, ...points.flatMap((point) => [point.customers, point.shops, point.repairs, point.quotations]));
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

  private today(): string {
    return this.dateString(new Date());
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
