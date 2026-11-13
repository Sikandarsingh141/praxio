import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { NotificationRealtimeService } from '../core/notifications/notification-realtime.service';
import {
  CommonFilterComponent,
  FilterConfig,
  FilterValues,
} from '../shared/common-filter.component';
import { PaginationComponent } from '../shared/pagination.component';
import { ShopQuotationFilters, ShopQuotationPage } from './shop-repair-requests.models';
import { ShopRepairRequestsService } from './shop-repair-requests.service';
import { AdminPageHeaderComponent } from '../admin/admin-page-header.component';

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
  ],
  template: `
    <section class="page shop-quotations-page" aria-labelledby="title">
      <app-admin-page-header>
        <h1 adminPageTitle class="admin-page-title" id="title">My Quotations</h1>
        <p adminPageDescription class="admin-page-description">
          Track customer responses to quotations submitted by your shop.
        </p>
        <a adminPageActions class="requests-link" routerLink="/shop/repair-requests">
          View repair requests
        </a>
      </app-admin-page-header>
      <div class="summary" aria-label="Quotation summary">
        @for (item of summaryItems; track item.key) {
          <article [attr.data-tone]="item.key">
            <span class="summary-icon" aria-hidden="true">
              @switch (item.key) {
                @case ('total') {
                  <svg viewBox="0 0 24 24">
                    <path d="M7 3h7l5 5v13H7zM14 3v6h5M10 13h6m-6 4h6" />
                  </svg>
                }
                @case ('pending') {
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                }
                @case ('accepted') {
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" />
                    <path d="m8 12 2.5 2.5L16.5 9" />
                  </svg>
                }
                @case ('rejected') {
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" />
                    <path d="m9 9 6 6m0-6-6 6" />
                  </svg>
                }
                @default {
                  <svg viewBox="0 0 24 24">
                    <rect x="4" y="5" width="16" height="15" rx="2" />
                    <path d="M8 3v4m8-4v4M4 10h16" />
                  </svg>
                }
              }
            </span>
            <span class="summary-copy">
              <span>{{ item.label }}</span>
              <strong>{{ summary()[item.key] }}</strong>
            </span>
          </article>
        }
      </div>
      <nav class="tabs" aria-label="Filter quotations by status">
        @for (tab of tabs; track tab.status) {
          <button
            type="button"
            [class.active]="status() === tab.status"
            (click)="setStatus(tab.status)"
          >
            {{ tab.label }} <span>{{ summary()[tab.count] }}</span>
          </button>
        }
      </nav>
      <form class="filters" (ngSubmit)="applyFilters()" role="search">
        <label class="search-control">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.8" cy="10.8" r="6.3" />
            <path d="m16 16 4 4" />
          </svg>
          <span class="visually-hidden">Search quotations</span>
          <input
            name="search"
            placeholder="Search customer, appliance, or request ID..."
            [(ngModel)]="search"
          />
        </label>
        <app-common-filter
          [config]="filterConfig"
          [appliedFilters]="appliedFilters()"
          (filtersChange)="applyCommonFilters($event)"
        />
        <label class="sort-control">
          <span class="visually-hidden">Sort quotations</span>
          <select aria-label="Sort quotations" name="sort" [(ngModel)]="sort">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="amount_low">Amount: low to high</option>
            <option value="amount_high">Amount: high to low</option>
          </select>
          <span aria-hidden="true">⌄</span>
        </label>
        <button class="apply-button" type="submit">Apply</button>
      </form>
      @if (error()) {
        <p class="error" role="alert">
          {{ error() }} <button type="button" (click)="load()">Retry</button>
        </p>
      }
      @if (loading()) {
        <p class="state" role="status">Loading quotations…</p>
      } @else if (!quotations().length) {
        <div class="state">
          <strong>No quotations found</strong>
          <p>Quotes you submit for repair requests will appear here.</p>
          <a routerLink="/shop/repair-requests">Browse repair requests</a>
        </div>
      } @else {
        <div class="list">
          @for (quote of quotations(); track quote._id) {
            <article class="card">
              <section class="customer-info" aria-label="Customer and repair request">
                <div class="device-placeholder" aria-hidden="true">
                  <svg viewBox="0 0 48 48">
                    <rect x="12" y="5" width="24" height="38" rx="3" />
                    <path d="M12 17h24m-18-7v3m0 9v15m12-15v15" />
                  </svg>
                </div>
                <div class="customer-copy">
                  <span class="eyebrow"
                    >REQUEST #{{ quote.repairRequestId.slice(-8).toUpperCase() }}</span
                  >
                  <h2>{{ quote.customer.displayName || (quote.customer.firstName + ' ' + quote.customer.lastName) }}</h2>
                  <p class="device-name">
                    {{ quote.repairRequest.appliance
                    }}{{ quote.repairRequest.brand ? ' · ' + quote.repairRequest.brand : ''
                    }}{{ quote.repairRequest.model ? ' (' + quote.repairRequest.model + ')' : '' }}
                  </p>
                  <p class="submitted-date">Submitted {{ quote.createdAt | date: 'mediumDate' }}</p>
                </div>
              </section>

              <section class="quote-info" aria-label="Quotation details">
                <div class="quote-total">{{ quote.amount | currency: quote.currency }}</div>
                <p class="issue"><strong>Issue:</strong> {{ quote.repairRequest.description }}</p>
                <div class="breakdown">
                  <span>Inspection {{ quote.inspectionCharge || 0 | currency: quote.currency }}</span>
                  <span>Labour {{ quote.labourCharge || 0 | currency: quote.currency }}</span>
                  <span>Parts {{ quote.partsCost || 0 | currency: quote.currency }}</span>
                  <span>Additional {{ quote.additionalCharges || 0 | currency: quote.currency }}</span>
                </div>
                <details class="more-details">
                  <summary>More quotation information</summary>
                  <p>{{ quote.message }}</p>
                  @if (quote.proposedSolution) {
                    <p><strong>Proposed solution:</strong> {{ quote.proposedSolution }}</p>
                  }
                  @if (quote.warrantyInformation) {
                    <p><strong>Warranty:</strong> {{ quote.warrantyInformation }}</p>
                  }
                  @if (quote.additionalNotes) {
                    <p><strong>Additional notes:</strong> {{ quote.additionalNotes }}</p>
                  }
                  @if (quote.rejectionReason) {
                    <p class="reason"><strong>Customer response:</strong> {{ quote.rejectionReason }}</p>
                  }
                  <div class="quote-meta">
                    <span>Estimated {{ quote.estimatedDays ?? '—' }} days</span>
                    <span>
                      Valid until
                      {{ quote.validUntil ? (quote.validUntil | date: 'mediumDate') : 'Not specified' }}
                    </span>
                  </div>
                </details>
              </section>

              <aside class="card-actions">
                <span
                  class="badge"
                  [attr.data-status]="quote.status === 'declined' ? 'rejected' : quote.status"
                >
                  {{ quotationStatusLabel(quote.status) }}
                </span>
                <a class="view-details" [routerLink]="['/shop/repair-requests', quote.repairRequestId]">
                  View repair request
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m9 5 7 7-7 7" />
                  </svg>
                </a>
              </aside>
            </article>
          }
        </div>
        <app-pagination
          [total]="total()"
          [page]="page()"
          [pageSize]="limit()"
          [disabled]="loading()"
          ariaLabel="Shop quotations pages"
          (pageChange)="changePage($event)"
          (pageSizeChange)="changePageSize($event)"
        />
      }
    </section>
  `,
  styles: `
    .page { width: 100%; max-width: none; margin: 0; color: #18221d; }
    .eyebrow { color: #17643b; font-size: 0.68rem; font-weight: 780; letter-spacing: 0.12em; }
    .requests-link { padding: 0.65rem 0.85rem; border: 1px solid #b7ddc1; border-radius: 0.65rem; color: #176b34; font-size: 0.74rem; font-weight: 700; text-decoration: none; white-space: nowrap; }
    .requests-link:hover, .view-details:hover { background: #f1f8f3; }
    .summary { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.7rem; margin: 1rem 0; }
    .summary article, .card { border: 1px solid #e1e6e3; border-radius: 0.85rem; background: #fff; }
    .summary article { display: flex; min-width: 0; align-items: center; gap: 0.7rem; padding: 0.7rem 0.8rem; box-shadow: 0 2px 6px rgb(20 40 28 / 4%); }
    .summary article[data-tone='total'], .summary article[data-tone='accepted'] { border-color: #d7ecdd; background: #fbfefb; }
    .summary article[data-tone='pending'] { border-color: #f0e5c9; background: #fffefa; }
    .summary article[data-tone='rejected'] { border-color: #f3d9d9; background: #fffafa; }
    .summary-icon { display: grid; width: 2.5rem; height: 2.5rem; flex: 0 0 auto; place-items: center; border-radius: 0.75rem; background: #e0f6e5; color: #16803c; }
    .summary article[data-tone='pending'] .summary-icon { background: #fff2cc; color: #bc8500; }
    .summary article[data-tone='rejected'] .summary-icon { background: #ffe3e1; color: #bd302b; }
    .summary article[data-tone='expired'] .summary-icon { background: #eef0ef; color: #48534d; }
    .summary-icon svg { width: 1.35rem; height: 1.35rem; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
    .summary-copy { display: grid; min-width: 0; gap: 0.1rem; }
    .summary-copy span { color: #536057; font-size: 0.68rem; line-height: 1.25; }
    .summary-copy strong { color: #151d18; font-size: 1.25rem; line-height: 1.1; }
    .tabs { display: flex; gap: 0.45rem; overflow-x: auto; padding-bottom: 0.45rem; border-bottom: 1px solid #e4e9e5; }
    .tabs button { min-height: 2.4rem; padding: 0.5rem 0.85rem; border: 1px solid #e2e6e3; border-radius: 999px; background: #f5f6f5; color: #28332c; cursor: pointer; font: inherit; font-size: 0.75rem; font-weight: 650; white-space: nowrap; }
    .tabs button.active { border-color: #087c3b; background: #087c3b; color: #fff; }
    .tabs span { margin-left: 0.15rem; font-size: 0.7rem; opacity: 0.82; }
    .filters { display: flex; align-items: center; gap: 0.6rem; margin: 0.8rem 0 0.9rem; }
    .search-control, .sort-control { display: flex; min-height: 2.55rem; align-items: center; gap: 0.5rem; padding: 0 0.7rem; border: 1px solid #dfe5e1; border-radius: 0.7rem; background: #fff; color: #526057; }
    .search-control { flex: 1 1 auto; min-width: 12rem; }
    .search-control svg { width: 1.05rem; height: 1.05rem; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-linecap: round; stroke-width: 1.8; }
    .search-control input { width: 100%; min-width: 0; padding: 0.55rem 0; border: 0; outline: 0; background: transparent; color: #28332c; font: inherit; font-size: 0.75rem; }
    .search-control input::placeholder { color: #758078; }
    .sort-control { justify-content: space-between; gap: 0.5rem; }
    .sort-control select { max-width: 9rem; border: 0; outline: 0; background: transparent; color: inherit; font: inherit; font-size: 0.73rem; font-weight: 650; cursor: pointer; appearance: none; }
    .filters app-common-filter { display: block; flex: 0 0 auto; }
    .apply-button { min-height: 2.45rem; padding: 0.5rem 0.85rem; border: 1px solid #087c3b; border-radius: 0.65rem; background: #087c3b; color: #fff; cursor: pointer; font: inherit; font-size: 0.74rem; font-weight: 700; white-space: nowrap; }
    .list { display: grid; gap: 0.7rem; }
    .card { display: grid; grid-template-columns: minmax(14rem, 0.85fr) minmax(18rem, 1.35fr) minmax(8rem, auto); align-items: center; gap: 0.9rem; padding: 0.8rem; box-shadow: 0 1px 3px rgb(20 40 28 / 3%); }
    .customer-info { display: flex; min-width: 0; align-items: center; gap: 0.75rem; }
    .device-placeholder { display: grid; width: 3.8rem; height: 3.8rem; flex: 0 0 auto; place-items: center; border-radius: 0.8rem; background: #e1f6e6; }
    .device-placeholder svg { width: 2rem; height: 2rem; fill: none; stroke: #176b34; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
    .customer-copy { min-width: 0; }
    .customer-copy h2 { overflow: hidden; margin: 0.25rem 0; color: #1c2721; font-size: 0.98rem; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
    .device-name, .submitted-date { margin: 0.2rem 0; color: #68756d; font-size: 0.7rem; line-height: 1.4; }
    .quote-info { min-width: 0; padding: 0.1rem 0 0.1rem 0.9rem; border-left: 1px solid #e2e8e3; }
    .quote-total { color: #17643b; font-size: 1.25rem; font-weight: 800; letter-spacing: -0.03em; }
    .issue { margin: 0.35rem 0; color: #5f6c63; font-size: 0.72rem; line-height: 1.4; }
    .breakdown { display: flex; flex-wrap: wrap; gap: 0.25rem 0.65rem; padding: 0.2rem 0; color: #536057; font-size: 0.67rem; }
    .more-details { margin-top: 0.35rem; color: #68756d; font-size: 0.69rem; }
    .more-details summary { width: fit-content; color: #176b34; cursor: pointer; font-weight: 650; }
    .more-details p { margin: 0.4rem 0; line-height: 1.45; }
    .quote-meta { display: flex; flex-wrap: wrap; gap: 0.3rem 0.7rem; padding-top: 0.35rem; border-top: 1px solid #edf1ed; color: #77867c; font-size: 0.66rem; }
    .reason, .error { color: #a34842; }
    .card-actions { display: flex; min-width: 0; flex-direction: column; align-items: flex-end; justify-content: center; gap: 0.6rem; }
    .badge { padding: 0.32rem 0.6rem; border-radius: 999px; background: #eff5ef; color: #536057; font-size: 0.68rem; text-transform: capitalize; white-space: nowrap; }
    .badge[data-status='accepted'] { background: #e5f6ea; color: #247044; }
    .badge[data-status='rejected'], .badge[data-status='expired'] { background: #fff0ee; color: #a34842; }
    .badge[data-status='pending'] { background: #fff4d8; color: #946600; }
    .view-details { display: inline-flex; min-height: 2.3rem; align-items: center; justify-content: space-between; gap: 0.45rem; padding: 0.45rem 0.65rem; border: 1px solid #b7ddc1; border-radius: 0.6rem; color: #17643b; font-size: 0.7rem; font-weight: 700; text-decoration: none; white-space: nowrap; }
    .view-details svg { width: 0.95rem; height: 0.95rem; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2; }
    .state { padding: 2rem; color: #77867c; text-align: center; }
    .state strong { color: #27382d; }
    .state p { margin: 0.4rem 0; font-size: 0.78rem; }
    .state a { color: #176b34; font-weight: 700; }
    .error button { margin-left: 0.3rem; border: 0; background: none; color: inherit; cursor: pointer; font: inherit; font-weight: 700; text-decoration: underline; }
    .pagination { display: flex; align-items: center; justify-content: center; gap: 0.8rem; margin: 1rem; color: #68756d; font-size: 0.72rem; }
    .pagination button { min-height: 2.2rem; padding: 0.45rem 0.7rem; border: 1px solid #dfe7df; border-radius: 0.55rem; background: #fff; color: #45634e; cursor: pointer; font: inherit; }
    .pagination button:disabled { cursor: not-allowed; opacity: 0.45; }
    .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
    @media (max-width: 1000px) {
      .summary { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .card { grid-template-columns: minmax(12rem, 0.85fr) minmax(15rem, 1.15fr); }
      .card-actions { grid-column: 1 / -1; flex-direction: row; align-items: center; justify-content: flex-end; }
    }
    @media (max-width: 700px) {
      .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .filters { flex-wrap: wrap; }
      .search-control { flex-basis: 100%; }
      .sort-control { flex: 1; }
      .card { grid-template-columns: minmax(0, 1fr) auto; gap: 0.65rem; }
      .customer-info, .quote-info { grid-column: 1 / -1; }
      .quote-info { padding: 0.7rem 0 0; border-top: 1px solid #e2e8e3; border-left: 0; }
      .device-placeholder { width: 3.2rem; height: 3.2rem; }
      .card-actions { grid-column: 1 / -1; width: 100%; flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: space-between; }
    }
    @media (max-width: 430px) {
      .summary { gap: 0.45rem; }
      .summary article { gap: 0.5rem; padding: 0.55rem; }
      .summary-icon { width: 2.1rem; height: 2.1rem; }
      .summary-icon svg { width: 1.15rem; height: 1.15rem; }
      .summary-copy span { font-size: 0.63rem; }
      .card { padding: 0.65rem; }
      .customer-info { gap: 0.55rem; }
      .customer-copy h2 { font-size: 0.9rem; }
      .pagination { gap: 0.45rem; }
    }
  `,
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
    if (![5, 10, 25, 100].includes(size) || size === this.limit()) return;
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
}
