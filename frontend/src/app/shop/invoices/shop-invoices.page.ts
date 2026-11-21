import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { getAuthErrorMessage } from '../../core/auth/auth-error-message';
import {
  CommonFilterComponent,
  FilterConfig,
  FilterValues,
} from '../../shared/components/filters/common-filter.component';
import { JobPaginationComponent } from '../../shared/components/job-pagination/job-pagination.component';
import { AdminPageHeaderComponent } from '../../shared/components/page-header/admin-page-header.component';
import { TableScrollIndicatorsDirective } from '../../shared/directives/table-scroll-indicators.directive';
import {
  RepairInvoice,
  RepairInvoiceListFilters,
  RepairInvoicePaymentStatus,
} from '../../shared/models/repair-invoice.models';
import { RepairInvoicesService } from '../../shared/services/repair-invoices.service';
import { profileImageSource } from '../../shared/utils/appliance-thumbnail.util';

@Component({
  selector: 'app-shop-invoices-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    OverlayModule,
    AdminPageHeaderComponent,
    CommonFilterComponent,
    JobPaginationComponent,
    TableScrollIndicatorsDirective,
  ],
  template: `
    <section class="invoice-page" aria-labelledby="invoice-page-title">
      <app-admin-page-header>
        <h1 adminPageTitle class="admin-page-title" id="invoice-page-title">Invoices</h1>
        <p adminPageDescription class="admin-page-description">
          Review issued repair invoices, track balances, and download billing documents.
        </p>
        <div adminPageActions class="header-actions">
          <form class="invoice-search" (submit)="$event.preventDefault(); applySearch()">
            <label class="search-control">
              <span class="visually-hidden">Search invoices</span>
              <input
                type="search"
                placeholder="Search invoice or customer"
                [value]="search()"
                (input)="search.set($any($event.target).value)"
              />
              <button type="submit" aria-label="Search invoices">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="10.8" cy="10.8" r="6.3" />
                  <path d="m16 16 4 4" />
                </svg>
              </button>
            </label>
          </form>
          <app-common-filter
            [config]="filterConfig"
            [appliedFilters]="appliedFilters()"
            (filtersChange)="applyFilters($event)"
          />
        </div>
      </app-admin-page-header>

      @if (error()) {
        <section class="invoice-state error-state" role="alert">
          <p>{{ error() }}</p>
          <button type="button" (click)="load()">Try again</button>
        </section>
      } @else if (loading() && !invoices().length) {
        <p class="invoice-state" role="status">Loading invoices…</p>
      } @else if (invoices().length) {
        <section class="invoice-card" aria-label="Repair invoice management">
          <div class="invoice-table-wrap" appTableScrollIndicators>
            <table class="invoice-table">
              <thead>
                <tr>
                  <th scope="col">Invoice</th>
                  <th scope="col">Date</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Repair request</th>
                  <th scope="col">Total</th>
                  <th scope="col">Paid</th>
                  <th scope="col">Balance due</th>
                  <th scope="col">Payment status</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                @for (invoice of invoices(); track invoice.id) {
                  <tr>
                    <td class="invoice-number">{{ invoice.invoiceNumber || 'Draft' }}</td>
                    <td>
                      {{ invoice.invoiceDate ? (invoice.invoiceDate | date: 'mediumDate') : '—' }}
                    </td>
                    <td>
                      <div class="customer-cell">
                        @if (customerPhotoSource(invoice); as photo) {
                          @if (!imageUnavailable(invoice.id)) {
                            <img
                              class="customer-avatar"
                              [src]="photo"
                              [alt]="customerName(invoice) + ' profile photo'"
                              (error)="markImageUnavailable(invoice.id)"
                            />
                          } @else {
                            <span
                              class="customer-avatar customer-avatar-fallback"
                              aria-hidden="true"
                            >
                              {{ customerInitials(customerName(invoice)) }}
                            </span>
                          }
                        } @else {
                          <span class="customer-avatar customer-avatar-fallback" aria-hidden="true">
                            {{ customerInitials(customerName(invoice)) }}
                          </span>
                        }
                        <span class="customer-name">{{ customerName(invoice) }}</span>
                      </div>
                    </td>
                    <td class="request-id">
                      #{{ invoice.repairRequestId.slice(-8).toUpperCase() }}
                    </td>
                    <td>{{ invoice.grandTotal | currency: invoice.currency }}</td>
                    <td>{{ invoice.amountPaid | currency: invoice.currency }}</td>
                    <td>{{ invoice.balanceDue | currency: invoice.currency }}</td>
                    <td>
                      <span class="payment-status" [attr.data-status]="invoice.paymentStatus">{{
                        statusLabel(invoice.paymentStatus)
                      }}</span>
                    </td>
                    <td>
                      <div class="action-menu-anchor">
                        <button
                          type="button"
                          class="action-btn-icon action-btn-more"
                          cdkOverlayOrigin
                          #invoiceMenuOrigin="cdkOverlayOrigin"
                          [attr.aria-label]="
                            'Invoice actions for ' + (invoice.invoiceNumber || 'draft')
                          "
                          [attr.aria-expanded]="openActionsInvoiceId() === invoice.id"
                          (click)="toggleActions(invoice.id)"
                          title="Invoice actions"
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="12" cy="5" r="1.5" fill="currentColor" />
                            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                            <circle cx="12" cy="19" r="1.5" fill="currentColor" />
                          </svg>
                        </button>
                        <ng-template
                          cdkConnectedOverlay
                          [cdkConnectedOverlayOrigin]="invoiceMenuOrigin"
                          [cdkConnectedOverlayOpen]="openActionsInvoiceId() === invoice.id"
                          [cdkConnectedOverlayPositions]="actionMenuPositions"
                          [cdkConnectedOverlayPush]="true"
                          (overlayOutsideClick)="closeActions()"
                        >
                          <div
                            class="job-action-menu"
                            role="group"
                            [attr.aria-label]="
                              'Actions for invoice ' + (invoice.invoiceNumber || 'draft')
                            "
                          >
                            <a
                              class="job-action-menu-link"
                              [routerLink]="['/shop/jobs/completed-jobs', invoice.repairRequestId]"
                              (click)="closeActions()"
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                              View Details
                            </a>
                            @if (
                              (invoice.invoiceStatus === 'issued' ||
                                invoice.invoiceStatus === 'cancelled') &&
                              invoice.pdfAvailable
                            ) {
                              <button
                                type="button"
                                class="job-action-menu-link menu-action-button"
                                [disabled]="downloadingId() === invoice.id"
                                (click)="downloadPdf(invoice)"
                              >
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                  <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
                                  <path d="M5 17v3h14v-3" />
                                </svg>
                                {{
                                  downloadingId() === invoice.id ? 'Downloading…' : 'Download PDF'
                                }}
                              </button>
                            }
                          </div>
                        </ng-template>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-job-pagination
            variant="brand"
            ariaLabel="Repair invoices"
            [total]="totalRows()"
            [page]="page()"
            [pageSize]="pageSize()"
            [disabled]="loading()"
            (pageChange)="setPage($event)"
            (pageSizeChange)="setPageSize($event)"
          />
        </section>
      } @else {
        <p class="invoice-state">No repair invoices match these filters.</p>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }

      .invoice-page {
        display: grid;
        gap: 0.9rem;
        min-width: 0;
      }

      .header-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        flex-wrap: wrap;
        gap: 0.55rem;
      }

      .invoice-search {
        margin: 0;
      }

      .search-control {
        position: relative;
        display: block;
        width: min(22rem, 100%);
      }

      .search-control input {
        box-sizing: border-box;
        width: 100%;
        min-height: 2.5rem;
        padding: 0.55rem 2.6rem 0.55rem 0.85rem;
        border: 1px solid #dfe7df;
        border-radius: 0.65rem;
        background: #fff;
        color: #20302b;
        font: inherit;
        font-size: 0.8rem;
      }

      .search-control input:focus-visible {
        border-color: #6fae7b;
        outline: 3px solid rgb(22 125 43 / 15%);
      }

      .search-control button {
        position: absolute;
        top: 50%;
        right: 0.35rem;
        display: grid;
        width: 1.8rem;
        height: 1.8rem;
        transform: translateY(-50%);
        place-items: center;
        border: 0;
        border-radius: 0.4rem;
        background: transparent;
        color: #55695b;
        cursor: pointer;
      }

      .search-control button:hover {
        background: #f1f6f1;
        color: #087c3b;
      }

      .search-control svg {
        width: 1.05rem;
        height: 1.05rem;
        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-width: 1.8;
      }

      .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        clip-path: inset(50%);
      }

      .invoice-card {
        overflow: hidden;
        min-width: 0;
        border: 1px solid #e2e8e4;
        border-radius: 1rem;
        background: #fff;
        box-shadow: 0 12px 30px rgb(23 45 31 / 8%);
      }

      .invoice-table-wrap {
        width: 100%;
        overflow-x: auto;
      }

      .invoice-table {
        width: 100%;
        min-width: 1140px;
        border-collapse: separate;
        border-spacing: 0;
        background: #fff;
        text-align: left;
      }

      .invoice-table thead {
        background: #edf8ef;
      }

      .invoice-table th {
        padding: 0.9rem 0.75rem;
        border-bottom: 1px solid #e2e8e4;
        color: #173c26;
        font-size: 0.75rem;
        font-weight: 750;
        letter-spacing: 0.01em;
        white-space: nowrap;
      }

      .invoice-table th:first-child {
        border-top-left-radius: 0.75rem;
      }

      .invoice-table th:last-child {
        border-top-right-radius: 0.75rem;
      }

      .invoice-table td {
        padding: 0.85rem 0.75rem;
        border-bottom: 1px solid #edf1ed;
        color: #1e293b;
        font-size: 0.8rem;
        vertical-align: middle;
        white-space: nowrap;
      }

      .invoice-table tbody tr {
        transition: background 0.12s ease;
      }

      .invoice-table tbody tr:hover {
        background: #fbfdfb;
      }

      .invoice-table tbody tr:last-child td {
        border-bottom: 0;
      }

      .invoice-number {
        color: #087c3b !important;
        font-weight: 700;
      }

      .request-id {
        color: #087c3b !important;
        font-weight: 700;
      }

      .customer-cell {
        display: inline-flex;
        max-width: 14rem;
        align-items: center;
        gap: 0.55rem;
      }

      .invoice-table th:nth-child(3),
      .invoice-table td:nth-child(3) {
        min-width: 12rem;
      }

      .customer-avatar {
        display: grid;
        width: 2rem;
        height: 2rem;
        flex: 0 0 auto;
        place-items: center;
        overflow: hidden;
        border-radius: 50%;
        background: #e5f6e8;
        color: #12732b;
        font-size: 0.68rem;
        font-weight: 800;
        object-fit: cover;
      }

      .customer-name {
        overflow: hidden;
        color: #0f172a;
        font-size: 0.82rem;
        font-weight: 700;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .action-menu-anchor {
        display: inline-flex;
      }

      .action-btn-icon {
        display: inline-flex;
        width: 2.15rem;
        height: 2.15rem;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: 1px solid #dfe6e1;
        border-radius: 0.5rem;
        background: #fff;
        color: #334155;
        cursor: pointer;
        font: inherit;
        transition: all 0.15s ease;
      }

      .action-btn-icon svg {
        width: 1.05rem;
        height: 1.05rem;
      }

      .action-btn-icon:hover {
        border-color: #8abd94;
        background: #f2faf3;
        color: #087c3b;
      }

      .action-btn-icon:focus-visible {
        outline: 2px solid #8abd94;
        outline-offset: 1px;
      }

      .job-action-menu {
        display: grid;
        width: 10rem;
        gap: 0.1rem;
        padding: 0.35rem;
        border: 1px solid #e4e9e5;
        border-radius: 0.7rem;
        background: #fff;
        box-shadow: 0 8px 22px rgb(15 23 42 / 16%);
      }

      .job-action-menu-link {
        display: flex;
        width: 100%;
        min-height: 2.2rem;
        align-items: center;
        gap: 0.55rem;
        padding: 0.45rem 0.55rem;
        border-radius: 0.45rem;
        color: #334155;
        cursor: pointer;
        font-size: 0.78rem;
        font-weight: 650;
        text-align: left;
        text-decoration: none;
      }

      .job-action-menu-link:hover {
        background: #f5faf6;
        color: #087c3b;
      }

      .job-action-menu-link svg {
        width: 0.95rem;
        height: 0.95rem;
        flex: 0 0 auto;
        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 1.8;
      }

      .menu-action-button {
        border: 0;
        background: transparent;
        font: inherit;
      }

      .error-state button {
        min-height: 2rem;
        padding: 0.35rem 0.6rem;
        border: 1px solid #d7e3da;
        border-radius: 0.5rem;
        background: #fff;
        color: #315d42;
        font: inherit;
        font-size: 0.72rem;
        font-weight: 650;
        cursor: pointer;
      }

      .error-state button:hover {
        background: #f1f7f2;
      }

      button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .payment-status {
        display: inline-flex;
        padding: 0.25rem 0.6rem;
        border-radius: 999px;
        background: #fff5df;
        color: #8a5a18;
        font-size: 0.72rem;
        font-weight: 750;
      }

      .payment-status[data-status='PAID'] {
        background: #edf8ef;
        color: #087c3b;
      }

      .payment-status[data-status='PARTIALLY_PAID'] {
        background: #f2ecfa;
        color: #7657a4;
      }

      .invoice-state {
        margin: 0;
        padding: 1rem;
        color: #68776d;
        font-size: 0.8rem;
      }

      .error-state {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        border: 1px solid #f1d3d0;
        border-radius: 0.75rem;
        background: #fffafa;
        color: #a13830;
      }

      .error-state p {
        margin: 0;
      }

      @media (max-width: 700px) {
        .header-actions {
          width: 100%;
          justify-content: flex-start;
        }

        .invoice-search,
        .search-control {
          flex: 1 1 15rem;
          width: 100%;
        }
      }

      @media (max-width: 620px) {
        .error-state {
          align-items: flex-start;
          flex-direction: column;
        }
      }
    `,
  ],
})
export class ShopInvoicesPage {
  private readonly invoicesService = inject(RepairInvoicesService);
  private readonly unavailableImages = new Set<string>();

