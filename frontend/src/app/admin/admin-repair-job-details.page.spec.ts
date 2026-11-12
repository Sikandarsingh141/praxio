import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { environment } from '../../environments/environment';
import { AdminRepairJobDetailsPage } from './admin-repair-job-details.page';

describe('AdminRepairJobDetailsPage', () => {
  let httpTestingController: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'admin/repair-jobs/:id', component: AdminRepairJobDetailsPage },
        ]),
      ],
    }).compileComponents();
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('loads and displays repair, customer, shop, quotation, and history details', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(
      '/admin/repair-jobs/507f1f77bcf86cd709a3ca32',
      AdminRepairJobDetailsPage,
    );
    const request = httpTestingController.expectOne(
      (request) =>
        request.url === `${environment.apiBaseUrl}/admin/repair-jobs` &&
        request.params.get('requestId') === '507f1f77bcf86cd709a3ca32',
    );
    expect(request.request.params.get('status')).toBe('all');
    expect(request.request.params.get('limit')).toBe('1');
    request.flush({
      data: {
        jobs: [
          {
            _id: '507f1f77bcf86cd709a3ca32',
            appliance: 'Washing machine',
            description: 'Stops during the spin cycle.',
            brand: 'Example',
            model: 'WM-100',
            serviceType: 'home_service',
            preferredServiceDate: '2026-03-05T00:00:00.000Z',
            photos: [{ mimeType: 'image/png', data: 'cGhvdG8=' }],
            createdAt: '2026-03-01T10:00:00.000Z',
            updatedAt: '2026-03-03T10:00:00.000Z',
            customer: {
              firstName: 'Customer',
                lastName: 'Example',
              email: 'customer@example.com',
              countryCode: '+91',
              mobileNumber: '9876543210',
            },
            shopName: 'Repair Shop',
            shop: {
              firstName: 'Owner',
                lastName: 'Example',
              email: 'shop@example.com',
              countryCode: '+91',
              mobileNumber: '9876543211',
              address: 'Main Road',
              city: 'Pune',
              state: 'Maharashtra',
              postalCode: '411001',
            },
            quotation: {
              amount: 2500,
              currency: 'INR',
              status: 'accepted',
              proposedSolution: 'Replace the drive belt.',
            },
            repairJob: {
              status: 'in_progress',
              inspection: {
                images: [{ mimeType: 'image/jpeg', data: 'aW1hZ2U=' }],
                findings: 'Drive belt is worn.',
              },
              history: [
                {
                  action: 'repair_started',
                  notes: 'Parts ordered.',
                  at: '2026-03-03T10:00:00.000Z',
                },
              ],
            },
          },
        ],
        page: 1,
        limit: 1,
        total: 1,
      },
    });
    harness.detectChanges();

    const text = harness.routeNativeElement?.textContent as string;
    expect(text).toContain('Washing machine');
    expect(text).toContain('Request ID: 09A3CA32');
    expect(text).toContain('Customer Example');
    expect(text).toContain('Repair Shop');
    expect(text).toContain('Replace the drive belt.');
    expect(text).toContain('Repair Started');
    expect(text).toContain('Back to repair monitoring');
    expect(text).toContain('Documents (2)');
    expect(text).toContain('Notes (0)');
    expect(page.loading()).toBeFalse();

    const documentsTab = Array.from(
      harness.routeNativeElement?.querySelectorAll('button') ?? [],
    ).find((button) => button.textContent?.includes('Documents')) as HTMLButtonElement;
    documentsTab.click();
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelectorAll('.document-grid img').length).toBe(2);
  });

  it('shows a not-found message when the repair does not exist', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/admin/repair-jobs/missing-id', AdminRepairJobDetailsPage);
    httpTestingController
      .expectOne(
        (request) =>
          request.url === `${environment.apiBaseUrl}/admin/repair-jobs` &&
          request.params.get('requestId') === 'missing-id',
      )
      .flush({ data: { jobs: [], page: 1, limit: 1, total: 0 } });
    harness.detectChanges();

    expect(harness.routeNativeElement?.textContent).toContain('Repair job could not be found.');
  });
});
