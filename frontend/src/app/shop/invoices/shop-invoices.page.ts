import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { getAuthErrorMessage } from '../../core/auth/auth-error-message';
import { AdminPageHeaderComponent } from '../../shared/components/page-header/admin-page-header.component';
import {
  RepairInvoice,
  RepairInvoiceListFilters,
  RepairInvoicePaymentStatus,
} from '../../shared/models/repair-invoice.models';
import { RepairInvoicesService } from '../../shared/services/repair-invoices.service';

@Component({
  selector: 'app-shop-invoices-page',
  standalone: true,
  imports: [CommonModule, RouterLink, AdminPageHeaderComponent],
  template: `
    <section class="invoice-page" aria-labelledby="invoice-page-title">
      <app-admin-page-header>
        <h1 adminPageTitle class="admin-page-title" id="invoice-page-title">Invoices</h1>
        <p adminPageDescription class="admin-page-description">
          Review issued repair invoices, track balances, and download billing documents.
        </p>
      </app-admin-page-header>

      <section class="invoice-card" aria-label="Repair invoice management">
        <form class="invoice-filters" (submit)="$event.preventDefault(); applyFilters()">
          <label>
            Search invoice or customer
            <input
              type="search"
              placeholder="Invoice number or customer"
              [value]="search()"
              (input)="search.set($any($event.target).value)"
            />
          </label>
          <label>
            From
            <input type="date" [value]="from()" (input)="from.set($any($event.target).value)" />
          </label>
          <label>
            To
            <input type="date" [value]="to()" (input)="to.set($any($event.target).value)" />
          </label>
          <label>
            Payment status
            <select
              [value]="paymentStatus()"
              (change)="setPaymentStatus($any($event.target).value)"
            >
              <option value="">All statuses</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIALLY_PAID">Partially paid</option>
              <option value="PAID">Paid</option>
            </select>
          </label>
          <button type="submit" [disabled]="loading()">Apply filters</button>
        </form>

        @if (error()) {
          <p class="invoice-error" role="alert">{{ error() }}</p>
          <button type="button" class="retry-button" (click)="load()">Try again</button>
        } @else if (loading()) {
          <p class="invoice-state" role="status">Loading invoices…</p>
        } @else if (invoices().length) {
          <div class="invoice-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Repair request</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Balance due</th>
                  <th>Payment status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (invoice of invoices(); track invoice.id) {
                  <tr>
                    <td>{{ invoice.invoiceNumber || 'Draft' }}</td>
                    <td>
                      {{ invoice.invoiceDate ? (invoice.invoiceDate | date: 'mediumDate') : '—' }}
                    </td>
                    <td>{{ invoice.customer.name }}</td>
                    <td>{{ invoice.repairRequestId.slice(-8).toUpperCase() }}</td>
                    <td>{{ invoice.grandTotal | currency: invoice.currency }}</td>
                    <td>{{ invoice.amountPaid | currency: invoice.currency }}</td>
                    <td>{{ invoice.balanceDue | currency: invoice.currency }}</td>
                    <td>
                      <span class="payment-status" [attr.data-status]="invoice.paymentStatus">{{
                        statusLabel(invoice.paymentStatus)
                      }}</span>
                    </td>
                    <td>
                      <div class="invoice-actions">
                        <a [routerLink]="['/shop/jobs/completed-jobs', invoice.repairRequestId]"
                          >Details</a
                        >
                        @if (
                          (invoice.invoiceStatus === 'issued' ||
                            invoice.invoiceStatus === 'cancelled') &&
                          invoice.pdfAvailable
                        ) {
                          <button
                            type="button"
                            [disabled]="downloadingId() === invoice.id"
                            (click)="downloadPdf(invoice)"
                          >
                            {{ downloadingId() === invoice.id ? 'Downloading…' : 'Download PDF' }}
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="invoice-pagination">
            <span>Page {{ page() }} of {{ totalPages() }}</span>
            <div>
              <button
                type="button"
                [disabled]="loading() || page() <= 1"
                (click)="load(page() - 1)"
              >
                Previous
              </button>
              <button
                type="button"
                [disabled]="loading() || page() >= totalPages()"
                (click)="load(page() + 1)"
              >
                Next
              </button>
            </div>
          </div>
        } @else {
          <p class="invoice-state">No repair invoices match these filters.</p>
        }
      </section>
    </section>
  `,
  styles: [
    `
      .invoice-page {
        display: grid;
        gap: 1rem;
      }

      .invoice-card {
        display: grid;
        gap: 1rem;
        min-width: 0;
        padding: 1rem;
        border: 1px solid #e1e9e2;
        border-radius: 0.9rem;
        background: #fff;
      }

      .invoice-filters {
        display: flex;
        align-items: end;
        flex-wrap: wrap;
        gap: 0.7rem;
      }

      .invoice-filters label {
        display: grid;
        flex: 1 1 10rem;
        gap: 0.3rem;
        color: #536157;
        font-size: 0.7rem;
        font-weight: 650;
      }

      .invoice-filters input,
      .invoice-filters select {
        min-height: 2.4rem;
        padding: 0.45rem 0.55rem;
        border: 1px solid #dfe7df;
        border-radius: 0.5rem;
        color: #304537;
        font: inherit;
        font-size: 0.76rem;
      }

      .invoice-filters button,
      .retry-button,
      .invoice-pagination button,
      .invoice-actions button {
        min-height: 2.35rem;
        padding: 0.45rem 0.65rem;
        border: 1px solid #cbd9ce;
        border-radius: 0.5rem;
        background: #fff;
        color: #315d42;
        font: inherit;
        font-size: 0.72rem;
        font-weight: 650;
        cursor: pointer;
      }

      .invoice-filters button {
        border-color: #187543;
        background: #187543;
        color: #fff;
      }

      button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .invoice-table-wrap {
        overflow-x: auto;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
      }

      th,
      td {
        padding: 0.65rem 0.45rem;
        border-bottom: 1px solid #edf1ed;
        color: #394a3f;
        font-size: 0.72rem;
        white-space: nowrap;
      }

      th {
        color: #65756a;
        font-size: 0.68rem;
      }

      .invoice-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .invoice-actions a {
        color: #187543;
        font-size: 0.72rem;
        font-weight: 700;
        text-decoration: none;
      }

      .payment-status {
        color: #8a5a18;
        font-size: 0.7rem;
        font-weight: 700;
      }

      .payment-status[data-status='PAID'] {
        color: #176b34;
      }

      .payment-status[data-status='PARTIALLY_PAID'] {
        color: #7657a4;
      }

      .invoice-pagination {
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: #68776d;
        font-size: 0.72rem;
      }

      .invoice-pagination > div {
        display: flex;
        gap: 0.45rem;
      }

      .invoice-state,
      .invoice-error {
        margin: 0;
        color: #68776d;
        font-size: 0.8rem;
      }

      .invoice-error {
        color: #a13830;
      }

      @media (max-width: 620px) {
        .invoice-pagination {
          align-items: flex-start;
          flex-direction: column;
          gap: 0.55rem;
        }
      }
    `,
  ],
})
export class ShopInvoicesPage {
  private readonly invoicesService = inject(RepairInvoicesService);

