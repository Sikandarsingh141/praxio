import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { NotificationRealtimeService } from '../../core/notifications/notification-realtime.service';
import {
  CommonFilterComponent,
  FilterConfig,
  FilterValues,
} from '../../shared/components/filters/common-filter.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { ShopQuotationFilters, ShopQuotationPage } from '../repair-requests/shop-repair-requests.models';
import { ShopRepairRequestsService } from '../repair-requests/shop-repair-requests.service';
import { AdminPageHeaderComponent } from '../../shared/components/page-header/admin-page-header.component';
import {
  getCustomerUploadedPhoto,
  profileImageSource,
} from '../../shared/utils/appliance-thumbnail.util';
import { TableScrollIndicatorsDirective } from '../../shared/directives/table-scroll-indicators.directive';

type QuotationStatus = NonNullable<ShopQuotationFilters['status']>;

@Component({
  selector: 'app-shop-quotations-page',
  standalone: true,
  imports: [
    AdminPageHeaderComponent,
    CommonModule,
    FormsModule,
    PaginationComponent,
    RouterLink,
    CommonFilterComponent,
    TableScrollIndicatorsDirective,
  ],
  templateUrl: './shop-quotations.page.html',
  styleUrl: './shop-quotations.page.scss',
})
export class ShopQuotationsPage implements OnInit, OnDestroy {
  readonly summaryItems: Array<{ label: string; key: keyof ShopQuotationPage['summary'] }> = [
    { label: 'Total quotations', key: 'total' },
    { label: 'Pending responses', key: 'pending' },
    { label: 'Accepted', key: 'accepted' },
    { label: 'Rejected', key: 'rejected' },
    { label: 'Expired', key: 'expired' },
  ];
  readonly tabs: Array<{
    label: string;
    status: QuotationStatus;
    count: keyof ShopQuotationPage['summary'];
  }> = [
    { label: 'All', status: 'all', count: 'total' },
    { label: 'Pending', status: 'pending', count: 'pending' },
    { label: 'Accepted', status: 'accepted', count: 'accepted' },
    { label: 'Rejected', status: 'rejected', count: 'rejected' },
    { label: 'Expired', status: 'expired', count: 'expired' },
  ];
  readonly quotations = signal<ShopQuotationPage['quotations']>([]);
  readonly summary = signal<ShopQuotationPage['summary']>({
    total: 0,
    pending: 0,
    accepted: 0,
    rejected: 0,
    expired: 0,
    withdrawn: 0,
  });
  readonly status = signal<QuotationStatus>('all');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly page = signal(1);
  readonly limit = signal(10);
  readonly pageSizeOptions = [5, 10, 25, 50];
  readonly total = signal(0);
  readonly appliedFilters = signal<FilterValues>({});
  readonly filterConfig: FilterConfig = {
    title: 'Quotation filters',
    fields: [
      { key: 'appliance', label: 'Repair category or device', type: 'text' },
      { key: 'amount', label: 'Quotation amount', type: 'number-range', min: 0, step: 100 },
      { key: 'submissionDate', label: 'Submission date', type: 'date-range' },
      {
        key: 'validity',
        label: 'Validity',
        type: 'select',
        placeholder: 'Any validity',
        options: [
          { label: 'Currently valid', value: 'valid' },
          { label: 'Expired', value: 'expired' },
        ],
      },
    ],
  };
  private extraFilters: Partial<ShopQuotationFilters> = {};
  search = '';
  from = '';
  to = '';
  sort: NonNullable<ShopQuotationFilters['sort']> = 'newest';
  private readonly realtimeSubscription: Subscription;

  constructor(
    private readonly service: ShopRepairRequestsService,
    private readonly route: ActivatedRoute,
    realtime: NotificationRealtimeService,
  ) {
    this.realtimeSubscription = realtime.notifications$.subscribe((notification) => {
      if (
        [
          'customer_accepted_quotation',
          'customer_rejected_quotation',
          'quotation_expired',
        ].includes(notification.type)
      ) {
        this.load();
      }
    });
  }

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.realtimeSubscription.unsubscribe();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.service
      .listQuotations({
        quotationId: this.route.snapshot.queryParamMap.get('quotationId') ?? undefined,
        status: this.status(),
        search: this.search,
        from: this.from || undefined,
        to: this.to || undefined,
        ...this.extraFilters,
        sort: this.sort,
        page: this.page(),
        limit: this.limit(),
      })
      .subscribe({
        next: (result) => {
          this.quotations.set(result.quotations);
          this.summary.set(result.summary);
          this.total.set(result.total);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.error.set(error.error?.message || 'Quotations could not be loaded.');
          this.loading.set(false);
        },
      });
  }

  setStatus(status: QuotationStatus): void {
    this.status.set(status);
    this.page.set(1);
    this.load();
  }

  applyFilters(): void {
    this.page.set(1);
    this.load();
  }

  applyCommonFilters(filters: FilterValues): void {
    if (JSON.stringify(this.appliedFilters()) === JSON.stringify(filters)) return;
    this.appliedFilters.set(filters);
    const submissionDate = filters['submissionDate'];
    this.from =
      submissionDate && typeof submissionDate === 'object' && 'from' in submissionDate
        ? submissionDate.from ?? ''
        : '';
    this.to =
      submissionDate && typeof submissionDate === 'object' && 'to' in submissionDate
        ? submissionDate.to ?? ''
        : '';
    const amount = filters['amount'];
    const amountRange =
      amount && typeof amount === 'object' && ('min' in amount || 'max' in amount)
        ? amount
        : {};
    const appliance = filters['appliance'];
    const validity = filters['validity'];
    this.extraFilters = {
      appliance: typeof appliance === 'string' ? appliance.trim() || undefined : undefined,
      minAmount: amountRange.min ?? undefined,
      maxAmount: amountRange.max ?? undefined,
      validity: validity === 'valid' || validity === 'expired' ? validity : undefined,
    };
    this.page.set(1);
    this.load();
  }

  changePage(page: number): void {
    this.page.set(page);
    this.load();
  }

  changePageSize(size: number): void {
    if (!this.pageSizeOptions.includes(size) || size === this.limit()) return;
    this.limit.set(size);
    this.page.set(1);
    this.load();
  }

  quotationStatusLabel(
    status: ShopQuotationPage['quotations'][number]['status'],
  ): string {
    if (status === 'declined') return 'Rejected';
    if (status === 'sent' || status === 'pending') return 'Pending';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  customerName(quote: ShopQuotationPage['quotations'][number]): string {
    return (
      quote.customer.displayName?.trim() ||
      `${quote.customer.firstName} ${quote.customer.lastName}`.trim() ||
      'Customer'
    );
  }

  customerInitials(quote: ShopQuotationPage['quotations'][number]): string {
    return this.customerName(quote)
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  customerPhotoSource(quote: ShopQuotationPage['quotations'][number]): string | null {
    if (this.failedCustomerPhotoIds.has(quote._id)) return null;
    return profileImageSource(quote.customer.profileImageUrl);
  }

  onCustomerPhotoError(quoteId: string): void {
    this.failedCustomerPhotoIds.add(quoteId);
  }

  private readonly failedPhotoIds = new Set<string>();
  private readonly failedCustomerPhotoIds = new Set<string>();

  getCustomerPhoto(quote: ShopQuotationPage['quotations'][number]): string | null {
    if (this.failedPhotoIds.has(quote._id)) {
      return null;
    }
    return getCustomerUploadedPhoto(quote.repairRequest);
  }

  onPhotoError(quoteId: string): void {
    this.failedPhotoIds.add(quoteId);
  }
}
