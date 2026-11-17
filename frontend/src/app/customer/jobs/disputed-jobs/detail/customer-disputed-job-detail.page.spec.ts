import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { JobSharedService } from '../../../../shared/services/job-shared.service';
import { RepairDispute } from '../../../../shared/models/disputes.models';
import { DisputesService } from '../../../../shared/services/disputes.service';
import { CustomerDisputedJobDetailPage } from './customer-disputed-job-detail.page';

describe('CustomerDisputedJobDetailPage', () => {
  it('shows the active-job detail layout and dispute-specific information', async () => {
    const dispute: RepairDispute = {
      _id: 'dispute-123',
      reference: 'DSP-123',
      repairRequestId: 'request-45678901',
      customerId: 'customer-1',
      shopId: 'shop-1',
      category: 'repair_quality',
      subject: 'Repair issue',
      description: 'The repaired device still does not work.',
      expectedResolution: 'Repair the device correctly.',
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
      updatedAt: '2025-01-02T10:00:00.000Z',
      parties: {
        customer: { id: 'customer-1', name: 'Customer One', email: 'customer@example.com' },
        shop: { id: 'shop-1', name: 'Repair Shop', email: 'shop@example.com' },
      },
      repair: {
        id: 'request-45678901',
        appliance: 'Phone',
        brand: 'Example',
        model: 'Model One',
        description: 'Screen replacement',
        photos: [],
        status: 'in_progress',
        createdAt: '2024-12-20T10:00:00.000Z',
        quotation: null,
      },
    };

    const disputes = jasmine.createSpyObj<DisputesService>('DisputesService', ['get']);
    disputes.get.and.returnValue(of(dispute));

    await TestBed.configureTestingModule({
      imports: [CustomerDisputedJobDetailPage],
      providers: [
        provideRouter([
          { path: 'customer/jobs/disputed-jobs/:id', component: CustomerDisputedJobDetailPage },
        ]),
        { provide: DisputesService, useValue: disputes },
        {
          provide: JobSharedService,
          useValue: { errorMessage: jasmine.createSpy().and.returnValue('Unable to load details.') },
        },
      ],
    }).compileComponents();

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      '/customer/jobs/disputed-jobs/dispute-123',
      CustomerDisputedJobDetailPage,
    );

    const page = harness.routeNativeElement as HTMLElement;
    const text = page.textContent ?? '';
    expect(page.querySelector('.request-hero')).not.toBeNull();
    expect(page.querySelector('.request-progress')).not.toBeNull();
    expect(page.querySelector('.customer-detail-layout')).not.toBeNull();
    expect(text).toContain('Issue Resolution Details');
    expect(text).toContain('Dispute Description');
    expect(text).toContain('The repaired device still does not work.');
    expect(text).toContain('Repair Shop');
    expect(text).not.toContain('Open customer dispute page for permitted actions');
    expect(page.querySelector('.dispute-actions-link')).toBeNull();
    expect(disputes.get).toHaveBeenCalledWith('customer', 'dispute-123');
  });
});
