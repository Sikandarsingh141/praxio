import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { AdminService } from '../../../../admin/services/admin.service';
import { CustomerPortalService } from '../../../../customer/services/customer-portal.service';
import { ShopRepairRequestsService } from '../../../../shop/repair-requests/shop-repair-requests.service';
import { TechniciansService } from '../../../../shop/technicians/technicians.service';
import { DisputeListResult } from '../../../../shared/models/disputes.models';
import { DisputesService } from '../../../../shared/services/disputes.service';
import { DisputeCenterComponent } from '../../../../shared/components/dispute-center/dispute-center.component';

describe('Technician Disputes listing route', () => {
  it('renders the shared dispute table with technician-scoped data', async () => {
    const disputes = jasmine.createSpyObj<DisputesService>('DisputesService', [
      'list',
    ]);
    disputes.list.and.returnValue(
      of({
        items: [
          {
            _id: 'dispute-1',
            reference: 'DSP-001',
            repairRequestId: 'request-1',
            customerId: 'customer-1',
            shopId: 'shop-1',
            category: 'repair_quality',
            subject: 'Repair issue',
            description: 'Issue after repair',
            expectedResolution: 'Fix the issue',
            attachments: [],
            status: 'UNDER_REVIEW',
            priority: 'normal',
            messages: [],
            statusHistory: [],
            resolution: {
              documents: [],
              completionDocuments: [],
              requiredActionCompleted: false,
            },
            reinspections: [],
            additionalCharges: [],
            reworkProgress: [],
            reworkCompletions: [],
            verificationHistory: [],
            createdAt: '2025-01-01T10:00:00.000Z',
            updatedAt: '2025-01-01T10:00:00.000Z',
            parties: {
              customer: { id: 'customer-1', name: 'Customer One' },
              shop: { id: 'shop-1', name: 'Repair Shop' },
            },
          },
        ],
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
        summary: { TOTAL: 1, OPEN: 0, UNDER_REVIEW: 1, RESOLVED: 0, CLOSED: 0 },
      } satisfies DisputeListResult),
    );
    const shop = jasmine.createSpyObj<ShopRepairRequestsService>(
      'ShopRepairRequestsService',
      ['list', 'get', 'getDirections'],
    );
    const technicians = jasmine.createSpyObj<TechniciansService>(
      'TechniciansService',
      ['myJobs', 'myJobDetails', 'myJobDirections', 'assignments'],
    );

    await TestBed.configureTestingModule({
      imports: [DisputeCenterComponent],
      providers: [
        provideRouter([
          {
            path: 'technician/jobs/disputed-jobs',
            component: DisputeCenterComponent,
            data: { accountType: 'technician' },
          },
        ]),
        { provide: DisputesService, useValue: disputes },
        { provide: AdminService, useValue: { getMapRoute: jasmine.createSpy() } },
        { provide: ShopRepairRequestsService, useValue: shop },
        { provide: TechniciansService, useValue: technicians },
        {
          provide: CustomerPortalService,
          useValue: {
            getRepairJob: jasmine.createSpy(),
            getRepairRequests: jasmine.createSpy(),
          },
        },
      ],
    }).compileComponents();

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      '/technician/jobs/disputed-jobs',
      DisputeCenterComponent,
    );

    const page = harness.routeNativeElement as HTMLElement;
    const text = page.textContent ?? '';
    expect(page.querySelector('main.technician-dispute-page')).not.toBeNull();
    expect(page.querySelector('.summary-grid')).not.toBeNull();
    expect(page.querySelector('.dispute-list-controls')).not.toBeNull();
    expect(page.querySelector('.customer-dispute-table')).not.toBeNull();
    expect(text).toContain('Disputes');
    expect(text).toContain('Total Disputes');
    expect(text).toContain('Under Review');
    expect(text).toContain('Issue after repair');
    expect(text).toContain('Repair Shop');
    expect(page.querySelector('app-job-card')).toBeNull();
    expect(
      (page.querySelector('.dispute-action-popup a') as HTMLAnchorElement).href,
    ).toContain('/technician/jobs/disputed-jobs/dispute-1');
    expect(disputes.list).toHaveBeenCalledWith(
      'technician',
      jasmine.objectContaining({ page: 1, limit: 10 }),
      jasmine.objectContaining({ silent: false }),
    );
    expect(shop.list).not.toHaveBeenCalled();
    expect(technicians.myJobs).not.toHaveBeenCalled();
  });
});
