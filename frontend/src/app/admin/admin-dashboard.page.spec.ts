import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { environment } from '../../environments/environment';
import { AdminDashboardPage } from './admin-dashboard.page';

describe('AdminDashboardPage', () => {
  let httpTestingController: HttpTestingController;

  const pendingRequest = {
    id: 'request-id',
    userId: 'user-id',
    registrationRequestId: 'request-id',
    registrationNumber: 'PRX-20260101-ABCDEF',
    applicantName: 'Customer Example',
    shopName: null,
    businessType: null,
    businessAddress: null,
    services: [],
    email: 'customer@example.com',
    countryCode: '+1',
    mobileNumber: '5551234567',
    accountType: 'customer',
    accountStatus: null,
    registrationStatus: 'pending',
    paymentStatus: 'not_required',
    subscriptionPlan: null,
    paymentAmountCents: null,
    paymentCurrency: null,
    paidAt: null,
    submittedAt: '2026-01-01T00:00:00.000Z',
    reviewedAt: null,
    declineReason: null,
  };

  const statisticsResponse = {
    data: {
      totalUsers: 4,
      totalCustomers: 2,
      totalRepairShops: 2,
      pendingApprovals: 1,
      activeUsers: 2,
      inactiveUsers: 1,
      suspendedUsers: 1,
    },
  };

  function flushStatistics(): void {
    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/admin/users/statistics`)
      .flush(statisticsResponse);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDashboardPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'admin/users', component: AdminDashboardPage }]),
      ],
    }).compileComponents();
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('lists customers and shops with role, status, email, and date fields', () => {
    const fixture = TestBed.createComponent(AdminDashboardPage);
    fixture.detectChanges();

    const request = httpTestingController.expectOne(
      (req) => req.url === `${environment.apiBaseUrl}/admin/users`,
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('status')).toBe('all');
    expect(request.request.params.get('limit')).toBe('5');
    request.flush({
      data: {
        requests: [pendingRequest],
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    });
    flushStatistics();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Customer Example');
    expect(text).toContain('customer@example.com');
    expect(text).toContain('Customer');
    expect(text).toContain('Pending');
    expect(text).toContain('Accept');
    expect(text).toContain('Decline');
    expect(fixture.nativeElement.querySelector('thead')?.textContent).not.toContain('User ID');
    expect(
      (fixture.nativeElement.querySelector('.user-profile-link') as HTMLAnchorElement).getAttribute(
        'href',
      ),
    ).toBe('/admin/users/user-id');
  });

  it('shows dedicated Shops and Customers views from their Admin navigation routes', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/admin/users?accountType=shop', AdminDashboardPage);

    const shopsRequest = httpTestingController.expectOne(
      (request) =>
        request.url === `${environment.apiBaseUrl}/admin/users` &&
        request.params.get('accountType') === 'shop',
    );
    expect(shopsRequest.request.params.get('limit')).toBe('5');
    shopsRequest.flush({
      data: { requests: [], page: 1, limit: 10, total: 0, totalPages: 0 },
    });
    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/admin/users/statistics`)
      .flush(statisticsResponse);
    harness.detectChanges();

    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Shops');
    expect(harness.routeNativeElement?.textContent).toContain('All shops');
    expect(harness.routeNativeElement?.textContent).toContain('Total shops');
    expect(harness.routeNativeElement?.textContent).toContain('No shops found');

    await harness.navigateByUrl('/admin/users?accountType=customer', AdminDashboardPage);
    const customersRequest = httpTestingController.expectOne(
      (request) =>
        request.url === `${environment.apiBaseUrl}/admin/users` &&
        request.params.get('accountType') === 'customer',
    );
    expect(customersRequest.request.params.get('limit')).toBe('5');
    customersRequest.flush({
      data: { requests: [], page: 1, limit: 10, total: 0, totalPages: 0 },
    });
    harness.detectChanges();

    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Customers');
    expect(harness.routeNativeElement?.textContent).toContain('All customers');
    expect(harness.routeNativeElement?.textContent).toContain('Total customers');
    expect(page.accountTypeFilter()).toBe('customer');
  });

  it('applies admin account filters only after confirming the drawer', () => {
    const fixture = TestBed.createComponent(AdminDashboardPage);
    fixture.detectChanges();
    httpTestingController
      .expectOne((req) => req.url.endsWith('/admin/users'))
      .flush({
        data: {
          requests: [],
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
      });
    flushStatistics();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.filter-trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    const type = fixture.nativeElement.querySelector('#accountType') as HTMLSelectElement;
    type.value = 'shop';
    type.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    httpTestingController.expectNone((req) => req.url.endsWith('/admin/users'));

    (fixture.nativeElement.querySelector('.apply-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    const filtered = httpTestingController.expectOne((req) => req.url.endsWith('/admin/users'));
    expect(filtered.request.params.get('accountType')).toBe('shop');
    expect(filtered.request.params.get('page')).toBe('1');
    filtered.flush({
      data: {
        requests: [],
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('User type: Repair shop');
  });

  it('filters suspended accounts using account status instead of approval status', () => {
    const fixture = TestBed.createComponent(AdminDashboardPage);
    fixture.detectChanges();
    httpTestingController
      .expectOne((req) => req.url.endsWith('/admin/users'))
      .flush({ data: { requests: [], page: 1, limit: 10, total: 0, totalPages: 0 } });
    flushStatistics();
    fixture.detectChanges();

    const suspendedTab = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.status-tabs button',
      ) as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes('Suspended'));
    suspendedTab?.click();

    const filtered = httpTestingController.expectOne((req) => req.url.endsWith('/admin/users'));
    expect(filtered.request.params.get('status')).toBe('all');
    expect(filtered.request.params.get('accountStatus')).toBe('suspended');
    filtered.flush({ data: { requests: [], page: 1, limit: 10, total: 0, totalPages: 0 } });
    fixture.detectChanges();
    expect(suspendedTab?.getAttribute('aria-pressed')).toBe('true');
  });

  it('does not show export, add-user, or location actions in the user list', () => {
    const fixture = TestBed.createComponent(AdminDashboardPage);
    fixture.detectChanges();
    httpTestingController
      .expectOne((req) => req.url.endsWith('/admin/users'))
      .flush({
        data: {
          requests: [{ ...pendingRequest, latitude: 27.175255, longitude: 78.009816 }],
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      });
    flushStatistics();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.export-button')).toBeNull();
    expect(fixture.nativeElement.querySelector('.add-user-button')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('View location');
  });

  it('asks for confirmation before approving and reloads the list', () => {
    const fixture = TestBed.createComponent(AdminDashboardPage);
    fixture.detectChanges();
    httpTestingController
      .expectOne((req) => req.url.endsWith('/admin/users'))
      .flush({
        data: {
          requests: [pendingRequest],
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      });
    flushStatistics();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.approve-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain("Approve Customer Example's registration?");
    (fixture.nativeElement.querySelector('.confirm-button') as HTMLButtonElement).click();

    const approval = httpTestingController.expectOne(
      `${environment.apiBaseUrl}/admin/registration-requests/request-id/approve`,
    );
    expect(approval.request.method).toBe('PATCH');
    approval.flush({ data: { request: { ...pendingRequest, accountStatus: 'active' } } });

    const reload = httpTestingController.expectOne((req) => req.url.endsWith('/admin/users'));
    reload.flush({
      data: { requests: [], page: 1, limit: 10, total: 0, totalPages: 0 },
    });
    flushStatistics();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Customer Example approved. They can now sign in.',
    );
  });

  it('uses the shared confirmation dialog and requires a reason to decline', () => {
    const fixture = TestBed.createComponent(AdminDashboardPage);
    fixture.detectChanges();
    httpTestingController
      .expectOne((req) => req.url.endsWith('/admin/users'))
      .flush({
        data: {
          requests: [pendingRequest],
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      });
    flushStatistics();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.action-menu summary') as HTMLElement).click();
    (fixture.nativeElement.querySelector('.action-menu .menu-danger') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeTruthy();
    (fixture.nativeElement.querySelector('.confirm-button') as HTMLButtonElement).click();

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Enter a reason before continuing.');
    httpTestingController.expectNone(
      `${environment.apiBaseUrl}/admin/registration-requests/request-id/decline`,
    );

    const reason = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    reason.value = 'Registration documents could not be verified.';
    reason.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.confirm-button') as HTMLButtonElement).click();

    const decline = httpTestingController.expectOne(
      `${environment.apiBaseUrl}/admin/registration-requests/request-id/decline`,
    );
    expect(decline.request.method).toBe('PATCH');
    expect(decline.request.body).toEqual({
      reason: 'Registration documents could not be verified.',
    });
    decline.flush({
      data: {
        request: {
          ...pendingRequest,
          registrationStatus: 'declined',
          declineReason: 'Registration documents could not be verified.',
        },
      },
    });
    httpTestingController
      .expectOne((req) => req.url.endsWith('/admin/users'))
      .flush({
        data: { requests: [], page: 1, limit: 10, total: 0, totalPages: 0 },
      });
    flushStatistics();
  });

  it('shows account actions only for approved users and no actions for declined users', () => {
    const fixture = TestBed.createComponent(AdminDashboardPage);
    fixture.detectChanges();
    httpTestingController
      .expectOne((req) => req.url.endsWith('/admin/users'))
      .flush({
        data: {
          requests: [
            { ...pendingRequest, registrationStatus: 'approved', accountStatus: 'active' },
            { ...pendingRequest, id: 'declined-id', registrationStatus: 'declined' },
          ],
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        },
      });
    flushStatistics();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows[0].querySelector('.approve-button')).toBeNull();
    expect(rows[0].querySelector('.account-action-button')?.textContent).toContain('Deactivate');
    expect(rows[0].querySelector('.action-menu summary')).toBeTruthy();
    expect(rows[0].querySelector('.action-menu-content a')?.textContent).toContain(
      'Manage account',
    );
    expect(rows[0].querySelector('.action-menu-content .menu-danger')?.textContent).toContain(
      'Suspend',
    );
    expect(rows[1].querySelector('.approve-button')).toBeNull();
    expect(rows[1].querySelector('.decline-button')).toBeNull();
  });

  it('requires a suspension reason and submits the account status change', () => {
    const fixture = TestBed.createComponent(AdminDashboardPage);
    fixture.detectChanges();
    httpTestingController
      .expectOne((req) => req.url.endsWith('/admin/users'))
      .flush({
        data: {
          requests: [
            { ...pendingRequest, registrationStatus: 'approved', accountStatus: 'active' },
          ],
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      });
    flushStatistics();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.action-menu summary') as HTMLElement).click();
    (fixture.nativeElement.querySelector('.action-menu .menu-danger') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.confirm-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Enter a reason before continuing.');
    httpTestingController.expectNone(`${environment.apiBaseUrl}/admin/users/user-id/status`);

    const reason = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    reason.value = 'Repeated policy violations';
    reason.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.confirm-button') as HTMLButtonElement).click();

    const statusChange = httpTestingController.expectOne(
      `${environment.apiBaseUrl}/admin/users/user-id/status`,
    );
    expect(statusChange.request.method).toBe('PATCH');
    expect(statusChange.request.body).toEqual({
      status: 'suspended',
      reason: 'Repeated policy violations',
    });
    statusChange.flush({ data: { accountStatus: 'suspended' } });
    httpTestingController
      .expectOne((req) => req.url.endsWith('/admin/users'))
      .flush({ data: { requests: [], page: 1, limit: 10, total: 0, totalPages: 0 } });
    flushStatistics();
  });

  it('refreshes account data after another Admin changed the status', () => {
    const fixture = TestBed.createComponent(AdminDashboardPage);
    fixture.detectChanges();
    httpTestingController
      .expectOne((req) => req.url.endsWith('/admin/users'))
      .flush({
        data: {
          requests: [
            { ...pendingRequest, registrationStatus: 'approved', accountStatus: 'active' },
          ],
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      });
    flushStatistics();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.account-action-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.confirm-button') as HTMLButtonElement).click();

    const update = httpTestingController.expectOne(
      `${environment.apiBaseUrl}/admin/users/user-id/status`,
    );
    expect(update.request.body).toEqual({ status: 'inactive' });
    update.flush(
      { message: 'This account was updated by another Admin. Refresh and try again.' },
      { status: 409, statusText: 'Conflict' },
    );

    const refreshedUsers = httpTestingController.expectOne(
      (req) => req.url === `${environment.apiBaseUrl}/admin/users`,
    );
    const refreshedStatistics = httpTestingController.expectOne(
      `${environment.apiBaseUrl}/admin/users/statistics`,
    );
    refreshedUsers.flush({
      data: {
        requests: [
          { ...pendingRequest, registrationStatus: 'approved', accountStatus: 'inactive' },
        ],
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    });
    refreshedStatistics.flush(statisticsResponse);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'This account was updated by another Admin. Refresh and try again.',
    );
    expect(fixture.nativeElement.textContent).toContain('Inactive');
  });

  it('cancels a confirmation without sending the decision', () => {
    const fixture = TestBed.createComponent(AdminDashboardPage);
    fixture.detectChanges();
    httpTestingController
      .expectOne((req) => req.url.endsWith('/admin/users'))
      .flush({
        data: {
          requests: [pendingRequest],
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      });
    flushStatistics();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.approve-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.cancel-button') as HTMLButtonElement).click();

    expect(fixture.componentInstance.confirmation()).toBeNull();
    httpTestingController.expectNone(
      `${environment.apiBaseUrl}/admin/registration-requests/request-id/approve`,
    );
  });
});
