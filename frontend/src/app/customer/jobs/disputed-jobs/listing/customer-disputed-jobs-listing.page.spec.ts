import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { AdminService } from '../../../../admin/services/admin.service';
import { CustomerPortalService } from '../../../services/customer-portal.service';
import { DisputeListResult } from '../../../../shared/models/disputes.models';
import { DisputesService } from '../../../../shared/services/disputes.service';
import { CustomerRepairRequest } from '../../../models/customer-portal.models';
import { CustomerDisputedJobsListingPage } from './customer-disputed-jobs-listing.page';

const eligibleRepairRequest = (): CustomerRepairRequest => ({
  _id: '507f1f77bcf86cd7099f4b67bb',
  shopIds: ['shop-id'],
  appliance: 'Mobile Phone',
  description: 'Screen still does not work',
  status: 'completed',
  createdAt: '2026-11-17T00:00:00.000Z',
  acceptedQuotationId: 'quotation-1',
  quotations: [
    {
      _id: 'quotation-1',
      repairRequestId: '507f1f77bcf86cd7099f4b67bb',
      shopId: 'shop-id',
      amount: 450,
      currency: 'INR',
      message: 'Replace the display panel.',
      status: 'accepted',
      createdAt: '2026-11-17T00:00:00.000Z',
    },
  ],
  repairJob: { status: 'completed', acceptedQuotationId: 'quotation-1' },
});

describe('CustomerDisputedJobsListingPage', () => {
  it('uses the dispute listing and opens the active-style dispute route', async () => {
    const disputes = jasmine.createSpyObj<DisputesService>('DisputesService', ['list']);
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
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        summary: { TOTAL: 0, OPEN: 0, UNDER_REVIEW: 0, RESOLVED: 0, CLOSED: 0 },
      } satisfies DisputeListResult),
    );

    await TestBed.configureTestingModule({
      imports: [CustomerDisputedJobsListingPage],
      providers: [
        provideRouter([
          { path: 'customer/jobs/disputed-jobs', component: CustomerDisputedJobsListingPage },
        ]),
        { provide: DisputesService, useValue: disputes },
        { provide: AdminService, useValue: { getMapRoute: jasmine.createSpy() } },
        {
          provide: CustomerPortalService,
          useValue: {
            getRepairJob: jasmine.createSpy(),
            getRepairRequests: jasmine.createSpy().and.returnValue(of([eligibleRepairRequest()])),
          },
        },
      ],
    }).compileComponents();

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/customer/jobs/disputed-jobs', CustomerDisputedJobsListingPage);

    const page = harness.routeNativeElement as HTMLElement;
    const text = page.textContent ?? '';
    expect(page.querySelector('app-dispute-center')).not.toBeNull();
    expect(text).toContain('Disputes');
    expect(text).toContain('Total Disputes');
    expect(text).toContain('Raise a Dispute');
    const detailsLink = page.querySelector(
      '.dispute-action-popup a',
    ) as HTMLAnchorElement | null;
    expect(detailsLink?.getAttribute('href')).toBe('/customer/jobs/disputed-jobs/dispute-1');
    expect(disputes.list).toHaveBeenCalledWith(
      'customer',
      jasmine.objectContaining({ page: 1, limit: 10 }),
      jasmine.objectContaining({ silent: false }),
    );
  });
});
