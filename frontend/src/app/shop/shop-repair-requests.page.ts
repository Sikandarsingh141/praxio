import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ShopRepairRequestPage, ShopRequestFilters } from './shop-repair-requests.models';
import { ShopRepairRequestsService } from './shop-repair-requests.service';
import { Subject, Subscription, finalize, takeUntil } from 'rxjs';
import { NotificationRealtimeService } from '../core/notifications/notification-realtime.service';
import {
  CommonFilterComponent,
  FilterConfig,
  FilterValues,
} from '../shared/common-filter.component';
import { PaginationComponent } from '../shared/pagination.component';

const TABS = [
  { label: 'All requests', value: 'all' },
  { label: 'New', value: 'new' },
  { label: 'Pending', value: 'pending' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Declined', value: 'declined' },
  { label: 'Expired', value: 'expired' },
] as const;

@Component({
  selector: 'app-shop-repair-requests-page',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginationComponent, RouterLink, CommonFilterComponent],
  templateUrl: './shop-repair-requests.page.html',
  styleUrl: './shop-repair-requests.page.scss',
})
export class ShopRepairRequestsPage implements OnInit, OnDestroy {
  readonly tabs = TABS;
  readonly activeTab = signal<(typeof TABS)[number]['value']>('all');
  readonly searchText = signal('');
  readonly sort = signal<'newest' | 'oldest'>('newest');
  readonly page = signal(1);
  readonly pageData = signal<ShopRepairRequestPage | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly completedRepairs = signal(false);
  readonly appliedFilters = signal<FilterValues>({});
  readonly filterConfig: FilterConfig = {
    title: 'Repair request filters',
    fields: [
      { key: 'appliance', label: 'Repair category or device', type: 'text' },
      { key: 'requestDate', label: 'Request date', type: 'date-range' },
      {
        key: 'repairStatus',
        label: 'Repair status',
        type: 'select',
        placeholder: 'Any repair status',
        options: [
          { label: 'Confirmed', value: 'confirmed' },
          { label: 'Inspection pending', value: 'inspection_pending' },
          { label: 'Inspection in progress', value: 'inspection_in_progress' },
          { label: 'Estimate awaiting approval', value: 'awaiting_customer_approval' },
          { label: 'Inspection approved', value: 'inspection_approved' },
          { label: 'Repair declined', value: 'repair_declined' },
          { label: 'In progress', value: 'in_progress' },
          { label: 'On hold', value: 'on_hold' },
          { label: 'Repair completed', value: 'repair_completed' },
          { label: 'Ready for pickup', value: 'ready_for_pickup' },
          { label: 'Picked up', value: 'picked_up' },
          { label: 'Completed', value: 'completed' },
          { label: 'Disputed', value: 'disputed' },
        ],
      },
    ],
  };
  private fromDate = '';
  private toDate = '';
  private applianceFilter = '';
  private repairStatusFilter: ShopRequestFilters['repairStatus'];
  private readonly destroyed = new Subject<void>();
  private readonly realtimeSubscription: Subscription;
  private activeLoads = 0;

  constructor(
    private readonly requestsService: ShopRepairRequestsService,
    realtime: NotificationRealtimeService,
    private readonly route: ActivatedRoute,
  ) {
    this.realtimeSubscription = realtime.notifications$.subscribe((notification) => {
      if (notification.type === 'new_repair_request') {
        this.load(true);
      }
    });
  }

  ngOnInit(): void {
    if (this.route.snapshot.data['completedOnly'] === true) {
      this.repairStatusFilter = 'completed';
      this.completedRepairs.set(true);
      this.appliedFilters.set({ repairStatus: 'completed' });
    }
    this.load();
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
    this.realtimeSubscription.unsubscribe();
  }

  load(silent = false): void {
    if (silent && this.activeLoads > 0) return;
    if (!silent || !this.pageData()) {
      this.loading.set(true);
    }
    if (!silent) {
      this.error.set('');
    }
    this.activeLoads += 1;
    this.requestsService
      .list(
        {
          status: this.activeTab(),
          search: this.searchText().trim() || undefined,
          appliance: this.applianceFilter || undefined,
          repairStatus: this.repairStatusFilter,
          from: this.fromDate || undefined,
          to: this.toDate || undefined,
          sort: this.sort(),
          page: this.page(),
          limit: 5,
        },
        { silent },
      )
      .pipe(finalize(() => (this.activeLoads -= 1)))
      .subscribe({
        next: (data) => {
          this.pageData.set(data);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.error.set(error.error?.message || 'Repair requests could not be loaded.');
          this.loading.set(false);
        },
      });
  }

  selectTab(value: (typeof TABS)[number]['value']): void {
    this.activeTab.set(value);
    this.page.set(1);
    this.load();
  }

  updateSearch(value: string): void {
    this.searchText.set(value);
    this.page.set(1);
    this.load();
  }

  applyFilters(filters: FilterValues): void {
    const effectiveFilters = this.completedRepairs()
      ? { ...filters, repairStatus: 'completed' }
      : filters;
    if (JSON.stringify(this.appliedFilters()) === JSON.stringify(effectiveFilters)) return;
    this.appliedFilters.set(effectiveFilters);
    this.applianceFilter =
      typeof effectiveFilters['appliance'] === 'string' ? effectiveFilters['appliance'].trim() : '';
    const repairStatus = effectiveFilters['repairStatus'];
    this.repairStatusFilter =
      typeof repairStatus === 'string' &&
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
        'disputed',
      ].includes(repairStatus)
        ? (repairStatus as ShopRequestFilters['repairStatus'])
        : undefined;
    const requestDate = effectiveFilters['requestDate'];
    this.fromDate =
      requestDate && typeof requestDate === 'object' && 'from' in requestDate
        ? (requestDate.from ?? '')
        : '';
    this.toDate =
      requestDate && typeof requestDate === 'object' && 'to' in requestDate
        ? (requestDate.to ?? '')
        : '';
    this.page.set(1);
    this.load();
  }

  updateSort(value: string): void {
    this.sort.set(value === 'oldest' ? 'oldest' : 'newest');
    this.load();
  }

  goToPage(page: number): void {
    const data = this.pageData();
    if (!data || page < 1 || page > Math.ceil(data.total / data.limit) || page === this.page()) {
      return;
    }
    this.page.set(page);
    this.load();
  }

  responseStatus(request: ShopRepairRequestPage['requests'][number]): string {
    const status = request.shopResponse.status;
    return status === 'quotation_submitted'
      ? 'Accepted · quotation sent'
      : status.replace('_', ' ');
  }

  location(request: ShopRepairRequestPage['requests'][number]): string {
    const coordinates = request.customer.location;
    return coordinates
      ? `${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`
      : 'Location not provided';
  }

  tabCount(
    status: (typeof TABS)[number]['value'],
    summary: ShopRepairRequestPage['summary'],
  ): number {
    if (status === 'all') return summary.total;
    if (status === 'new') return summary.new;
    if (status === 'pending') return summary.pending;
    if (status === 'accepted') return summary.accepted;
    if (status === 'declined') return summary.declined;
    return summary.expired;
  }
}
