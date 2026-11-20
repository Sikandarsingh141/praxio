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
import { TableScrollIndicatorsDirective } from '../../shared/directives/table-scroll-indicators.directive';
import { CustomerQuotation, QuotationListFilters } from '../models/customer-portal.models';
import { CustomerPortalService } from '../services/customer-portal.service';
import { AdminPageHeaderComponent } from '../../shared/components/page-header/admin-page-header.component';
import { ToastService } from '../../core/toast/toast.service';
import { getCustomerUploadedPhoto } from '../../shared/utils/appliance-thumbnail.util';

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
    TableScrollIndicatorsDirective,
  ],
  template: `
    <section class="page customer-quotations-page" aria-labelledby="title">
      <app-admin-page-header>
        <h1 adminPageTitle class="admin-page-title" id="title">My Quotations</h1>
        <p adminPageDescription class="admin-page-description">
          Review and compare shop estimates before choosing a repair partner.
        </p>
      </app-admin-page-header>

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
        <section class="quotation-table-card" aria-label="My quotations">
          <div class="quotation-table-scroll" appTableScrollIndicators>
            <table class="quotation-table">
              <thead>
                <tr>
                  <th scope="col">Request ID</th>
                  <th scope="col">Device &amp; Issue</th>
                  <th scope="col">Repair Shop</th>
                  <th scope="col">Quotation</th>
                  <th scope="col">Repair Status</th>
                  <th scope="col">Quote Status</th>
                  <th scope="col" class="quotation-action-heading">Action</th>
                </tr>
              </thead>
              <tbody>
                @for (quote of quotations(); track quote._id) {
                <tr>
                  <td class="quote-request-id-cell">
                    <a
                      class="quote-request-id"
                      [routerLink]="['/customer/repair-requests', quote.repairRequest._id]"
                      [attr.aria-label]="
                        'View request ' + quote.repairRequestId.slice(-8).toUpperCase() + ' details'
                      "
                    >
                      #{{ quote.repairRequestId.slice(-8).toUpperCase() }}
                    </a>
                  </td>
                  <td class="quote-device-cell">
                    <div class="quote-device">
                      <div class="product-thumbnail-wrap">
                        @if (getCustomerPhoto(quote); as photoUrl) {
                          <img
                            class="product-thumbnail-img is-uploaded"
                            [src]="photoUrl"
                            [alt]="'Customer photo for ' + quote.repairRequest.appliance"
                            (error)="onPhotoError(quote._id)"
                            loading="lazy"
                          />
                        } @else {
                          <div class="product-thumbnail-fallback" aria-hidden="true">
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="1.8"
                            >
                              <rect x="4" y="4" width="16" height="16" rx="3" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </div>
                        }
                      </div>
                      <div class="quote-device-copy">
                        <strong>{{ quote.repairRequest.appliance }}</strong>
                        <span>
                          {{ quote.repairRequest.brand || 'Brand not provided'
                          }}{{ quote.repairRequest.model ? ' · ' + quote.repairRequest.model : '' }}
                        </span>
                        <small>{{ quote.repairRequest.description }}</small>
                      </div>
                    </div>
                  </td>
                  <td class="quote-shop-cell">
                    <div class="shop-copy">
                      <strong>{{ quote.shop.shopName }}</strong>
                      <span class="shop-address">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
                          <circle cx="12" cy="10" r="2.2" />
                        </svg>
                        {{ quote.shop.address || 'Shop address unavailable' }}
                      </span>
                      <span class="rating">
                        <span aria-hidden="true">☆</span>
                        {{
                          quote.shop.rating !== null
                            ? (quote.shop.rating | number: '1.1-1') +
                              ' (' +
                              quote.shop.reviewCount +
                              ' reviews)'
                            : 'Rating not available'
                        }}
                      </span>
                    </div>
                  </td>
                  <td class="quote-info">
                    <div class="quote-total">{{ quote.amount | currency: quote.currency }}</div>
                    <div class="details">
                      <span>
                        Inspection: {{ quote.inspectionCharge || 0 | currency: quote.currency }}
                      </span>
                      <span>Labour: {{ quote.labourCharge || 0 | currency: quote.currency }}</span>
                      <span>Parts: {{ quote.partsCost || 0 | currency: quote.currency }}</span>
                      <span>
                        Additional: {{ quote.additionalCharges || 0 | currency: quote.currency }}
                      </span>
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
                            quote.validUntil
                              ? (quote.validUntil | date: 'mediumDate')
                              : 'Not specified'
                          }}</span
                        >
                      </div>
                    </details>
                  </td>
                  <td class="repair-status-cell">
                    @if (quote.status === 'accepted') {
                      <span class="repair-active-badge">
                        {{ repairStatusLabel(quote.repairRequest) }}
                      </span>
                      <a [routerLink]="['/customer/repair-requests', quote.repairRequest._id]">
                        Repair status
                      </a>
                    } @else {
                      <span class="status-unavailable">—</span>
                          }
                  </td>
                  <td class="quote-status-cell">
                    <span
                      class="badge"
                      [attr.data-status]="quote.status === 'declined' ? 'rejected' : quote.status"
                    >
                      {{ quotationStatusLabel(quote.status) }}
                    </span>
                    @if (quote.rejectionReason) {
                      <small class="reason">Response: {{ quote.rejectionReason }}</small>
                    }
                  </td>
                  <td class="quotation-actions-cell">
                    <a
                      class="view-details"
                      [routerLink]="['/customer/repair-requests', quote.repairRequest._id]"
                    >
                      View details
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
                  </td>
                </tr>
          }
              </tbody>
            </table>
          </div>
          <app-pagination
            variant="brand"
            [total]="total()"
            [page]="page()"
            [pageSize]="limit()"
            [disabled]="loading()"
            ariaLabel="Customer quotations pages"
            (pageChange)="changePage($event)"
            (pageSizeChange)="changePageSize($event)"
          />
        </section>
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
    .quotation-table-card { overflow: hidden; display: flex; min-width: 0; flex-direction: column; border: 1px solid #e2e8e4; border-radius: 0.85rem; background: #fff; box-shadow: 0 2px 8px rgb(20 40 28 / 5%); }
    .quotation-table-scroll { width: 100%; min-width: 0; overflow-x: auto; }
    .quotation-table { width: 100%; min-width: 1250px; border-collapse: collapse; text-align: left; }
    .quotation-table thead { background: #edf8ef; }
    .quotation-table th { padding: 0.8rem 0.7rem; border-bottom: 1px solid #e2e8e4; color: #173c26; font-size: 0.73rem; font-weight: 750; white-space: nowrap; }
    .quotation-table td { padding: 0.75rem 0.7rem; border-bottom: 1px solid #edf1ed; color: #33443a; font-size: 0.79rem; vertical-align: middle; }
    .quotation-table tbody tr:last-child td { border-bottom: 0; }
    .quotation-table tbody tr:hover { background: #fbfdfb; }
    .quote-request-id-cell { min-width: 7rem; white-space: nowrap; }
    .quote-request-id { color: #087c3b; font-size: 0.78rem; font-weight: 800; text-decoration: none; }
    .quote-request-id:focus-visible { border-radius: 0.15rem; outline: 2px solid #087c3b; outline-offset: 2px; }
    .quote-device-cell { min-width: 15rem; max-width: 18rem; }
    .quote-device { display: inline-flex; min-width: 0; align-items: center; gap: 0.65rem; }
    .product-thumbnail-wrap {
      position: relative;
      width: 2.75rem;
      height: 2.75rem;
      flex: 0 0 auto;
      border: 1px solid #e2e8e4;
      border-radius: 0.55rem;
      background: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .product-thumbnail-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      border-radius: 0.5rem;
    }
    .product-thumbnail-fallback {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #e8f7eb;
      color: #078132;
    }
    .product-thumbnail-fallback svg {
      width: 2rem;
      height: 2rem;
    }
    .quote-device-copy { display: grid; min-width: 0; gap: 0.12rem; }
    .quote-device-copy strong { overflow: hidden; color: #0f172a; font-size: 0.8rem; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
    .quote-device-copy span, .quote-device-copy small { overflow: hidden; color: #64748b; font-size: 0.68rem; text-overflow: ellipsis; white-space: nowrap; }
    .quote-shop-cell { min-width: 13rem; max-width: 17rem; }
    .shop-copy { display: grid; min-width: 0; gap: 0.3rem; }
    .shop-copy > strong { overflow: hidden; color: #0f172a; font-size: 0.8rem; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
    .shop-address, .rating { display: flex; align-items: flex-start; gap: 0.35rem; margin: 0; color: #68756d; font-size: 0.68rem; line-height: 1.4; }
    .shop-address svg { width: 0.95rem; height: 0.95rem; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.7; }
    .rating span { color: #b18419; font-size: 1rem; line-height: 0.9; }
    .quote-info { min-width: 17rem; max-width: 22rem; }
    .quote-total { color: #17643b; font-size: 1.2rem; font-weight: 800; letter-spacing: -0.03em; white-space: nowrap; }
    .details { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.25rem 0.55rem; padding: 0.3rem 0 0.15rem; color: #536057; font-size: 0.68rem; }
    .details span { white-space: nowrap; }
    .more-details { margin-top: 0.35rem; color: #68756d; font-size: 0.72rem; }
    .more-details summary { width: fit-content; color: #315d4b; cursor: pointer; font-weight: 650; }
    .more-details p { margin: 0.45rem 0; line-height: 1.45; }
    .quote-meta { display: flex; flex-wrap: wrap; gap: 0.35rem 0.8rem; padding-top: 0.4rem; border-top: 1px solid #edf1ed; color: #77867c; font-size: 0.68rem; }
    .repair-status-cell { min-width: 9rem; }
    .repair-status-cell > a { display: block; margin-top: 0.35rem; color: #315d4b; font-size: 0.72rem; font-weight: 700; text-decoration: none; }
    .repair-status-cell > a:hover { text-decoration: underline; }
    .status-unavailable { color: #94a3b8; }
    .quote-status-cell { min-width: 8rem; }
    .reason { display: block; max-width: 10rem; margin-top: 0.35rem; color: #a34842; font-size: 0.68rem; }
    .quotation-action-heading, .quotation-actions-cell { min-width: 9rem; text-align: right; }
    .quotation-actions-cell { min-width: 10rem; }
    .view-details { display: inline-flex; min-height: 2rem; align-items: center; justify-content: center; gap: 0.6rem; padding: 0.4rem 0.6rem; border: 1px solid #d4dfd7; border-radius: 0.65rem; color: #17643b; font-size: 0.72rem; font-weight: 700; text-decoration: none; white-space: nowrap; }
    .view-details:hover { background: #f1f8f3; }
    .actions { display: flex; flex-direction: column; align-items: flex-end; gap: 0.35rem; margin-top: 0.4rem; }
    .actions button { min-height: 2rem; padding: 0.4rem 0.6rem; border: 1px solid transparent; border-radius: 0.55rem; cursor: pointer; font: inherit; font-size: 0.68rem; font-weight: 650; }
    .accept { background: #087c3b; color: #fff; }
    .reject { border-color: #f0dfdc !important; background: #fff0ee; color: #a34842; }
    .compare-button { border-color: #e2e8e2 !important; background: #eff5ef; color: #405447; }
    @media (max-width: 900px) {
      .summary { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    @media (max-width: 700px) {
      .summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .filters { flex-wrap: wrap; }
      .search-control { flex-basis: 100%; }
      .sort-control { flex: 1; }
    }
    @media (max-width: 430px) {
      .summary { gap: 0.45rem; }
      .summary article { gap: 0.5rem; padding: 0.55rem; }
      .summary-icon { width: 2.2rem; height: 2.2rem; }
      .summary-icon svg { width: 1.2rem; height: 1.2rem; }
      .summary-copy span { font-size: 0.65rem; }
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
  readonly limit = signal(10);
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
    private readonly toastService: ToastService,
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
  changePageSize(size: number): void {
    if (![5, 10, 25, 100].includes(size) || size === this.limit()) return;
    this.limit.set(size);
    this.page.set(1);
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
          const msg =
            pending.status === 'accepted'
              ? 'Quotation accepted. This shop has been selected for your repair request.'
              : 'Quotation response saved.';
          this.toastService.success('Quotation Updated', msg);
          this.response.set(null);
          this.responding.set(false);
          this.clearCompare();
          this.load();
        },
        error: (error: HttpErrorResponse) => {
          const msg = error.error?.message || 'Quotation response could not be saved.';
          this.responseError.set(msg);
          this.toastService.error('Action Failed', msg);
          this.responding.set(false);
        },
      });
  }

  private readonly failedPhotoIds = new Set<string>();

  getCustomerPhoto(quote: CustomerQuotation): string | null {
    if (this.failedPhotoIds.has(quote._id)) {
      return null;
    }
    return getCustomerUploadedPhoto(quote.repairRequest);
  }

  onPhotoError(quoteId: string): void {
    this.failedPhotoIds.add(quoteId);
  }
}
