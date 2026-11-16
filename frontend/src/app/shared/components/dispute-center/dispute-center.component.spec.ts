import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { CustomerPortalService } from '../../../customer/services/customer-portal.service';
import { RepairDispute } from '../../models/disputes.models';
import { DisputesService } from '../../services/disputes.service';
import { DisputeCenterComponent } from './dispute-center.component';

describe('DisputeCenterComponent customer views', () => {
  it('keeps dispute summaries and the raise-dispute action in the redesigned listing', async () => {
    const dispute = {
      _id: 'dispute-id',
      reference: 'DSP-1001',
      repairRequestId: 'repair-request-12345678',
      customerId: 'customer-id',
      shopId: 'shop-id',
      category: 'repair_quality',
      subject: 'Repair issue',
      description: 'The device still does not cool.',
      expectedResolution: 'Repair the cooling issue.',
      attachments: [],
      status: 'OPEN',
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
      createdAt: '2026-11-17T00:00:00.000Z',
      updatedAt: '2026-11-17T00:00:00.000Z',
      parties: {
        customer: { id: 'customer-id', name: 'Customer' },
        shop: { id: 'shop-id', name: 'Repair Shop' },
      },
      repair: {
        id: 'repair-id',
        appliance: 'Air conditioner',
        brand: 'Fixroa',
        model: 'AC-100',
        description: 'Not cooling',
        photos: [],
        status: 'completed',
        createdAt: '2026-11-10T00:00:00.000Z',
      },
    } as RepairDispute;
    const disputes = jasmine.createSpyObj<DisputesService>('DisputesService', ['list']);
    disputes.list.and.returnValue(
      of({
        items: [dispute],
        pagination: { page: 1, limit: 10, total: 11, totalPages: 2 },
        summary: { TOTAL: 1, OPEN: 1, UNDER_REVIEW: 0, RESOLVED: 0, CLOSED: 0 },
      }),
    );

    await TestBed.configureTestingModule({
      imports: [DisputeCenterComponent],
      providers: [
        provideRouter([]),
        { provide: DisputesService, useValue: disputes },
        { provide: CustomerPortalService, useValue: { getRepairJob: jasmine.createSpy() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DisputeCenterComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Total Disputes');
    expect(text).toContain('Under Review');
    expect(text).toContain('Closed / Resolved');
    expect(fixture.nativeElement.querySelector('.raise-dispute-button')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.customer-dispute-table')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-job-pagination')).not.toBeNull();
    expect(text).toContain('Request ID');
    expect(
      fixture.nativeElement.querySelector('.dispute-request-id-cell strong')?.textContent,
    ).toContain('#12345678');
    expect(fixture.nativeElement.querySelector('.dispute-action-menu summary')).not.toBeNull();
    expect(
      (fixture.nativeElement.querySelector('.dispute-action-popup a') as HTMLAnchorElement).href,
    ).toContain('/customer/disputes/dispute-id');

    fixture.componentInstance.role.set('shop');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.raise-dispute-button')).toBeNull();
    expect(fixture.nativeElement.querySelector('.customer-dispute-table')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-job-pagination')).not.toBeNull();
    expect(
      (fixture.nativeElement.querySelector('.dispute-action-popup a') as HTMLAnchorElement).href,
    ).toContain('/shop/disputes/dispute-id');
  });

  it('shows dispute history and resolution details in the completed-job detail layout', async () => {
    const dispute = {
      _id: 'dispute-id',
      reference: 'DSP-2001',
      repairRequestId: 'repair-request-12345678',
      customerId: 'customer-id',
      shopId: 'shop-id',
      category: 'repair_quality',
      subject: 'Cooling issue remains',
      description: 'The device still does not cool.',
      expectedResolution: 'Repair the cooling issue.',
      attachments: [],
      status: 'CLOSED',
      priority: 'high',
      messages: [],
      statusHistory: [
        {
          from: 'NONE',
          to: 'OPEN',
          actorRole: 'customer',
          at: '2026-11-10T00:00:00.000Z',
        },
        {
          from: 'OPEN',
          to: 'CLOSED',
          actorRole: 'shop',
          at: '2026-11-17T00:00:00.000Z',
        },
      ],
      resolution: {
        state: 'final',
        type: 'repair_again',
        description: 'Repeat the repair.',
        completionNotes: 'The repair was completed.',
        documents: [],
        completionDocuments: [],
        requiredActionCompleted: true,
      },
      reinspections: [],
      additionalCharges: [],
      reworkProgress: [],
      reworkCompletions: [],
      verificationHistory: [],
      createdAt: '2026-11-10T00:00:00.000Z',
      updatedAt: '2026-11-17T00:00:00.000Z',
      disputeClosedAt: '2026-11-17T00:00:00.000Z',
      parties: {
        customer: { id: 'customer-id', name: 'Customer', email: 'customer@example.com' },
        shop: { id: 'shop-id', name: 'Repair Shop', email: 'shop@example.com' },
      },
      repair: {
        id: 'repair-id',
        appliance: 'Air conditioner',
        brand: 'Fixroa',
        model: 'AC-100',
        description: 'Not cooling',
        photos: [],
        status: 'completed',
        createdAt: '2026-11-01T00:00:00.000Z',
      },
    } as RepairDispute;
    const disputes = jasmine.createSpyObj<DisputesService>('DisputesService', ['get']);
    disputes.get.and.returnValue(of(dispute));

    await TestBed.configureTestingModule({
      imports: [DisputeCenterComponent],
      providers: [
        provideRouter([{ path: 'customer/disputes/:id', component: DisputeCenterComponent }]),
        { provide: DisputesService, useValue: disputes },
        { provide: CustomerPortalService, useValue: { getRepairJob: jasmine.createSpy() } },
      ],
    }).compileComponents();

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/customer/disputes/dispute-id', DisputeCenterComponent);
    harness.detectChanges();

    const page = harness.routeNativeElement as HTMLElement;
    const text = page.textContent as string;
    expect(page.querySelector('.request-hero')).not.toBeNull();
    expect(page.querySelector('.request-progress')).not.toBeNull();
    expect(page.querySelector('.customer-detail-layout')).not.toBeNull();
    expect(page.querySelector('.customer-detail-sidebar')).not.toBeNull();
    expect(text).toContain('#12345678');
    expect(text).toContain('Expected Resolution');
    expect(text).toContain('Resolution Details');
    expect(text).toContain('The device still does not cool.');
    expect(text).toContain('The repair was completed.');
  });
});