  readonly invoices = signal<RepairInvoice[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly page = signal(1);
  readonly totalPages = signal(1);
  readonly search = signal('');
  readonly from = signal('');
  readonly to = signal('');
  readonly paymentStatus = signal<RepairInvoicePaymentStatus | ''>('');
  readonly downloadingId = signal('');

  constructor() {
    this.load();
  }

  setPaymentStatus(value: string): void {
    if (value === 'UNPAID' || value === 'PARTIALLY_PAID' || value === 'PAID') {
      this.paymentStatus.set(value);
    } else {
      this.paymentStatus.set('');
    }
  }

  applyFilters(): void {
    this.load(1);
  }

  load(page = this.page()): void {
    const filters: RepairInvoiceListFilters = {
      search: this.search().trim() || undefined,
      from: this.from() || undefined,
      to: this.to() || undefined,
      paymentStatus: this.paymentStatus(),
      page,
      limit: 10,
    };
    this.loading.set(true);
    this.error.set('');
    this.invoicesService
      .listShopInvoices(filters)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          this.invoices.set(result.invoices);
          this.page.set(result.page);
          this.totalPages.set(Math.max(1, result.totalPages));
        },
        error: (error: unknown) =>
          this.error.set(getAuthErrorMessage(error, 'Invoices could not be loaded.')),
      });
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
      .pipe(finalize(() => this.downloadingId.set('')))
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
