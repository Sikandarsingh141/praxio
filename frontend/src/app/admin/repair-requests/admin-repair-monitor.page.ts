import { CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { debounceTime, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import {
  AdminDashboardOverview,
  AdminRepairJob,
  AdminRepairReview,
  AdminRepairReviewSummary,
  AdminService,
} from '../services/admin.service';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { AdminPageHeaderComponent } from '../../shared/components/page-header/admin-page-header.component';
import { ToastService } from '../../core/toast/toast.service';

type MonitorView = 'jobs' | 'completed' | 'reviews';

@Component({
  selector: 'app-admin-repair-monitor-page',
  standalone: true,
  imports: [
    AdminPageHeaderComponent,
    CurrencyPipe,
    DatePipe,
    PaginationComponent,
    RouterLink,
    TitleCasePipe,
  ],
  templateUrl: './admin-repair-monitor.page.html',
})
export class AdminRepairMonitorPage implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toastService = inject(ToastService);
  private readonly searchChanges = new Subject<string>();
  private readonly shopFilterChanges = new Subject<void>();
  private requestSequence = 0;
  readonly progressStages = ['Requested', 'Inspected', 'In Repair', 'Completed'];
  readonly view = signal<MonitorView>('jobs');
  readonly status = signal('all');
  readonly searchText = signal('');
  readonly searchLoading = signal(false);
  readonly dateRange = signal<'30d' | '90d' | 'month'>('30d');
  readonly repairItem = signal('all');
  readonly shopFilter = signal('');
  readonly fromDate = signal(this.daysAgo(29));
  readonly toDate = signal(this.today());
  readonly overview = signal<AdminDashboardOverview | null>(null);
  readonly overviewLoading = signal(true);
  readonly reviewSummary = signal<AdminRepairReviewSummary | null>(null);
  readonly reviewSummaryError = signal('');
  readonly exportMessage = signal('');
  readonly requestId = signal('');
  readonly jobs = signal<AdminRepairJob[]>([]);
  readonly reviews = signal<AdminRepairReview[]>([]);
  readonly page = signal(1);
  pageSize = 10;
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly error = signal('');
  ngOnInit(): void {
    this.searchChanges
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(1);
        this.load(true);
      });
    this.shopFilterChanges
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.page.set(1);
        this.load(true);
      });
    this.requestId.set(this.route.snapshot.queryParamMap.get('requestId') ?? '');
    const status = this.route.snapshot.queryParamMap.get('status');
    if (
      status &&
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
        'completed',
      ].includes(status)
    ) {
      this.status.set(status);
    }
    this.loadOverview();
    this.loadReviewSummary();
    this.load();
  }

  setView(view: MonitorView): void {
    if (this.view() === view) return;
    this.view.set(view);
    this.page.set(1);
    this.load();
  }

  setStatus(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const status = target.value;
    this.status.set(status);
    this.page.set(1);
    this.load();
  }

  updateSearch(value: string): void {
    this.searchText.set(value);
    this.searchLoading.set(value.trim() !== '');
    this.searchChanges.next(value.trim());
  }

  setDateRange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (target.value !== '30d' && target.value !== '90d' && target.value !== 'month') return;
    this.dateRange.set(target.value);
    const today = new Date();
    this.toDate.set(this.today());
    this.fromDate.set(
      target.value === 'month'
        ? this.dateString(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)))
        : this.daysAgo(target.value === '30d' ? 29 : 89),
    );
    this.page.set(1);
    this.loadOverview();
    this.load();
  }

  setRepairItem(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (!['all', 'computer', 'mobile', 'appliance', 'other'].includes(target.value)) return;
    this.repairItem.set(target.value);
    this.page.set(1);
    this.load();
  }

  updateShopFilter(value: string): void {
    this.shopFilter.set(value);
    this.shopFilterChanges.next();
  }

  countStatus(...statuses: string[]): number {
    const counts = this.overview()?.repairStatuses ?? [];
    return counts
      .filter((item) => statuses.includes(item.status))
      .reduce((sum, item) => sum + item.count, 0);
  }

  exportRepairs(): void {
    if (!this.jobs().length) return;
    const headers = ['Repair ID', 'Appliance', 'Description', 'Customer', 'Shop', 'Amount', 'Status', 'Created'];
    const rows = this.jobs().map((job) => [
      job._id,
      job.appliance,
      job.description,
      job.customer.displayName || `${job.customer.firstName ?? ''} ${job.customer.lastName ?? ''}`,
      job.shopName || '',
      job.quotation ? `${job.quotation.amount} ${job.quotation.currency}` : '',
      job.repairJob.status,
      job.createdAt,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `praxio-repairs-page-${this.page()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    this.toastService.success('Export Completed', `Exported ${rows.length} repair records from this page.`);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.page()) return;
    this.page.set(page);
    this.load();
  }

  changePageSize(size: number): void {
    if (![5, 10, 25, 100].includes(size) || size === this.pageSize) return;
    this.pageSize = size;
    this.page.set(1);
    this.load();
  }

  retry(): void {
    this.load();
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.total() / this.pageSize));
  }

  customerName(job: AdminRepairJob): string {
    return (
      job.customer.displayName ||
      [job.customer.firstName, job.customer.lastName].filter(Boolean).join(' ') ||
      'Customer'
    );
  }

  customerInitials(job: AdminRepairJob): string {
    return (
      this.customerName(job)
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('') || 'C'
    );
  }

  reviewInitials(name?: string): string {
    return (
      name
        ?.trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('') || 'C'
    );
  }

  repairCategory(job: AdminRepairJob): string {
    const appliance = job.appliance.toLowerCase();
    if (/laptop|notebook|desktop|computer|macbook|imac|\bpc\b/.test(appliance)) return 'Computer';
    if (/mobile|phone|smartphone|iphone|android|tablet|ipad/.test(appliance)) return 'Mobile device';
    if (/washing machine|refrigerator|fridge|fan|microwave|oven|air conditioner|\bac\b|television|\btv\b/.test(appliance)) return 'Home appliance';
    return 'Other repair';
  }

  deviceSubtitle(job: AdminRepairJob): string {
    const model = [job.brand, job.model].filter((value) => Boolean(value?.trim())).join(' ');
    return model || this.repairCategory(job);
  }

  applianceEmoji(appliance: string): string {
    const value = appliance.toLowerCase();
    if (/phone|mobile|smartphone|iphone|android|tablet|ipad/.test(value)) return '📱';
    if (/fan/.test(value)) return '🌀';
    if (/washing machine|refrigerator|fridge|microwave|oven|air conditioner|\bac\b/.test(value)) return '🔌';
    return '💻';
  }

  repairPhoto(job: AdminRepairJob): string | null {
    const photo = job.photos?.[0];
    if (!photo?.data) return null;
    return photo.data.startsWith('data:')
      ? photo.data
      : `data:${photo.mimeType};base64,${photo.data}`;
  }

  progressStage(job: AdminRepairJob): number {
    const status = job.repairJob.status;
    if (['repair_completed', 'ready_for_pickup', 'picked_up', 'completed'].includes(status)) {
      return 3;
    }
    if (['in_progress', 'on_hold'].includes(status)) return 2;
    if (
      [
        'inspection_in_progress',
        'awaiting_customer_approval',
        'inspection_approved',
        'repair_declined',
      ].includes(status)
    ) {
      return 1;
    }
    return 0;
  }

  private loadOverview(): void {
    this.overviewLoading.set(true);
    this.adminService.getDashboardOverview(this.fromDate(), this.toDate()).subscribe({
      next: (overview) => {
        this.overview.set(overview);
        this.overviewLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.message || 'Repair statistics could not be loaded.');
        this.overviewLoading.set(false);
      },
    });
  }

  private loadReviewSummary(): void {
    this.reviewSummaryError.set('');
    this.adminService.getRepairReviewSummary().subscribe({
      next: (summary) => this.reviewSummary.set(summary),
      error: (error: HttpErrorResponse) => {
        this.reviewSummaryError.set(
          error.error?.message || 'Average customer rating could not be loaded.',
        );
      },
    });
  }

  private load(searchRequest = false): void {
    const hasSearch = searchRequest || Boolean(this.searchText().trim());
    const requestSequence = ++this.requestSequence;
    this.loading.set(true);
    this.searchLoading.set(hasSearch);
    this.error.set('');
    if (this.view() !== 'reviews') {
      const completedView = this.view() === 'completed';
      this.adminService
        .getRepairJobs(
          completedView ? 'completed' : this.status(),
          this.page(),
          this.pageSize,
          this.requestId(),
          this.searchText(),
          completedView ? undefined : this.fromDate(),
          completedView ? undefined : this.toDate(),
          { silent: hasSearch },
          {
            repairItem: this.repairItem(),
            shop: this.shopFilter(),
          },
        )
        .subscribe({
          next: (result) => {
            if (requestSequence !== this.requestSequence) return;
            this.jobs.set(result.jobs ?? []);
            this.total.set(result.total);
            this.loading.set(false);
            this.searchLoading.set(false);
          },
          error: (error: HttpErrorResponse) => {
            if (requestSequence !== this.requestSequence) return;
            this.handleError(error);
            this.searchLoading.set(false);
          },
        });
      return;
    }
    this.adminService.getRepairReviews(this.page(), this.pageSize).subscribe({
      next: (result) => {
        if (requestSequence !== this.requestSequence) return;
        this.reviews.set(result.reviews ?? []);
        this.total.set(result.total);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        if (requestSequence !== this.requestSequence) return;
        this.handleError(error);
      },
    });
  }

  private handleError(error: HttpErrorResponse): void {
    this.error.set(error.error?.message || 'Repair monitoring data could not be loaded.');
    this.loading.set(false);
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
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }
}
