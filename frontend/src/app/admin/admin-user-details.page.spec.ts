import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { environment } from '../../environments/environment';
import { AdminUserDetailsPage } from './admin-user-details.page';

describe('AdminUserDetailsPage', () => {
  let httpTestingController: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'admin/users/:id', component: AdminUserDetailsPage }]),
      ],
    }).compileComponents();
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('shows an accessible CDK overlay while user details are loading', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/admin/users/user-id', AdminUserDetailsPage);
    await new Promise<void>((resolve) => setTimeout(resolve, 160));

    expect(
      document.body.querySelector('.cdk-overlay-backdrop.praxio-loader-backdrop'),
    ).toBeTruthy();
    expect(document.body.querySelector('.cdk-overlay-pane.praxio-loader-panel')).toBeTruthy();
    expect(document.body.querySelector('[role="status"][aria-label="Loading"]')).toBeTruthy();
    expect(document.body.querySelector('.loader-title')?.textContent?.trim()).toBe('Loading...');
    expect(
      harness.routeNativeElement?.querySelector('.user-details')?.getAttribute('aria-busy'),
    ).toBe('true');

    httpTestingController.expectOne(`${environment.apiBaseUrl}/admin/users/user-id`).flush({
      data: {
        id: 'user-id',
        fullName: 'Customer Example',
        email: 'customer@example.com',
        countryCode: '',
        mobileNumber: '',
        accountType: 'customer',
        accountStatus: 'active',
        approvalStatus: 'approved',
        profileImageUrl: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        location: null,
        shop: null,
        registration: null,
        repairActivity: [],
        quotationActivity: [],
      },
    });
    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/admin/users/user-id/activity`)
      .flush({ data: [] });
    harness.detectChanges();

    expect(document.body.querySelector('.cdk-overlay-pane.praxio-loader-panel')).toBeNull();
    expect(
      harness.routeNativeElement?.querySelector('.user-details')?.getAttribute('aria-busy'),
    ).toBe('false');
  });

  it('loads user details and displays the profile and map location', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/admin/users/user-id', AdminUserDetailsPage);
    const request = httpTestingController.expectOne(
      `${environment.apiBaseUrl}/admin/users/user-id`,
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      data: {
        id: 'user-id',
        fullName: 'Shop Owner',
        email: 'shop@example.com',
        countryCode: '+91',
        mobileNumber: '9876543210',
        accountType: 'shop',
        accountStatus: 'active',
        approvalStatus: 'approved',
        profileImageUrl: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        location: { latitude: 28.6139, longitude: 77.209 },
        shop: {
          shopName: 'Example Repairs',
          businessType: 'Repair',
          description: 'Repair services',
          yearsOfExperience: 5,
          address: 'Main Road',
          street: '',
          area: '',
          city: 'Delhi',
          state: 'Delhi',
          country: 'India',
          postalCode: '110001',
          landmark: '',
          services: ['AC Repair'],
        },
        registration: {
          registrationNumber: 'PRX-20260101-ABCDEF',
          status: 'approved',
          submittedAt: '2026-01-01T00:00:00.000Z',
          reviewedAt: null,
          declineReason: null,
          adminRemarks: null,
          paymentStatus: 'paid',
          paymentAmountCents: 2900,
          paymentCurrency: 'usd',
          paidAt: null,
        },
        repairActivity: [],
        quotationActivity: [],
      },
    });
    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/admin/users/user-id/activity`)
      .flush({
        data: [
          {
            id: 'activity-id',
            adminUserId: 'admin-id',
            action: 'registration_approved',
            previousApprovalStatus: 'pending',
            newApprovalStatus: 'approved',
            previousAccountStatus: 'inactive',
            newAccountStatus: 'active',
            reason: null,
            createdAt: '2026-01-02T00:00:00.000Z',
          },
        ],
      });
    harness.detectChanges();

    expect(page.user()?.fullName).toBe('Shop Owner');
    expect(harness.routeNativeElement?.textContent).toContain('Example Repairs');
    expect(harness.routeNativeElement?.textContent).toContain('shop@example.com');
    expect(harness.routeNativeElement?.textContent).toContain('Registration details');
    expect(harness.routeNativeElement?.textContent).toContain('Payment details');
    expect(harness.routeNativeElement?.textContent).toContain('Administrative activity');
    expect(harness.routeNativeElement?.textContent).toContain('Registration Approved');
    expect(harness.routeNativeElement?.querySelector('#repair-requests')).toBeTruthy();
    expect(harness.routeNativeElement?.querySelector('#quotations')).toBeTruthy();
    expect(harness.routeNativeElement?.querySelector('.profile-tabs')?.textContent).toContain(
      'Payments',
    );
    const currentUrl = window.location.href;
    const activityTab = Array.from(
      harness.routeNativeElement?.querySelectorAll('.profile-tabs button') ?? [],
    ).find((button) => button.textContent?.includes('Activity')) as HTMLButtonElement;
    activityTab.click();
    harness.detectChanges();
    expect(page.activeSection()).toBe('activity');
    expect(window.location.href).toBe(currentUrl);
    expect(activityTab.getAttribute('aria-current')).toBe('location');
    const mapLink = harness.routeNativeElement?.querySelector('.map-link') as HTMLAnchorElement;
    expect(mapLink.href).toContain('28.6139,77.209');
    expect(mapLink.target).toBe('_blank');
    const mapFrame = harness.routeNativeElement?.querySelector(
      '.location-map',
    ) as HTMLIFrameElement;
    expect(mapFrame).toBeTruthy();
    expect(mapFrame.src).toContain('openstreetmap.org/export/embed.html');
    expect(mapFrame.src).toContain('marker=28.6139,77.209');
    expect(harness.routeNativeElement?.querySelector('.location-map-card.compact')).toBeTruthy();
  });

  it('shows a clear message when no user coordinates exist', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/admin/users/user-id', AdminUserDetailsPage);
    httpTestingController.expectOne(`${environment.apiBaseUrl}/admin/users/user-id`).flush({
      data: {
        id: 'user-id',
        fullName: 'Customer Example',
        email: 'customer@example.com',
        countryCode: '',
        mobileNumber: '',
        accountType: 'customer',
        accountStatus: 'active',
        approvalStatus: 'approved',
        profileImageUrl: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        location: null,
        shop: null,
        registration: null,
        repairActivity: [],
        quotationActivity: [],
      },
    });
    httpTestingController
      .expectOne(`${environment.apiBaseUrl}/admin/users/user-id/activity`)
      .flush({ data: [] });
    harness.detectChanges();

    expect(harness.routeNativeElement?.textContent).toContain(
      'No valid map coordinates are saved.',
    );
    expect(harness.routeNativeElement?.querySelector('.map-link')).toBeNull();
    expect(harness.routeNativeElement?.querySelector('.location-map')).toBeNull();
  });
});
