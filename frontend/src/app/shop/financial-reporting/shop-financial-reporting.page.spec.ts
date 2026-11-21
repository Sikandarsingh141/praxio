import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ShopFinancialReportingPage } from './shop-financial-reporting.page';

describe('ShopFinancialReportingPage', () => {
  let httpTestingController: HttpTestingController;

  afterEach(() => {
    httpTestingController.verify();
  });

  it('keeps report currencies separate and loads scoped transaction rows on demand', async () => {
    await TestBed.configureTestingModule({
      imports: [ShopFinancialReportingPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpTestingController = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(ShopFinancialReportingPage);
    fixture.detectChanges();
    const today = new Date().toISOString().slice(0, 10);
    const reportData = {
      period: { from: null, to: null },
      invoiceCounts: [{ _id: { invoiceStatus: 'issued', paymentStatus: 'PAID' }, count: 2 }],
      revenueByCurrency: [
        { _id: 'USD', amount: 125, invoiceCount: 1, averageInvoiceValue: 125 },
        { _id: 'INR', amount: 500, invoiceCount: 1, averageInvoiceValue: 500 },
      ],
      collectionsByMethod: [
        { _id: { currency: 'USD', method: 'cash' }, amount: 25, paymentCount: 1 },
        { _id: { currency: 'USD', method: 'upi' }, amount: 75, paymentCount: 1 },
        { _id: { currency: 'INR', method: 'bank_transfer' }, amount: 300, paymentCount: 1 },
      ],
      outstandingByCurrency: [],
      taxByRate: [],
      revenueByCategory: [
        { _id: { currency: 'USD', category: 'Phone repair' }, amount: 100 },
        { _id: { currency: 'USD', category: 'Laptop repair' }, amount: 25 },
        { _id: { currency: 'INR', category: 'Screen repair' }, amount: 350 },
        { _id: { currency: 'INR', category: 'Battery repair' }, amount: 150 },
      ],
      revenueTrend: [
        { _id: { currency: 'USD', date: today }, amount: 125 },
        { _id: { currency: 'INR', date: today }, amount: 500 },
      ],
      recentTransactions: [
        {
          transactionId: 'recent-txn',
          repairRequestId: 'recent-repair',
          invoiceNumber: 'INV-RECENT',
          invoiceDate: `${today}T00:00:00.000Z`,
          customerName: 'Recent Customer',
          paymentDate: `${today}T00:00:00.000Z`,
          method: 'cash',
          status: 'succeeded',
          currency: 'USD',
          amount: 25,
          invoiceAmount: 125,
          amountPaid: 25,
          outstanding: 100,
          reference: 'cash-1',
        },
      ],
      completedRepairs: 1,
      refunds: { trackingAvailable: false, totals: [], count: 0 },
    };
    const initialReportRequest = httpTestingController.expectOne((request) =>
      request.url.endsWith('/shop/invoices/financial-report'),
    );
    expect(initialReportRequest.request.params.keys()).toEqual([]);
    initialReportRequest.flush({ data: reportData });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('$125.00');
    expect(fixture.nativeElement.textContent).toContain('₹500.00');
    expect(fixture.nativeElement.textContent).toContain('Refunds');
    expect(fixture.nativeElement.textContent).toContain('Recent Customer');
    expect(fixture.nativeElement.textContent).toContain('Completed repairs');
    expect(fixture.nativeElement.textContent).toContain('Payments by Method');
    expect(fixture.componentInstance.chartCurrency()).toBe('INR');
    expect(fixture.componentInstance.paymentCurrency()).toBe('INR');
    expect(fixture.componentInstance.paymentTotal()).toBe(300);
    expect(fixture.nativeElement.querySelector('.trend-chart svg')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.payment-donut')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.quick-report').length).toBe(5);
    expect(fixture.componentInstance.chartPoints().length).toBe(12);
    fixture.componentInstance.setPaymentCurrency('USD');
    expect(fixture.componentInstance.paymentTotal()).toBe(100);
    expect(fixture.componentInstance.paymentMethodSegments().map((entry) => entry.percent)).toEqual(
      [75, 25],
    );
    fixture.componentInstance.selectTrendInterval('daily');
    expect(fixture.componentInstance.chartPoints().length).toBe(30);
    fixture.componentInstance.selectTrendInterval('monthly');
    expect(fixture.componentInstance.chartPoints().length).toBe(12);
    expect(fixture.nativeElement.textContent).not.toContain('Print / Save PDF');
    expect(fixture.nativeElement.textContent).not.toContain('issued invoice(s) included');

    (fixture.nativeElement.querySelector('.filter-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.filter-count')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Last 30 days');
    expect(fixture.nativeElement.textContent).toContain('Last 90 days');
    expect(fixture.nativeElement.textContent).toContain('Year to date');
    expect((fixture.nativeElement.querySelector('#dateRange-from') as HTMLInputElement).value).toBe(
      '',
    );
    expect((fixture.nativeElement.querySelector('#dateRange-to') as HTMLInputElement).value).toBe(
      '',
    );
    const last30Days = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.date-range-presets button',
      ) as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes('Last 30 days'));
    expect(last30Days).toBeDefined();
    last30Days?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    const from = (fixture.nativeElement.querySelector('#dateRange-from') as HTMLInputElement).value;
    const to = (fixture.nativeElement.querySelector('#dateRange-to') as HTMLInputElement).value;
    expect(Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)).toBe(
      29 * 24 * 60 * 60 * 1000,
    );
    expect(fixture.nativeElement.textContent).toContain('Apply period');
    (fixture.nativeElement.querySelector('.apply-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.from()).toBe(from);
    expect(fixture.componentInstance.to()).toBe(to);
    const updatedReportRequest = httpTestingController.expectOne((request) =>
      request.url.endsWith('/shop/invoices/financial-report'),
    );
    expect(updatedReportRequest.request.params.get('from')).toBe(from);
    expect(updatedReportRequest.request.params.get('to')).toBe(to);
    updatedReportRequest.flush({ data: reportData });
    fixture.detectChanges();

    const transactionsTab = Array.from(
      fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes('Repair Transactions'));
    transactionsTab?.click();
    fixture.detectChanges();

    const transactionsRequest = httpTestingController.expectOne((request) =>
      request.url.endsWith('/shop/invoices/financial-transactions'),
    );
    expect(transactionsRequest.request.params.get('page')).toBe('1');
    expect(transactionsRequest.request.params.get('from')).toBeTruthy();
    transactionsRequest.flush({
      data: {
        transactions: Array.from({ length: 10 }, (_, index) => ({
          transactionId: `txn-${index + 1}`,
          repairRequestId: `repair-${index + 1}`,
          invoiceNumber: `INV-${index + 1}`,
          invoiceDate: '2026-11-05T00:00:00.000Z',
          customerName: index === 0 ? 'Alex Customer' : `Customer ${index + 1}`,
          paymentDate: '2026-11-07T00:00:00.000Z',
          method: 'cash',
          status: 'succeeded',
          currency: 'USD',
          amount: 25,
          invoiceAmount: 125,
          amountPaid: 25,
          outstanding: 100,
          reference: null,
        })),
        pagination: { page: 1, limit: 10, total: 11, totalPages: 2 },
      },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Alex Customer');
    expect(fixture.nativeElement.textContent).toContain('INV-1');
    expect(fixture.nativeElement.textContent).toContain('Showing 1–10 of 11');
    expect(fixture.nativeElement.querySelector('.list-filters')).toBeNull();

    (fixture.nativeElement.querySelector('.filter-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#search')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#method')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#status')).not.toBeNull();
    (fixture.nativeElement.querySelector('.close-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const filterCases = [
      { tab: 'transactions' as const, fields: ['dateRange', 'search', 'method', 'status'] },
      { tab: 'invoices' as const, fields: ['dateRange', 'search', 'invoicePaymentStatus'] },
      { tab: 'payments' as const, fields: ['dateRange', 'search', 'method'] },
      { tab: 'outstanding' as const, fields: ['dateRange', 'search', 'invoicePaymentStatus'] },
    ];
    for (const filterCase of filterCases) {
      fixture.componentInstance.activeTab.set(filterCase.tab);
      fixture.detectChanges();
      expect(fixture.componentInstance.filterConfig.fields.map((field) => field.key)).toEqual(
        filterCase.fields,
      );
      expect(fixture.nativeElement.querySelector('.list-filters')).toBeNull();
    }
    fixture.componentInstance.activeTab.set('transactions');
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.next-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    const secondPageRequest = httpTestingController.expectOne((request) =>
      request.url.endsWith('/shop/invoices/financial-transactions'),
    );
    expect(secondPageRequest.request.params.get('page')).toBe('2');
    secondPageRequest.flush({
      data: {
        transactions: [
          {
            transactionId: 'txn-11',
            repairRequestId: 'repair-11',
            invoiceNumber: 'INV-11',
            invoiceDate: '2026-11-05T00:00:00.000Z',
            customerName: 'Last Customer',
            paymentDate: '2026-11-07T00:00:00.000Z',
            method: 'cash',
            status: 'succeeded',
            currency: 'USD',
            amount: 25,
            invoiceAmount: 125,
            amountPaid: 25,
            outstanding: 100,
            reference: null,
          },
        ],
        pagination: { page: 2, limit: 10, total: 11, totalPages: 2 },
      },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Last Customer');
    expect(fixture.nativeElement.textContent).toContain('Showing 11–11 of 11');
    expect(httpTestingController.match(`${environment.apiBaseUrl}/shop/invoices`).length).toBe(0);

    const createObjectUrl = spyOn(URL, 'createObjectURL').and.returnValue('blob:report');
    spyOn(HTMLAnchorElement.prototype, 'click').and.stub();
    fixture.componentInstance.downloadQuickReport('outstanding');
    const outstandingReportRequest = httpTestingController.expectOne(
      (request) => request.url === `${environment.apiBaseUrl}/shop/invoices`,
    );
    expect(outstandingReportRequest.request.params.get('outstandingOnly')).toBe('true');
    outstandingReportRequest.flush({
      data: { invoices: [], page: 1, limit: 100, total: 0, totalPages: 1 },
    });
    expect(createObjectUrl).toHaveBeenCalled();

    (fixture.nativeElement.querySelector('.filter-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    const searchInput = fixture.nativeElement.querySelector('#search') as HTMLInputElement;
    searchInput.value = 'INV-';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    const methodSelect = fixture.nativeElement.querySelector('#method') as HTMLSelectElement;
    methodSelect.value = 'cash';
    methodSelect.dispatchEvent(new Event('change', { bubbles: true }));
    const statusSelect = fixture.nativeElement.querySelector('#status') as HTMLSelectElement;
    statusSelect.value = 'succeeded';
    statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.apply-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const filteredTransactionsRequest = httpTestingController.expectOne((request) =>
      request.url.endsWith('/shop/invoices/financial-transactions'),
    );
    expect(filteredTransactionsRequest.request.params.get('search')).toBe('INV-');
    expect(filteredTransactionsRequest.request.params.get('method')).toBe('cash');
    expect(filteredTransactionsRequest.request.params.get('status')).toBe('succeeded');
    filteredTransactionsRequest.flush({
      data: { transactions: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } },
    });

    const filteredReportRequest = httpTestingController.expectOne((request) =>
      request.url.endsWith('/shop/invoices/financial-report'),
    );
    filteredReportRequest.flush({ data: reportData });
  });
});
