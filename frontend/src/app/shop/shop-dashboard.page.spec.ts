import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from '../core/auth/auth.service';
import { ShopDashboardPage } from './shop-dashboard.page';

describe('ShopDashboardPage', () => {
  let httpTestingController: HttpTestingController;

  afterEach(() => {
    httpTestingController.verify();
  });

  it('shows shop-specific tools without presenting customer portal content', async () => {
    await TestBed.configureTestingModule({
      imports: [ShopDashboardPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: { shopName: signal('Example Repairs') } },
      ],
    }).compileComponents();
    httpTestingController = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ShopDashboardPage);
    fixture.detectChanges();
    httpTestingController.expectNone(`${environment.apiBaseUrl}/shops/dashboard`);
    httpTestingController.expectOne(`${environment.apiBaseUrl}/shop/dashboard/overview`).flush({
      data: {
        range: { from: null, to: null },
        requests: {
          total: 0,
          new: 0,
          pending: 0,
          submitted: 0,
          accepted: 0,
          declined: 0,
          expired: 0,
          recent: [
            {
              _id: 'request-1',
              appliance: 'Washer one',
              description: 'Needs inspection.',
              createdAt: '2026-01-04T00:00:00.000Z',
              shopResponse: { status: 'new' },
              customer: { firstName: 'Customer', lastName: 'One' },
            },
            {
              _id: 'request-2',
              appliance: 'Washer two',
              description: 'Needs inspection.',
              createdAt: '2026-01-03T00:00:00.000Z',
              shopResponse: { status: 'new' },
              customer: { firstName: 'Customer', lastName: 'Two' },
            },
            {
              _id: 'request-3',
              appliance: 'Washer three',
              description: 'Needs inspection.',
              createdAt: '2026-01-02T00:00:00.000Z',
              shopResponse: { status: 'new' },
              customer: { firstName: 'Customer', lastName: 'Three' },
            },
            {
              _id: 'request-4',
              appliance: 'Washer four',
              description: 'Needs inspection.',
              createdAt: '2026-01-01T00:00:00.000Z',
              shopResponse: { status: 'new' },
              customer: { firstName: 'Customer', lastName: 'Four' },
            },
          ],
        },
        quotations: {
          total: 0,
          pending: 0,
          accepted: 0,
          rejected: 0,
          expired: 0,
          withdrawn: 0,
          trend: [],
          recent: [],
        },
        repairs: {
          total: 0,
          active: 0,
          confirmed: 0,
          inspection_pending: 0,
          inspection_in_progress: 0,
          awaiting_customer_approval: 0,
          inspection_approved: 0,
          repair_declined: 0,
          in_progress: 0,
          on_hold: 0,
          repair_completed: 0,
          ready_for_pickup: 0,
          picked_up: 0,
          completed: 1,
          disputed: 0,
          recent: [],
        },
        reviews: {
          averageRating: null,
          total: 0,
          fiveStar: 0,
          distribution: [],
          recent: [],
        },
        revenue: { available: false, reason: 'Repair transactions are not configured.' },
      },
    });
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('app-admin-page-header .admin-page-title')?.textContent,
    ).toContain('Dashboard');
    expect(
      fixture.nativeElement.querySelector('app-admin-page-header .admin-page-description')
        ?.textContent,
    ).toContain('A live view of customer requests');
    expect(getComputedStyle(fixture.nativeElement).display).toBe('block');
    const pageHeader = fixture.nativeElement.querySelector('app-admin-page-header') as HTMLElement;
    expect(getComputedStyle(pageHeader).display).toBe('block');
    expect(pageHeader.getBoundingClientRect().width).toBeGreaterThan(300);
    expect(getComputedStyle(pageHeader).gridColumnEnd).toBe('-1');
    const headerCopy = fixture.nativeElement.querySelector(
      '.admin-page-header__copy',
    ) as HTMLElement;
    expect(headerCopy.getBoundingClientRect().width).toBeGreaterThan(200);
    expect(fixture.nativeElement.textContent).toContain('Dashboard');
    expect(fixture.nativeElement.textContent).toContain('Example Repairs');
    expect(fixture.nativeElement.textContent).toContain('Quotation activity');
    expect(fixture.nativeElement.textContent).toContain('Repair revenue');
    expect(fixture.nativeElement.querySelectorAll('.metric-card')).toHaveSize(6);
    expect(fixture.nativeElement.querySelector('.welcome-card')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.pipeline-grid')).toBeTruthy();
    const pipelineGrid = fixture.nativeElement.querySelector('.pipeline-grid') as HTMLElement;
    const completedPipelineRow = Array.from(pipelineGrid.children).find((row) =>
      row.textContent?.includes('Completed'),
    );
    expect(completedPipelineRow?.textContent).toContain('1');
    expect(fixture.nativeElement.querySelector('.header-actions .filter-trigger')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.header-actions .date-filters')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.recent-side-panels')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.active-repairs-panel')).toBeFalsy();
    expect(fixture.nativeElement.querySelectorAll('.recent-request')).toHaveSize(3);
    expect(fixture.nativeElement.textContent).not.toContain('Washer four');
    expect(fixture.nativeElement.textContent).not.toContain('Your dashboard');

    fixture.nativeElement.querySelector('.filter-trigger').click();
    fixture.detectChanges();
    const fromInput = fixture.nativeElement.querySelector('#dateRange-from') as HTMLInputElement;
    fromInput.value = '2026-01-01';
    fromInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    httpTestingController.expectNone(
      (request) =>
        request.url === `${environment.apiBaseUrl}/shop/dashboard/overview` &&
        request.params.has('from'),
    );

    fixture.nativeElement.querySelector('.apply-button').click();
    fixture.detectChanges();
    const filteredRequest = httpTestingController.expectOne(
      (request) =>
        request.url === `${environment.apiBaseUrl}/shop/dashboard/overview` &&
        request.params.get('from') === '2026-01-01',
    );
    filteredRequest.flush({ data: fixture.componentInstance.dashboard() });
  });
});
