import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { AdminOverviewPage } from './admin-overview.page';

describe('AdminOverviewPage', () => {
  let http: HttpTestingController;

  const overview = {
    range: { from: '2026-11-01T00:00:00.000Z', to: '2026-11-09T23:59:59.999Z' },
    users: {
      customers: {
        total: 14,
        new: 3,
        previous: 2,
        changePercent: 50,
        active: 12,
        inactive: 2,
        suspended: 0,
      },
      shops: {
        total: 5,
        approved: 3,
        pending: 1,
        declined: 1,
        new: 1,
        previous: 0,
        active: 3,
        inactive: 2,
        suspended: 0,
      },
    },
    repairs: {
      total: 20,
      new: 4,
      previous: 2,
      changePercent: 100,
      shared: 15,
      pendingShopResponses: 3,
      accepted: 5,
      declined: 2,
      expired: 1,
      completed: 8,
      completionRate: 40,
    },
    quotations: {
      total: 12,
      pending: 4,
      accepted: 5,
      rejected: 2,
      expired: 1,
      acceptanceRate: 71.4,
    },
    subscriptionFinancials: {
      currencyTotals: [
        {
          currency: 'USD',
          accountReceivableCents: 598950000,
          overdueAmountCents: 125000,
          subscriptionRevenueCents: 870000,
        },
      ],
    },
    trends: [
      { period: '2026-11-01', customers: 1, shops: 0, repairs: 2, quotations: 1 },
      { period: '2026-11-09', customers: 2, shops: 1, repairs: 2, quotations: 3 },
    ],
    repairStatuses: [
      { status: 'open', count: 10 },
      { status: 'completed', count: 8 },
      { status: 'cancelled', count: 2 },
    ],
    quotationStatuses: [
      { status: 'pending', count: 4 },
      { status: 'accepted', count: 5 },
      { status: 'rejected', count: 2 },
      { status: 'expired', count: 1 },
    ],
    categories: [{ name: 'Mobile Phones', count: 4, percentage: 100 }],
    recentActivities: [
      {
        id: 'shop-subscription-purchased:shop-id',
        type: 'shop_subscription_purchased',
        description: 'Shop Subscription Purchased',
        relatedName: 'Amit Shop',
        createdAt: '2026-11-09T17:40:00.000Z',
        link: '/admin/users/shop-id',
        amountCents: 2900,
        currency: 'USD',
        status: 'paid',
      },
    ],
    recentRegistrations: [],
    recentRepairs: [],
    topShops: [],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminOverviewPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads financial metrics and displays account receivable and subscription revenue', () => {
    const fixture = TestBed.createComponent(AdminOverviewPage);
    fixture.detectChanges();

    const request = http.expectOne(
      (req) => req.url === `${environment.apiBaseUrl}/admin/dashboard/overview`,
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('from')).toBeTruthy();
    expect(request.request.params.get('to')).toBeTruthy();
    request.flush({ data: overview });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('14');
    expect(text).toContain('20');
    expect(text).toContain('Account Receivable');
    expect(text).toContain('$5,989,500.00');
    expect(text).toContain('Outstanding shop subscription payments');
    expect(text).toContain('Subscription Revenue');
    expect(text).toContain('$8,700.00');
    expect(text).toContain('Collected shop subscription payments');
    expect(text).toContain('Overdue Amount');
    expect(text).toContain('Recent subscription activity');
    expect(text).toContain('Amit Shop');
    expect(text).toContain('Shop Subscription Purchased');
    expect(text).toContain('$29.00');
    expect(text).toContain('Mobile Phones');
    expect(fixture.nativeElement.querySelector('.trend-line')).toBeTruthy();
  });

  it('requests updated analytics when the date range changes', () => {
    const fixture = TestBed.createComponent(AdminOverviewPage);
    fixture.detectChanges();
    const initialRequest = http.expectOne((req) => req.url.endsWith('/admin/dashboard/overview'));
    const initialFrom = initialRequest.request.params.get('from');
    initialRequest.flush({ data: overview });
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = '7d';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const request = http.expectOne((req) => req.url.endsWith('/admin/dashboard/overview'));
    expect(request.request.params.get('from')).not.toBe(initialFrom);
    request.flush({ data: overview });
  });
});
