import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AdminDashboardOverview } from '../services/admin.service';
import { AdminRepairMonitorPage } from './admin-repair-monitor.page';

describe('AdminRepairMonitorPage', () => {
  let httpTestingController: HttpTestingController;

  const overview: AdminDashboardOverview = {
    range: { from: '2026-01-01', to: '2026-01-30' },
    users: {
      customers: {
        total: 0,
        new: 0,
        previous: 0,
        changePercent: null,
        active: 0,
        inactive: 0,
        suspended: 0,
      },
      shops: {
        total: 0,
        approved: 0,
        pending: 0,
        declined: 0,
        new: 0,
        previous: 0,
        active: 0,
        inactive: 0,
        suspended: 0,
      },
    },
    repairs: {
      total: 12,
      new: 0,
      previous: 0,
      changePercent: null,
      shared: 0,
      pendingShopResponses: 0,
      accepted: 0,
      declined: 0,
      expired: 0,
      completed: 0,
      completionRate: 0,
    },
    quotations: {
      total: 0,
      pending: 0,
      accepted: 0,
      rejected: 0,
      expired: 0,
      acceptanceRate: 0,
    },
    subscriptionFinancials: { currencyTotals: [] },
    trends: [],
    repairStatuses: [
      { status: 'in_progress', count: 4 },
      { status: 'completed', count: 3 },
      { status: 'confirmed', count: 2 },
      { status: 'inspection_pending', count: 1 },
      { status: 'ready_for_pickup', count: 1 },
      { status: 'picked_up', count: 1 },
    ],
    quotationStatuses: [],
    categories: [],
    recentActivities: [],
    recentRegistrations: [],
    recentRepairs: [],
    topShops: [],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminRepairMonitorPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  function flushInitialRequests(): void {
    const overviewRequest = httpTestingController.expectOne(
      (request) => request.url === `${environment.apiBaseUrl}/admin/dashboard/overview`,
    );
    expect(overviewRequest.request.params.get('from')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(overviewRequest.request.params.get('to')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    overviewRequest.flush({ data: overview });

    httpTestingController
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/admin/repair-jobs`)
      .flush({ data: { jobs: [], page: 1, limit: 10, total: 0 } });
    httpTestingController
      .expectOne(
        (request) => request.url === `${environment.apiBaseUrl}/admin/repair-reviews/summary`,
      )
      .flush({ data: { averageRating: 4.8, total: 12 } });
  }

  it('loads the selected-period statistics and repair list', () => {
    const fixture = TestBed.createComponent(AdminRepairMonitorPage);
    fixture.detectChanges();
    flushInitialRequests();
    fixture.detectChanges();

    const metrics = fixture.nativeElement.querySelectorAll(
      '.summary-grid .summary-card strong',
    ) as NodeListOf<HTMLElement>;
    const statusOptions = Array.from(
      fixture.nativeElement.querySelectorAll(
        'select option',
      ) as NodeListOf<HTMLOptionElement>,
      (option) => option.value,
    );
    const text = fixture.nativeElement.textContent as string;
    for (const status of [
      'inspection_pending',
      'inspection_in_progress',
      'awaiting_customer_approval',
      'inspection_approved',
      'repair_declined',
      'disputed',
    ]) {
      expect(statusOptions).toContain(status);
    }
    expect(text).toContain('12');
    expect(text).toContain('Total Requests');
    expect(text).toContain('In Progress');
    expect(text).toContain('Completed');
    expect(text).toContain('Average Customer Rating');
    expect(metrics[3].textContent?.trim()).toBe('4.8');
    expect(metrics[1].textContent?.trim()).toBe('7');
    expect(metrics[2].textContent?.trim()).toBe('5');
    expect(text).toContain('1');
    expect(text).toContain('No repair jobs match this status.');
  });

  it('shows customer profile photos and polished review details', () => {
    const fixture = TestBed.createComponent(AdminRepairMonitorPage);
    fixture.detectChanges();
    flushInitialRequests();

    const reviewsTab = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.monitor-tabs button',
      ) as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes('Customer reviews'));
    reviewsTab?.click();
    fixture.detectChanges();

    const reviewsRequest = httpTestingController.expectOne(
      (request) => request.url === `${environment.apiBaseUrl}/admin/repair-reviews`,
    );
    reviewsRequest.flush({
      data: {
        reviews: [
          {
            _id: 'review-1',
            overallRating: 5,
            repairQuality: 5,
            communication: 4,
            professionalism: 5,
            timeliness: 4,
            valueForMoney: 5,
            title: 'Excellent repair',
            reviewText: 'The laptop was repaired quickly and works perfectly.',
            wouldRecommend: true,
            verifiedAt: '2026-03-02T10:00:00.000Z',
            createdAt: '2026-03-01T10:00:00.000Z',
            customerName: 'Nancy Sharma',
            customerProfileImageUrl: 'data:image/png;base64,bmFuY3k=',
            shopName: 'Mohali Repair Shop',
            appliance: 'Laptop',
          },
        ],
        page: 1,
        limit: 10,
        total: 1,
      },
    });
    fixture.detectChanges();

    expect(
      (fixture.nativeElement.querySelector('.review-avatar') as HTMLImageElement).src,
    ).toContain('bmFuY3k=');
    expect(fixture.nativeElement.querySelector('.review-identity h2')?.textContent).toContain(
      'Nancy Sharma',
    );
    expect(fixture.nativeElement.querySelector('.review-title-row h3')?.textContent).toContain(
      'Customer feedback',
    );
    expect(fixture.nativeElement.querySelector('.review-subject')?.textContent).toContain(
      'Excellent repair',
    );
    expect(fixture.nativeElement.querySelector('.review-meta-line')?.textContent).toContain(
      'Mohali Repair Shop',
    );
    expect(fixture.nativeElement.querySelector('.review-rating')?.textContent).toContain('5');
    expect(fixture.nativeElement.querySelector('.review-breakdown')?.textContent).toContain(
      'Communication',
    );
  });

  it('links each repair card to its dedicated details route', () => {
    const fixture = TestBed.createComponent(AdminRepairMonitorPage);
    fixture.detectChanges();
    const overviewRequest = httpTestingController.expectOne(
      (request) => request.url === `${environment.apiBaseUrl}/admin/dashboard/overview`,
    );
    overviewRequest.flush({ data: overview });
    httpTestingController
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/admin/repair-jobs`)
      .flush({
        data: {
          jobs: [
            {
              _id: '507f1f77bcf86cd709a3ca32',
              appliance: 'Laptop',
              description: 'Screen is cracked.',
              photos: [{ mimeType: 'image/png', data: 'cGhvdG8=' }],
              createdAt: '2026-03-01T10:00:00.000Z',
              updatedAt: '2026-03-02T10:00:00.000Z',
              customer: {
                firstName: 'Customer',
                lastName: 'Example',
                email: 'customer@example.com',
                countryCode: '+91',
                mobileNumber: '9876543210',
                profileImageUrl: 'data:image/png;base64,Y3VzdG9tZXI=',
                location: { latitude: 27.136, longitude: 78.017 },
              },
              shopName: 'Mohali Repair Shop',
              shop: {
                city: 'Mohali',
                state: 'Punjab',
                profileImageUrl: 'data:image/png;base64,c2hvcA==',
                averageRating: 4.7,
                reviewCount: 8,
              },
              quotation: { amount: 850, currency: 'INR', status: 'accepted' },
              repairJob: { status: 'confirmed' },
            },
          ],
          page: 1,
          limit: 10,
          total: 1,
        },
      });
    httpTestingController
      .expectOne(
        (request) => request.url === `${environment.apiBaseUrl}/admin/repair-reviews/summary`,
      )
      .flush({ data: { averageRating: 4.8, total: 12 } });
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('.details-link') as HTMLAnchorElement;
    expect(link.textContent).toContain('View details');
    expect(link.getAttribute('href')).toBe('/admin/repair-jobs/507f1f77bcf86cd709a3ca32');
    expect(fixture.nativeElement.querySelector('.request-id')?.textContent?.trim()).toBe(
      '#09A3CA32',
    );
    expect(
      (fixture.nativeElement.querySelector('.device-photo') as HTMLImageElement).src,
    ).toContain('cGhvdG8=');
    expect(fixture.nativeElement.querySelector('.person-heading strong')?.textContent).toContain(
      'Customer Example',
    );
    expect(fixture.nativeElement.textContent).toContain('Mohali Repair Shop');
    expect(fixture.nativeElement.textContent).not.toContain('27.136, 78.017');
    expect(fixture.nativeElement.textContent).not.toContain('Mohali, Punjab');
    expect(
      (fixture.nativeElement.querySelector('.shop-avatar') as HTMLImageElement).src,
    ).toContain('c2hvcA==');
    expect(fixture.nativeElement.textContent).toContain('4.7');
    expect(fixture.nativeElement.textContent).toContain('Screen is cracked.');
    expect(fixture.nativeElement.querySelectorAll('.progress-tracker li').length).toBe(4);
  });

  it('shows all completed repairs with completion details and a full-details link', () => {
    const fixture = TestBed.createComponent(AdminRepairMonitorPage);
    fixture.detectChanges();
    flushInitialRequests();

    const completedTab = Array.from(
      fixture.nativeElement.querySelectorAll('.monitor-tabs button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes('Completed repairs'));
    expect(completedTab).toBeDefined();
    completedTab?.click();
    fixture.detectChanges();

    const completedRequest = httpTestingController.expectOne(
      (request) => request.url === `${environment.apiBaseUrl}/admin/repair-jobs`,
    );
    expect(completedRequest.request.params.get('status')).toBe('completed');
    expect(completedRequest.request.params.has('from')).toBeFalse();
    expect(completedRequest.request.params.has('to')).toBeFalse();
    completedRequest.flush({
      data: {
        jobs: [
          {
            _id: '507f1f77bcf86cd799439012',
            appliance: 'Laptop',
            description: 'Screen replacement',
            createdAt: '2025-01-01T10:00:00.000Z',
            updatedAt: '2025-01-03T10:00:00.000Z',
            customer: { firstName: 'Customer', lastName: 'Example', email: 'customer@example.com' },
            shopName: 'Repair Shop',
            quotation: { amount: 125, currency: 'INR' },
            repairJob: {
              status: 'completed',
              completedAt: '2025-01-03T10:00:00.000Z',
              approvedRepairAmount: 125,
              completionDescription: 'Screen replaced and tested.',
              workPerformed: 'Replaced display panel.',
              partsReplaced: 'LCD panel',
              history: [{ action: 'completed', at: '2025-01-03T10:00:00.000Z' }],
            },
          },
        ],
        page: 1,
        limit: 10,
        total: 1,
      },
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Showing completed repairs across all dates.');
    expect(text).toContain('Screen replaced and tested.');
    expect(text).toContain('Replaced display panel.');
    expect(text).toContain('LCD panel');
    expect(text).toContain('View status history');
    const link = fixture.nativeElement.querySelector('.details-link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/admin/repair-jobs/507f1f77bcf86cd799439012');
  });

  it('applies selected date and status filters to repair requests', () => {
    const fixture = TestBed.createComponent(AdminRepairMonitorPage);
    fixture.detectChanges();
    flushInitialRequests();

    const dateSelect = fixture.nativeElement.querySelector(
      '.date-select select',
    ) as HTMLSelectElement;
    dateSelect.value = 'month';
    dateSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const overviewRequest = httpTestingController.expectOne(
      (request) => request.url === `${environment.apiBaseUrl}/admin/dashboard/overview`,
    );
    const startOfMonth = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}-01`;
    expect(overviewRequest.request.params.get('from')).toBe(startOfMonth);
    expect(overviewRequest.request.params.get('to')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    overviewRequest.flush({ data: overview });
    httpTestingController
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/admin/repair-jobs`)
      .flush({ data: { jobs: [], page: 1, limit: 10, total: 0 } });

    const statusSelect = fixture.nativeElement.querySelector(
      '.filter-row select',
    ) as HTMLSelectElement;
    statusSelect.value = 'in_progress';
    statusSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const repairRequest = httpTestingController.expectOne(
      (request) => request.url === `${environment.apiBaseUrl}/admin/repair-jobs`,
    );
    expect(repairRequest.request.params.get('status')).toBe('in_progress');
    expect(repairRequest.request.params.get('from')).toBe(startOfMonth);
    repairRequest.flush({ data: { jobs: [], page: 1, limit: 10, total: 0 } });
  });

  it('debounces repair search and sends the trimmed query', fakeAsync(() => {
    const fixture = TestBed.createComponent(AdminRepairMonitorPage);
    fixture.detectChanges();
    flushInitialRequests();

    const search = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    search.value = '  washer  ';
    search.dispatchEvent(new Event('input'));
    tick(299);
    httpTestingController.expectNone(
      (request) => request.url === `${environment.apiBaseUrl}/admin/repair-jobs`,
    );
    tick(1);

    const repairRequest = httpTestingController.expectOne(
      (request) => request.url === `${environment.apiBaseUrl}/admin/repair-jobs`,
    );
    expect(repairRequest.request.params.get('search')).toBe('washer');
    repairRequest.flush({ data: { jobs: [], page: 1, limit: 10, total: 0 } });
  }));

  it('filters by repair item and shop', fakeAsync(() => {
    const fixture = TestBed.createComponent(AdminRepairMonitorPage);
    fixture.detectChanges();
    flushInitialRequests();

    const itemSelect = fixture.nativeElement.querySelector(
      '.item-select select',
    ) as HTMLSelectElement;
    itemSelect.value = 'computer';
    itemSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const itemRequest = httpTestingController.expectOne(
      (request) => request.url === `${environment.apiBaseUrl}/admin/repair-jobs`,
    );
    expect(itemRequest.request.params.get('repairItem')).toBe('computer');
    itemRequest.flush({ data: { jobs: [], page: 1, limit: 10, total: 0 } });

    const shopInput = fixture.nativeElement.querySelector(
      '.shop-filter input',
    ) as HTMLInputElement;
    shopInput.value = 'Mohali Repair';
    shopInput.dispatchEvent(new Event('input'));
    tick(300);

    const shopRequest = httpTestingController.expectOne(
      (request) => request.url === `${environment.apiBaseUrl}/admin/repair-jobs`,
    );
    expect(shopRequest.request.params.get('shop')).toBe('Mohali Repair');
    expect(shopRequest.request.params.get('repairItem')).toBe('computer');
    shopRequest.flush({ data: { jobs: [], page: 1, limit: 10, total: 0 } });
  }));
});