  readonly invoices = signal<RepairInvoice[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly totalRows = signal(0);
  readonly search = signal('');
  readonly appliedFilters = signal<FilterValues>({});
  readonly downloadingId = signal('');
  readonly filterConfig: FilterConfig = {
    title: 'Invoice filters',
    fields: [
      { key: 'invoiceDate', label: 'Invoice date', type: 'date-range' },
      {
        key: 'paymentStatus',
        label: 'Payment status',
        type: 'select',
        placeholder: 'All statuses',
        options: [
          { label: 'Unpaid', value: 'UNPAID' },
          { label: 'Partially paid', value: 'PARTIALLY_PAID' },
          { label: 'Paid', value: 'PAID' },
        ],
      },
    ],
  };
  readonly openActionsInvoiceId = signal<string | null>(null);
  readonly actionMenuPositions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
  ];

  constructor() {
    this.load();
  }

  applySearch(): void {
    this.load(1);
  }

  applyFilters(filters: FilterValues): void {
    this.appliedFilters.set(filters);
    this.load(1);
  }

  setPage(page: number): void {
    const totalPages = Math.max(1, Math.ceil(this.totalRows() / this.pageSize()));
    if (page >= 1 && page <= totalPages) this.load(page);
  }

  setPageSize(size: number): void {
    if ([5, 10, 25, 100].includes(size) && size !== this.pageSize()) {
      this.pageSize.set(size);
      this.load(1);
    }
  }

