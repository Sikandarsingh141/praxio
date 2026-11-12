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
import { CustomerQuotation, QuotationListFilters } from './customer-portal.models';
import { CustomerPortalService } from './customer-portal.service';
import { AdminPageHeaderComponent } from '../admin/admin-page-header.component';

type QuotationStatus = NonNullable<QuotationListFilters['status']>;
type SummaryKey = 'total' | 'pending' | 'accepted' | 'rejected' | 'expired' | 'withdrawn';

@Component({
  selector: 'app-customer-quotations-page',
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
    <section class="page customer-quotations-page" aria-labelledby="title">
      <app-admin-page-header>
        <h1 adminPageTitle class="admin-page-title" id="title">My Quotations</h1>
        <p adminPageDescription class="admin-page-description">
          Review and compare shop estimates before choosing a repair partner.
        </p>
      </app-admin-page-header>
      @if (responseSuccess()) {
        <p class="success-message" role="status" aria-live="polite">{{ responseSuccess() }}</p>
      }

      <div class="summary" aria-label="Quotation summary">
        @for (item of summaryItems; track item.status) {
          <article [attr.data-tone]="item.status">
            <span class="summary-icon" aria-hidden="true">
              @switch (item.status) {
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
              <strong>{{ summary()[item.status] }}</strong>
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
            {{ tab.label }} <span>({{ summary()[tab.count] }})</span>
          </button>
        }
      </nav>
      <form class="filters" (ngSubmit)="applyFilters()">
        <label class="search-control">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.8" cy="10.8" r="6.3" />
            <path d="m16 16 4 4" />
          </svg>
          <span class="visually-hidden">Search quotations</span>
          <input
            name="search"
            placeholder="Search by shop name, device, or request ID..."
            [(ngModel)]="search"
          />
        </label>
        <label class="sort-control">
          <span class="visually-hidden">Sort quotations</span>
          <select name="sort" [(ngModel)]="sort">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="amount_low">Amount: low to high</option>
            <option value="amount_high">Amount: high to low</option>
          </select>
          <span aria-hidden="true">⌄</span>
        </label>
        <app-common-filter
          [config]="filterConfig"
          [appliedFilters]="appliedFilters()"
          (filtersChange)="applyCommonFilters($event)"
        />
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
          <p>Quotes from shops will appear here.</p>
        </div>
      } @else {
        @if (compareQuotes().length > 1) {
          <section class="compare" aria-label="Compare selected quotations">
            <header>
              <h2>Compare quotations for {{ compareQuotes()[0].repairRequest.appliance }}</h2>
              <button type="button" (click)="clearCompare()">Clear comparison</button>
            </header>
            <div class="compare-grid">
              @for (quote of compareQuotes(); track quote._id) {
                <article>
                  <strong>{{ quote.shop.shopName }}</strong>
                  <span>{{ quote.amount | currency: quote.currency }}</span>
                  <small>Labour {{ quote.labourCharge || 0 | currency: quote.currency }}</small>
                  <small>Parts {{ quote.partsCost || 0 | currency: quote.currency }}</small>
                  <small
                    >Additional {{ quote.additionalCharges || 0 | currency: quote.currency }}</small
                  >
                  <small
                    >{{ quote.estimatedDays ?? '—' }} days ·
                    {{ quote.warrantyInformation || 'No warranty specified' }}</small
                  >
                  <small
                    >Rating not available · Valid until
                    {{
                      quote.validUntil ? (quote.validUntil | date: 'mediumDate') : 'not specified'
                    }}</small
                  >
                </article>
              }
            </div>
          </section>
        }
        <div class="list">
          @for (quote of quotations(); track quote._id) {
            <article class="card">
              <section class="shop-info" aria-label="Repair shop">
                <div class="device-placeholder" aria-hidden="true">
                  <svg viewBox="0 0 48 48">
                    <rect x="12" y="5" width="24" height="38" rx="3" />
                    <path d="M12 17h24m-18-7v3m0 9v15m12-15v15" />
                  </svg>
                </div>
                <div class="shop-copy">
                  <span class="eyebrow"
                    >REQUEST #{{ quote.repairRequestId.slice(-8).toUpperCase() }}</span
                  >
                  <h2>{{ quote.shop.shopName }}</h2>
                  <p class="shop-address">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
                      <circle cx="12" cy="10" r="2.2" />
                    </svg>
                    {{ quote.shop.address || 'Shop address unavailable' }}
                  </p>
                  <p class="rating">
                    <span aria-hidden="true">☆</span>
                    {{
                      quote.shop.rating !== null
                        ? (quote.shop.rating | number: '1.1-1') +
                          ' (' +
                          quote.shop.reviewCount +
                          ' reviews)'
                        : 'Rating not available'
                    }}
                  </p>
                </div>
              </section>

              <section class="quote-info" aria-label="Quotation details">
                <div class="quote-title">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="6" y="3" width="12" height="18" rx="2" />
                    <path d="M6 9h12m-8-3v1m0 5v2m4-2v2" />
                  </svg>
                  <strong>
                    {{ quote.repairRequest.appliance
                    }}{{ quote.repairRequest.brand ? ' · ' + quote.repairRequest.brand : ''
                    }}{{ quote.repairRequest.model ? ' (' + quote.repairRequest.model + ')' : '' }}
                  </strong>
                </div>
                <p class="issue"><strong>Issue:</strong> {{ quote.repairRequest.description }}</p>
                <div class="quote-total">{{ quote.amount | currency: quote.currency }}</div>
                <div class="details">
                  <span>Inspection: {{ quote.inspectionCharge || 0 | currency: quote.currency }}</span>
                  <span>Labour: {{ quote.labourCharge || 0 | currency: quote.currency }}</span>
                  <span>Parts: {{ quote.partsCost || 0 | currency: quote.currency }}</span>
                  <span
                    >Additional: {{ quote.additionalCharges || 0 | currency: quote.currency }}</span
                  >
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
                  <div class="quote-meta">
                    <span>Submitted {{ quote.createdAt | date: 'mediumDate' }}</span>
                    <span>Completion {{ quote.estimatedDays ?? '—' }} days</span>
                    <span
                      >Valid until
                      {{
                        quote.validUntil ? (quote.validUntil | date: 'mediumDate') : 'Not specified'
                      }}</span
                    >
                  </div>
                </details>
                @if (quote.status === 'accepted') {
                  <div class="repair-active-row">
                    <span class="repair-active-badge">
                      {{ repairStatusLabel(quote.repairRequest) }}
                    </span>
                    <a [routerLink]="['/customer/repair-requests', quote.repairRequest._id]">
                      Repair status
                    </a>
                  </div>
                }
                @if (quote.rejectionReason) {
                  <p class="reason">Response: {{ quote.rejectionReason }}</p>
                }
              </section>

              <aside class="card-actions">
                <span
                  class="badge"
                  [attr.data-status]="quote.status === 'declined' ? 'rejected' : quote.status"
                >
                  {{ quotationStatusLabel(quote.status) }}
                </span>
                <a
                  class="view-details"
                  [routerLink]="['/customer/repair-requests', quote.repairRequest._id]"
                >
                  View details
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m9 5 7 7-7 7" />
                  </svg>
                </a>
                @if (quote.status === 'pending') {
                  <div class="actions">
                    <button
                      type="button"
                      class="compare-button"
                      (click)="toggleCompare(quote)"
                    >
                      {{ isCompared(quote) ? 'Remove comparison' : 'Compare' }}
                    </button>
                    <button
                      type="button"
                      class="accept"
                      (click)="prepareResponse(quote, 'accepted')"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      class="reject"
                      (click)="prepareResponse(quote, 'declined')"
                    >
                      Reject
                    </button>
                  </div>
                }
              </aside>
            </article>
          }
        </div>
        <app-pagination
          [total]="total()"
          [page]="page()"
          [pageSize]="limit"
          [disabled]="loading()"
          ariaLabel="Customer quotations pages"
          (pageChange)="changePage($event)"
        />
      }

      @if (response(); as pending) {
        <div class="backdrop" role="presentation">
          <section
            class="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="response-title"
            [attr.aria-busy]="responding()"
          >
            <h2 id="response-title">
              {{ pending.status === 'accepted' ? 'Accept this quotation?' : 'Reject quotation?' }}
            </h2>
            <p class="response-quote-summary">
              {{ pending.quote.shop.shopName }} ·
              {{ pending.quote.amount | currency: pending.quote.currency }}
            </p>
            @if (pending.status === 'declined') {
              <label
                >Reason (optional)<textarea
                  [ngModel]="rejectionReason()"
                  (ngModelChange)="rejectionReason.set($event)"
                  name="rejectionReason"
                  maxlength="500"
                ></textarea>
              </label>
            } @else {
              <p class="accept-explanation">
                Accepting this quotation selects {{ pending.quote.shop.shopName }} for this repair
                request. Other pending quotations for the same request will become unavailable.
              </p>
            }
            @if (responseError()) {
              <p class="error" role="alert">{{ responseError() }}</p>
            }
            <div class="actions">
              <button
                type="button"
                class="cancel"
                [disabled]="responding()"
                (click)="response.set(null)"
              >
                Cancel
              </button>
              <button
                type="button"
                class="accept"
                [disabled]="responding()"
                (click)="submitResponse()"
              >
                @if (responding()) {
                  <span class="loading-indicator" aria-hidden="true"></span>
                  {{ pending.status === 'accepted' ? 'Accepting…' : 'Saving…' }}
                } @else {
                  {{ pending.status === 'accepted' ? 'Yes, Accept Quotation' : 'Confirm rejection' }}
                }
              </button>
            </div>
          </section>
        </div>
      }
    </section>
  `,
  styles: `
    .page { max-width: 1320px; margin: 0 auto; color: #18221d; }
    .eyebrow { color: #17643b; font-size: 0.68rem; font-weight: 780; letter-spacing: 0.12em; }
    .summary { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.75rem; margin: 1.25rem 0; }
    .summary article, .card { border: 1px solid #e1e6e3; border-radius: 0.95rem; background: #fff; }
    .summary article { display: flex; min-width: 0; align-items: center; gap: 0.8rem; padding: 0.7rem 0.8rem; background: #f9fbf9; }
    .summary article[data-tone='total'], .summary article[data-tone='accepted'] { border-color: #d7ecdd; background: #f8fcf9; }
    .summary article[data-tone='pending'] { border-color: #f5e8c8; background: #fffdf8; }
    .summary article[data-tone='rejected'] { border-color: #f3d9d9; background: #fffafa; }
    .summary article[data-tone='expired'] { border-color: #e2e5e3; }
    .summary-icon { display: grid; width: 2.8rem; height: 2.8rem; flex: 0 0 auto; place-items: center; border-radius: 0.8rem; background: #e0f6e5; color: #16803c; }
    .summary article[data-tone='pending'] .summary-icon { background: #fff2cc; color: #bc8500; }
    .summary article[data-tone='rejected'] .summary-icon { background: #ffe3e1; color: #bd302b; }
    .summary article[data-tone='expired'] .summary-icon { background: #eef0ef; color: #48534d; }
    .summary-icon svg { width: 1.5rem; height: 1.5rem; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.8; }
    .summary-copy { display: grid; min-width: 0; gap: 0.1rem; }
    .summary-copy span { color: #536057; font-size: 0.72rem; }
    .summary-copy strong { color: #151d18; font-size: 1.25rem; line-height: 1.1; }
    .tabs { display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.45rem; border-bottom: 1px solid #e4e9e5; }
    .tabs button { min-height: 2.5rem; padding: 0.55rem 0.9rem; border: 1px solid #e2e6e3; border-radius: 999px; background: #f5f6f5; color: #28332c; cursor: pointer; font: inherit; font-size: 0.78rem; font-weight: 650; white-space: nowrap; }
    .tabs button.active { border-color: #087c3b; background: #087c3b; color: #fff; }
    .tabs span { margin-left: 0.15rem; font-size: 0.72rem; opacity: 0.82; }
    .filters { display: flex; align-items: center; gap: 0.65rem; margin: 0.9rem 0 1rem; }
    .search-control, .sort-control { display: flex; min-height: 2.65rem; align-items: center; gap: 0.55rem; padding: 0 0.75rem; border: 1px solid #dfe5e1; border-radius: 0.75rem; background: #fff; color: #526057; }
    .search-control { flex: 1 1 auto; min-width: 12rem; }
    .search-control svg { width: 1.1rem; height: 1.1rem; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-linecap: round; stroke-width: 1.8; }
    .search-control input { width: 100%; min-width: 0; padding: 0.6rem 0; border: 0; outline: 0; background: transparent; color: #28332c; font: inherit; font-size: 0.78rem; }
    .search-control input::placeholder { color: #758078; }
    .sort-control { justify-content: space-between; gap: 0.7rem; }
    .sort-control select { max-width: 9rem; border: 0; outline: 0; background: transparent; color: inherit; font: inherit; font-size: 0.76rem; font-weight: 650; cursor: pointer; appearance: none; }
    .filters app-common-filter { display: block; flex: 0 0 auto; }
    .apply-button { min-height: 2.5rem; padding: 0.55rem 0.9rem; border: 1px solid #dfe5e1; border-radius: 0.7rem; background: #fff; color: #334139; cursor: pointer; font: inherit; font-size: 0.76rem; font-weight: 650; white-space: nowrap; }
    .apply-button { border-color: #087c3b; background: #087c3b; color: #fff; }
    .list { display: grid; gap: 0.75rem; }
    .card { display: grid; grid-template-columns: minmax(15rem, 0.95fr) minmax(18rem, 1.2fr) minmax(8.5rem, auto); align-items: center; gap: 1rem; padding: 0.8rem; box-shadow: 0 1px 2px rgb(20 40 28 / 3%); }
    .shop-info { display: flex; min-width: 0; align-items: center; gap: 0.8rem; }
    .shop-copy { min-width: 0; }
    .shop-copy h2 { margin: 0.25rem 0 0.35rem; color: #1c2721; font-size: 1rem; font-weight: 750; }
    .shop-address, .rating { display: flex; align-items: flex-start; gap: 0.35rem; margin: 0.2rem 0; color: #68756d; font-size: 0.72rem; line-height: 1.4; }
    .shop-address svg { width: 0.95rem; height: 0.95rem; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.7; }
    .rating span { color: #b18419; font-size: 1rem; line-height: 0.9; }
    .quote-info { min-width: 0; padding: 0.15rem 0 0.15rem 1rem; border-left: 1px solid #e2e8e3; }
    .quote-title { display: flex; align-items: center; gap: 0.55rem; color: #202a24; font-size: 0.85rem; }
    .quote-title svg { width: 1.1rem; height: 1.1rem; flex: 0 0 auto; fill: none; stroke: #34493c; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.7; }
    .issue { margin: 0.45rem 0; color: #5f6c63; font-size: 0.76rem; }
    .quote-total { color: #17643b; font-size: 1.35rem; font-weight: 800; letter-spacing: -0.03em; }
    .details { display: flex; flex-wrap: wrap; gap: 0.35rem 0.8rem; padding: 0.3rem 0 0.15rem; color: #536057; font-size: 0.7rem; }
    .more-details { margin-top: 0.35rem; color: #68756d; font-size: 0.72rem; }
    .more-details summary { width: fit-content; color: #315d4b; cursor: pointer; font-weight: 650; }
    .more-details p { margin: 0.45rem 0; line-height: 1.45; }
    .quote-meta { display: flex; flex-wrap: wrap; gap: 0.35rem 0.8rem; padding-top: 0.4rem; border-top: 1px solid #edf1ed; color: #77867c; font-size: 0.68rem; }
    .card-actions { display: flex; min-width: 8rem; flex-direction: column; align-items: flex-end; justify-content: center; gap: 0.65rem; }
    .view-details { display: inline-flex; min-height: 2.4rem; align-items: center; justify-content: space-between; gap: 0.6rem; padding: 0.5rem 0.7rem; border: 1px solid #d4dfd7; border-radius: 0.65rem; color: #17643b; font-size: 0.74rem; font-weight: 700; text-decoration: none; white-space: nowrap; }
    .view-details:hover { background: #f1f8f3; }
    .view-details svg { width: 1rem; height: 1rem; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2; }
    .actions { display: flex; flex-direction: column; flex-wrap: wrap; gap: 0.35rem; }
    .actions button { min-height: 2rem; padding: 0.4rem 0.6rem; border: 1px solid transparent; border-radius: 0.55rem; cursor: pointer; font: inherit; font-size: 0.68rem; font-weight: 650; }
    .accept { background: #087c3b; color: #fff; }
    .reject { border-color: #f0dfdc !important; background: #fff0ee; color: #a34842; }
    .compare-button { border-color: #e2e8e2 !important; background: #eff5ef; color: #405447; }
    @media (max-width: 900px) {
      .summary { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .card { grid-template-columns: minmax(13rem, 0.8fr) minmax(16rem, 1.2fr); }
      .card-actions { grid-column: 1 / -1; flex-direction: row; align-items: center; justify-content: flex-end; }
      .actions { flex-direction: row; }
    }
    @media (max-width: 700px) {
      .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .filters { flex-wrap: wrap; }
      .search-control { flex-basis: 100%; }
      .sort-control { flex: 1; }
      .card { grid-template-columns: minmax(0, 1fr) auto; gap: 0.7rem; }
      .shop-info, .quote-info { grid-column: 1 / -1; }
      .quote-info { padding: 0.75rem 0 0; border-top: 1px solid #e2e8e3; border-left: 0; }
      .device-placeholder { width: 4.5rem; height: 4.5rem; }
      .device-placeholder svg { width: 2.4rem; height: 2.4rem; }
      .card-actions { grid-column: 1 / -1; width: 100%; flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: space-between; }
      .actions { flex-direction: row; flex-wrap: wrap; }
    }
    @media (max-width: 430px) {
      .summary { gap: 0.45rem; }
      .summary article { gap: 0.5rem; padding: 0.55rem; }
      .summary-icon { width: 2.2rem; height: 2.2rem; }
      .summary-icon svg { width: 1.2rem; height: 1.2rem; }
      .summary-copy span { font-size: 0.65rem; }
      .card { padding: 0.65rem; }
      .shop-info { gap: 0.6rem; }
      .shop-copy h2 { font-size: 0.9rem; }
    }
  `,
})
export class CustomerQuotationsPage implements OnInit, OnDestroy {
  readonly tabs: Array<{ label: string; status: QuotationStatus; count: SummaryKey }> = [
    { label: 'All', status: 'all', count: 'total' },
    { label: 'Pending', status: 'pending', count: 'pending' },
    { label: 'Accepted', status: 'accepted', count: 'accepted' },
    { label: 'Rejected', status: 'rejected', count: 'rejected' },
    { label: 'Expired', status: 'expired', count: 'expired' },
  ];
  readonly summaryItems: Array<{ label: string; status: SummaryKey }> = [
    { label: 'Total quotations', status: 'total' },
    { label: 'Pending responses', status: 'pending' },
    { label: 'Accepted', status: 'accepted' },
    { label: 'Rejected', status: 'rejected' },
    { label: 'Expired', status: 'expired' },
  ];
  readonly quotations = signal<CustomerQuotation[]>([]);
  readonly summary = signal({
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
  readonly limit = 5;
  readonly total = signal(0);
  readonly compareQuotes = signal<CustomerQuotation[]>([]);
  readonly response = signal<{ quote: CustomerQuotation; status: 'accepted' | 'declined' } | null>(
    null,
  );
  readonly responseSuccess = signal('');
  readonly rejectionReason = signal('');
  readonly responding = signal(false);
  readonly responseError = signal('');
  readonly appliedFilters = signal<FilterValues>({});
  readonly filterConfig: FilterConfig = {
    title: 'Quotation filters',
    fields: [
      { key: 'appliance', label: 'Repair category or device', type: 'text' },
      { key: 'shop', label: 'Repair shop', type: 'text' },
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
  private extraFilters: Partial<QuotationListFilters> = {};
  search = '';
  sort: NonNullable<QuotationListFilters['sort']> = 'newest';
  private readonly realtimeSubscription: Subscription;

  constructor(
    private readonly portal: CustomerPortalService,
    private readonly route: ActivatedRoute,
    realtime: NotificationRealtimeService,
  ) {
    this.realtimeSubscription = realtime.notifications$.subscribe((notification) => {
      if (notification.type === 'new_repair_quotation') {
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
    this.portal
      .getQuotations({
        quotationId: this.route.snapshot.queryParamMap.get('quotationId') ?? undefined,
        status: this.status(),
        search: this.search,
        ...this.extraFilters,
        sort: this.sort,
        page: this.page(),
        limit: this.limit,
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
  quotationStatusLabel(status: CustomerQuotation['status']): string {
    return status === 'declined' ? 'Rejected' : status;
  }
  repairStatusLabel(request: CustomerQuotation['repairRequest']): string {
    if (request.status === 'cancelled') return 'Repair Cancelled';
    if (request.status === 'completed' || request.repairJob?.status === 'completed') {
      return 'Repair Completed';
    }
    if (request.repairJob?.status === 'repair_declined') return 'Repair Declined';
    if (request.repairJob?.status === 'disputed') return 'Repair Disputed';
    if (request.repairJob?.status === 'ready_for_pickup') return 'Ready for Pickup';
    if (request.repairJob?.status === 'picked_up') return 'Picked Up';
    if (request.repairJob?.status === 'repair_completed') return 'Repair Completed · Pickup Pending';
    return 'Repair Active';
  }
  applyFilters(): void {
    this.page.set(1);
    this.load();
  }

  applyCommonFilters(filters: FilterValues): void {
    if (JSON.stringify(this.appliedFilters()) === JSON.stringify(filters)) return;
    this.appliedFilters.set(filters);
    const submissionDate = filters['submissionDate'];
    const dateRange =
      submissionDate &&
      typeof submissionDate === 'object' &&
      ('from' in submissionDate || 'to' in submissionDate)
        ? submissionDate
        : {};
    const amount = filters['amount'];
    const amountRange =
      amount && typeof amount === 'object' && ('min' in amount || 'max' in amount)
        ? amount
        : {};
    const appliance = filters['appliance'];
    const shop = filters['shop'];
    const validity = filters['validity'];
    this.extraFilters = {
      from: dateRange.from ?? undefined,
      to: dateRange.to ?? undefined,
      appliance: typeof appliance === 'string' ? appliance.trim() || undefined : undefined,
      shop: typeof shop === 'string' ? shop.trim() || undefined : undefined,
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
  clearCompare(): void {
    this.compareQuotes.set([]);
  }

  toggleCompare(quote: CustomerQuotation): void {
    const current = this.compareQuotes();
    if (current.some((item) => item._id === quote._id)) {
      this.compareQuotes.set(current.filter((item) => item._id !== quote._id));
      return;
    }
    const sameRequest = current.filter((item) => item.repairRequestId === quote.repairRequestId);
    this.compareQuotes.set([...sameRequest, quote]);
  }

  isCompared(quote: CustomerQuotation): boolean {
    return this.compareQuotes().some((item) => item._id === quote._id);
  }

  prepareResponse(quote: CustomerQuotation, status: 'accepted' | 'declined'): void {
    this.responseSuccess.set('');
    this.responseError.set('');
    this.rejectionReason.set('');
    this.response.set({ quote, status });
  }

  submitResponse(): void {
    const pending = this.response();
    if (!pending || this.responding()) return;
    this.responding.set(true);
    this.responseError.set('');
    this.portal
      .updateQuotationStatus(pending.quote._id, pending.status, this.rejectionReason())
      .subscribe({
        next: () => {
          this.responseSuccess.set(
            pending.status === 'accepted'
              ? 'Quotation accepted. This shop has been selected for your repair request.'
              : 'Quotation response saved.',
          );
          this.response.set(null);
          this.responding.set(false);
          this.clearCompare();
          this.load();
        },
        error: (error: HttpErrorResponse) => {
          this.responseError.set(error.error?.message || 'Quotation response could not be saved.');
          this.responding.set(false);
        },
      });
  }
}
