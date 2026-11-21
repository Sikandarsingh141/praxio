import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../../core/auth/auth.models';
import {
  RecordRepairInvoicePaymentInput,
  RepairInvoice,
  RepairInvoiceListFilters,
  RepairInvoicePage,
  ShopFinancialReport,
  ShopFinancialReportFilters,
  ShopFinancialTransactionsFilters,
  ShopFinancialTransactionsPage,
} from '../models/repair-invoice.models';

@Injectable({ providedIn: 'root' })
export class RepairInvoicesService {
  private readonly shopUrl = `${environment.apiBaseUrl}/shop/invoices`;
  private readonly customerUrl = `${environment.apiBaseUrl}/customer/invoices`;

  constructor(private readonly http: HttpClient) {}

  getShopInvoiceForRepair(repairRequestId: string): Observable<RepairInvoice | null> {
    return this.http
      .get<ApiEnvelope<{ invoice: RepairInvoice | null }>>(
        `${this.shopUrl}/repair/${encodeURIComponent(repairRequestId)}`,
      )
      .pipe(map((response) => response.data.invoice));
  }

  createShopDraft(repairRequestId: string): Observable<RepairInvoice> {
    return this.http
      .post<ApiEnvelope<{ invoice: RepairInvoice }>>(
        `${this.shopUrl}/repair/${encodeURIComponent(repairRequestId)}/draft`,
        {},
      )
      .pipe(map((response) => response.data.invoice));
  }

  previewShopDraft(invoiceId: string): Observable<Blob> {
    return this.http.post(`${this.shopUrl}/${encodeURIComponent(invoiceId)}/preview`, null, {
      responseType: 'blob',
    });
  }

  issueShopInvoice(invoiceId: string): Observable<RepairInvoice> {
    return this.http
      .post<ApiEnvelope<{ invoice: RepairInvoice }>>(
        `${this.shopUrl}/${encodeURIComponent(invoiceId)}/issue`,
        {},
      )
      .pipe(map((response) => response.data.invoice));
  }

  cancelShopInvoice(invoiceId: string): Observable<RepairInvoice> {
    return this.http
      .post<ApiEnvelope<{ invoice: RepairInvoice }>>(
        `${this.shopUrl}/${encodeURIComponent(invoiceId)}/cancel`,
        {},
      )
      .pipe(map((response) => response.data.invoice));
  }

  listShopInvoices(filters: RepairInvoiceListFilters): Observable<RepairInvoicePage> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http
      .get<ApiEnvelope<RepairInvoicePage>>(this.shopUrl, { params })
      .pipe(map((response) => response.data));
  }

  getShopFinancialReport(filters: ShopFinancialReportFilters): Observable<ShopFinancialReport> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http
      .get<ApiEnvelope<ShopFinancialReport>>(`${this.shopUrl}/financial-report`, { params })
      .pipe(map((response) => response.data));
  }

  listShopFinancialTransactions(
    filters: ShopFinancialTransactionsFilters,
  ): Observable<ShopFinancialTransactionsPage> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http
      .get<ApiEnvelope<ShopFinancialTransactionsPage>>(`${this.shopUrl}/financial-transactions`, {
        params,
      })
      .pipe(map((response) => response.data));
  }

  getShopInvoicePdf(invoiceId: string): Observable<Blob> {
    return this.http.get(`${this.shopUrl}/${encodeURIComponent(invoiceId)}/pdf`, {
      responseType: 'blob',
    });
  }

  recordManualPayment(
    invoiceId: string,
    input: RecordRepairInvoicePaymentInput,
  ): Observable<RepairInvoice> {
    return this.http
      .post<ApiEnvelope<{ invoice: RepairInvoice }>>(
        `${this.shopUrl}/${encodeURIComponent(invoiceId)}/payments`,
        input,
      )
      .pipe(map((response) => response.data.invoice));
  }

  getCustomerInvoiceForRepair(repairRequestId: string): Observable<RepairInvoice | null> {
    return this.http
      .get<ApiEnvelope<{ invoice: RepairInvoice | null }>>(
        `${this.customerUrl}/repair/${encodeURIComponent(repairRequestId)}`,
      )
      .pipe(map((response) => response.data.invoice));
  }

  getCustomerInvoicePdf(invoiceId: string): Observable<Blob> {
    return this.http.get(`${this.customerUrl}/${encodeURIComponent(invoiceId)}/pdf`, {
      responseType: 'blob',
    });
  }

  createCustomerCheckout(invoiceId: string): Observable<string> {
    return this.http
      .post<ApiEnvelope<{ checkoutUrl: string }>>(
        `${this.customerUrl}/${encodeURIComponent(invoiceId)}/checkout`,
        {},
      )
      .pipe(map((response) => response.data.checkoutUrl));
  }
}