  load(page = this.page()): void {
    const appliedFilters = this.appliedFilters();
    const dateValue = appliedFilters['invoiceDate'];
    const dateRange =
      dateValue && typeof dateValue === 'object' && 'from' in dateValue ? dateValue : null;
    const statusValue = appliedFilters['paymentStatus'];
    const paymentStatus: RepairInvoicePaymentStatus | '' =
      statusValue === 'UNPAID' || statusValue === 'PARTIALLY_PAID' || statusValue === 'PAID'
        ? statusValue
        : '';
    const requestFilters: RepairInvoiceListFilters = {
      search: this.search().trim() || undefined,
      from: dateRange && typeof dateRange.from === 'string' ? dateRange.from : undefined,
      to: dateRange && typeof dateRange.to === 'string' ? dateRange.to : undefined,
      paymentStatus,
      page,
      limit: this.pageSize(),
    };
    this.loading.set(true);
    this.error.set('');
    this.invoicesService
      .listShopInvoices(requestFilters)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          this.invoices.set(result.invoices);
          this.page.set(result.page);
          this.totalRows.set(result.total);
        },
        error: (error: unknown) =>
          this.error.set(getAuthErrorMessage(error, 'Invoices could not be loaded.')),
      });
  }

  customerPhotoSource(invoice: RepairInvoice): string | null {
    if (this.unavailableImages.has(invoice.id)) return null;
    return profileImageSource(invoice.customer.profileImageUrl);
  }

  imageUnavailable(invoiceId: string): boolean {
    return this.unavailableImages.has(invoiceId);
  }

  markImageUnavailable(invoiceId: string): void {
    this.unavailableImages.add(invoiceId);
  }

  customerName(invoice: RepairInvoice): string {
    return invoice.customer.name?.trim() || invoice.customer.ownerName?.trim() || 'Customer';
  }

  customerInitials(name?: string | null): string {
    const initials = (name ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toLocaleUpperCase())
      .join('');
    return initials || 'CU';
  }

  toggleActions(invoiceId: string): void {
    this.openActionsInvoiceId.update((current) => (current === invoiceId ? null : invoiceId));
  }

  closeActions(): void {
    this.openActionsInvoiceId.set(null);
  }

  statusLabel(status: string): string {
    return status
      .replace(/_/g, ' ')
      .toLocaleLowerCase()
      .replace(/^\w/, (letter) => letter.toLocaleUpperCase());
  }

  downloadPdf(invoice: RepairInvoice): void {
    if (this.downloadingId()) return;
    this.downloadingId.set(invoice.id);
    this.error.set('');
    this.invoicesService
      .getShopInvoicePdf(invoice.id)
      .pipe(
        finalize(() => {
          this.downloadingId.set('');
          this.closeActions();
        }),
      )
      .subscribe({
        next: (pdf) => {
          const url = URL.createObjectURL(pdf);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${invoice.invoiceNumber || 'Fixora-invoice'}.pdf`;
          link.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
        error: (error: unknown) =>
          this.error.set(getAuthErrorMessage(error, 'Invoice PDF could not be downloaded.')),
      });
  }
}
