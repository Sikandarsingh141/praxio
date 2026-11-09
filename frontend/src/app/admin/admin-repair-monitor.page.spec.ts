import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { AdminDashboardOverview } from './admin.service';
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
    revenue: { available: false, reason: 'Unavailable' },
    trends: [],
    repairStatuses: [
      { status: 'in_progress', count: 4 },
      { status: 'completed', count: 3 },
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
  }

  it('loads the selected-period statistics and repair list', () => {
    const fixture = TestBed.createComponent(AdminRepairMonitorPage);
    fixture.detectChanges();
    flushInitialRequests();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('12');
    expect(text).toContain('Total repairs');
    expect(text).toContain('4');
    expect(text).toContain('In progress');
    expect(text).toContain('3');
    expect(text).toContain('Completed');
    expect(text).toContain('1');
    expect(text).not.toContain('Disputed');
    expect(text).toContain('No repair jobs match this status.');
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
              _id: '507f1f77bcf86cd799439011',
              appliance: 'Laptop',
              description: 'Screen is cracked.',
              createdAt: '2026-03-01T10:00:00.000Z',
              updatedAt: '2026-03-02T10:00:00.000Z',
              customer: { fullName: 'Customer Example', email: 'customer@example.com' },
              repairJob: { status: 'confirmed' },
            },
          ],
          page: 1,
          limit: 10,
          total: 1,
        },
      });
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('.details-link') as HTMLAnchorElement;
    expect(link.textContent).toContain('View details');
    expect(link.getAttribute('href')).toBe('/admin/repair-jobs/507f1f77bcf86cd799439011');
  });

  it('applies selected date and status filters to repair requests', () => {
    const fixture = TestBed.createComponent(AdminRepairMonitorPage);
    fixture.detectChanges();
    flushInitialRequests();

    const dateSelect = fixture.nativeElement.querySelector('.date-select select') as HTMLSelectElement;
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

    const statusSelect = fixture.nativeElement.querySelector('.filter-row select') as HTMLSelectElement;
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
});
