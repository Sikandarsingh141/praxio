import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { RepairInvoicesService } from './repair-invoices.service';

describe('RepairInvoicesService', () => {
  let service: RepairInvoicesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), RepairInvoicesService],
    });
    service = TestBed.inject(RepairInvoicesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the customer invoice only through the authenticated repair endpoint', () => {
    let result: unknown;
    service.getCustomerInvoiceForRepair('repair/123').subscribe((invoice) => (result = invoice));

    http
      .expectOne(`${environment.apiBaseUrl}/customer/invoices/repair/repair%2F123`)
      .flush({ data: { invoice: null } });

    expect(result).toBeNull();
  });

  it('unwraps the standard API envelope when preparing a shop draft', () => {
    let result: unknown;
    service.createShopDraft('repair-123').subscribe((invoice) => (result = invoice));

    const request = http.expectOne(
      `${environment.apiBaseUrl}/shop/invoices/repair/repair-123/draft`,
    );
    expect(request.request.method).toBe('POST');
    request.flush({ data: { invoice: { id: 'invoice-123' } } });

    expect(result).toEqual({ id: 'invoice-123' });
  });

  it('passes shop invoice search, date and payment filters to the list API', () => {
    service
      .listShopInvoices({
        search: 'FIX-INV-2026-000001',
        from: '2026-01-01',
        to: '2026-12-31',
        paymentStatus: 'PARTIALLY_PAID',
        page: 2,
        limit: 10,
      })
      .subscribe();

    const request = http.expectOne(
      (candidate) =>
        candidate.url === `${environment.apiBaseUrl}/shop/invoices` &&
        candidate.params.get('search') === 'FIX-INV-2026-000001' &&
        candidate.params.get('from') === '2026-01-01' &&
        candidate.params.get('to') === '2026-12-31' &&
        candidate.params.get('paymentStatus') === 'PARTIALLY_PAID' &&
        candidate.params.get('page') === '2' &&
        candidate.params.get('limit') === '10',
    );
    expect(request.request.method).toBe('GET');
    request.flush({ data: { invoices: [], page: 2, limit: 10, total: 0, totalPages: 0 } });
  });

  it('downloads the stored PDF as a blob instead of generating it in the browser', () => {
    service.getCustomerInvoicePdf('invoice-123').subscribe();

    const request = http.expectOne(`${environment.apiBaseUrl}/customer/invoices/invoice-123/pdf`);
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['stored PDF'], { type: 'application/pdf' }));
  });

  it('cancels an issued shop invoice through its authenticated endpoint', () => {
    service.cancelShopInvoice('invoice-123').subscribe();

    const request = http.expectOne(`${environment.apiBaseUrl}/shop/invoices/invoice-123/cancel`);
    expect(request.request.method).toBe('POST');
    request.flush({ data: { invoice: { id: 'invoice-123', invoiceStatus: 'cancelled' } } });
  });
});
