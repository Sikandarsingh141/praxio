import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth.service';
import { JobSharedService } from '../../shared/services/job-shared.service';
import { CustomerPortalService } from '../services/customer-portal.service';
import { CustomerRepairJobPage } from './customer-repair-job.page';
import { buildRepairProgressSteps } from '../../shared/utils/repair-progress.util';

import { CustomerRepairRequest } from '../models/customer-portal.models';

describe('CustomerRepairJobPage', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{
        provide: AuthService,
        useValue: {
          currentUser: () => ({
            id: 'customer-id',
            email: 'nancy@example.test',
            firstName: 'Nancy',
            lastName: 'Sharma',
            profileImageUrl: 'Y3VzdG9tZXI=',
            createdAt: '2026-11-09T15:00:00.000Z',
          }),
        },
      }, {
        provide: JobSharedService,
        useValue: {
          photoAttachments: () => [],
          customerTimeline: () => [],
          customerProgress: (request: CustomerRepairRequest) => {
            const quotation =
              request.acceptedQuotation ??
              request.quotations.find((item) => item.status === 'accepted');
            return buildRepairProgressSteps({
              requestCreatedAt: request.createdAt,
              requestStatus: request.status,
              quotationStatus: quotation
                ? 'accepted'
                : request.quotations.length
                  ? 'submitted'
                  : 'none',
              acceptedAt: quotation?.respondedAt,
              quotationAt: quotation?.createdAt,
              requiresPhysicalPickup: quotation?.requiresPhysicalPickup,
              inspectionCompletedBeforeQuotation:
                quotation?.inspectionCompletedBeforeQuotation,
              repairJob: request.repairJob,
            });
          },
        },
      }],
    });
  });

  it('moves an approved inspection estimate into the repair step', async () => {
    const requestId = 'request-id';
    const portal = jasmine.createSpyObj<CustomerPortalService>(
      'CustomerPortalService',
      ['getRepairJob'],
    );
    portal.getRepairJob.and.returnValue(of({} as CustomerRepairRequest));

    await TestBed.configureTestingModule({
      imports: [CustomerRepairJobPage],
      providers: [
        provideRouter([]),
        { provide: CustomerPortalService, useValue: portal },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => requestId } } },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CustomerRepairJobPage);
    const page = fixture.componentInstance;
    page.job.set({
      _id: requestId,
      appliance: 'Air conditioner',
      description: 'Not cooling',
      status: 'open',
      createdAt: '2026-11-09T15:00:00.000Z',
      quotations: [],
      shopIds: [],
      acceptedQuotation: {
        _id: 'quote-id',
        repairRequestId: requestId,
        shopId: 'shop-id',
        amount: 0,
        currency: 'USD',
        message: 'Inspection required.',
        status: 'accepted',
        createdAt: '2026-11-09T15:00:00.000Z',
      },
      repairJob: { status: 'inspection_approved', requiresPhysicalPickup: false },
    } as CustomerRepairRequest);

    expect(page.repairProgressSteps().find((step) => step.current)?.label).toBe('Repair');
  });

  it('marks every progress step complete for a completed repair', async () => {
    const requestId = 'request-id';
    const request = {
      _id: requestId,
      appliance: 'Air conditioner',
      description: 'Not cooling',
      status: 'completed',
      createdAt: '2026-11-09T15:00:00.000Z',
      quotations: [],
      shopIds: [],
      acceptedQuotation: {
        _id: 'quote-id',
        repairRequestId: requestId,
        shopId: 'shop-id',
        amount: 0,
        currency: 'USD',
        message: 'Repair approved.',
        status: 'accepted',
        createdAt: '2026-11-09T16:00:00.000Z',
        respondedAt: '2026-11-09T16:30:00.000Z',
      },
      repairJob: {
        status: 'completed',
        requiresPhysicalPickup: false,
        confirmedAt: '2026-11-09T15:30:00.000Z',
        repairCompletedAt: '2026-11-10T12:00:00.000Z',
        history: [
          { action: 'inspection_pending', at: '2026-11-09T15:35:00.000Z' },
          { action: 'repair_completed', at: '2026-11-10T12:05:00.000Z' },
        ],
      },
    } as CustomerRepairRequest;
    const portal = jasmine.createSpyObj<CustomerPortalService>(
      'CustomerPortalService',
      ['getRepairJob'],
    );
    portal.getRepairJob.and.returnValue(of(request));

    await TestBed.configureTestingModule({
      imports: [CustomerRepairJobPage],
      providers: [
        provideRouter([]),
        { provide: CustomerPortalService, useValue: portal },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => requestId } } },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CustomerRepairJobPage);
    fixture.detectChanges();

    const steps = Array.from(
      fixture.nativeElement.querySelectorAll('.request-progress li'),
    ) as HTMLLIElement[];
    expect(steps.map((step) => step.querySelector('strong')?.textContent?.trim())).toEqual([
      'Request Submitted',
      'Quotation Accepted',
      'Inspection',
      'Repair',
      'Ready for Pickup',
      'Customer Picked Up',
      'Completed',
    ]);
    expect(fixture.nativeElement.querySelector('.request-progress')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.progress-marker svg')).toHaveSize(7);
    expect(steps.every((step) => step.classList.contains('completed'))).toBeTrue();
    expect(fixture.nativeElement.querySelector('[aria-current="step"]')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.request-progress time').length).toBeGreaterThan(0);
    const requestIdBadge = fixture.nativeElement.querySelector(
      '.request-hero-copy .request-id',
    ) as HTMLElement;
    const disputeLink = fixture.nativeElement.querySelector(
      '.request-hero-copy .dispute-link',
    ) as HTMLAnchorElement;
    expect(disputeLink).not.toBeNull();
    expect(disputeLink.href).toContain('/customer/disputes/new/');
    expect(requestIdBadge.textContent).toContain('Request ID');
    expect(fixture.nativeElement.querySelector('.detail-status')).not.toBeNull();
    const progress = fixture.componentInstance.repairProgressSteps();
    expect(progress.find((step) => step.key === 'inspection')?.at).toBe(
      '2026-11-09T15:35:00.000Z',
    );
    expect(progress.find((step) => step.key === 'repair')?.at).toBe(
      '2026-11-10T12:05:00.000Z',
    );
  });

  it('does not imply repair authorization when a quotation is accepted', async () => {
    const requestId = 'request-id';
    const portal = jasmine.createSpyObj<CustomerPortalService>(
      'CustomerPortalService',
      ['getRepairJob'],
    );
    portal.getRepairJob.and.returnValue(of({} as CustomerRepairRequest));

    await TestBed.configureTestingModule({
      imports: [CustomerRepairJobPage],
      providers: [
        provideRouter([]),
        { provide: CustomerPortalService, useValue: portal },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => requestId } } },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CustomerRepairJobPage);
    const page = fixture.componentInstance;
    page.job.set({
      _id: requestId,
      appliance: 'Air conditioner',
      description: 'Not cooling',
      status: 'open',
      createdAt: '2026-11-09T15:00:00.000Z',
      quotations: [],
      shopIds: [],
      acceptedQuotation: {
        _id: 'quote-id',
        repairRequestId: requestId,
        shopId: 'shop-id',
        amount: 0,
        currency: 'USD',
        message: 'Inspection required.',
        status: 'accepted',
        createdAt: '2026-11-09T15:00:00.000Z',
      },
      repairJob: { status: 'inspection_pending' },
    } as CustomerRepairRequest);

    const confirmedEntry = page.timeline.find(
      (entry) => entry.action === 'confirmed',
    );
    expect(confirmedEntry?.label).not.toContain('repair confirmed');
    expect(confirmedEntry?.label).toBe('Quotation accepted');
  });
  it('renders request details and selected shops from the loaded repair request', async () => {
    const request = {
      _id: 'request-id-12345678',
      shopIds: ['shop-1'],
      appliance: 'Air conditioner',
      brand: 'Fixroa',
      model: 'AC-100',
      description: 'Not cooling',
      preferredServiceDate: '2026-11-10T00:00:00.000Z',
      serviceType: 'shop_visit' as const,
      status: 'open' as const,
      createdAt: '2026-11-09T15:00:00.000Z',
      quotations: [],
      shops: [{ id: 'shop-1', name: 'Amit Sharma', responseStatus: 'new' }],
    };
    const portal = jasmine.createSpyObj<CustomerPortalService>('CustomerPortalService', [
      'getRepairJob',
    ]);
    portal.getRepairJob.and.returnValue(of(request));

    await TestBed.configureTestingModule({
      imports: [CustomerRepairJobPage],
      providers: [
        provideRouter([]),
        {
          provide: CustomerPortalService,
          useValue: portal,
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => request._id } } },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CustomerRepairJobPage);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(portal.getRepairJob).toHaveBeenCalledWith(request._id);
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain(
      'New Repair Request Detail',
    );
    expect(text).not.toContain('REPAIR REQUEST DETAILS');
    expect(text).toContain('Request ID:');
    expect(text).toContain('12345678');
    expect(text).toContain('Problem Description');
    expect(text).toContain('Not cooling');
    expect(text).toContain('Preferred Date');
    expect(text).toContain('Shop visit');
    expect(text).toContain('Shop visit');
    expect(text).toContain('Amit Sharma');
    expect(text).toContain('AS');
    expect(
      fixture.nativeElement.querySelector('.customer-identity img')?.getAttribute('src'),
    ).toBe('data:image/jpeg;base64,Y3VzdG9tZXI=');
    expect(text).toContain('View Quotations');
    expect(text).toContain('Repair History');
    expect(text).toContain('Location and Route');
    expect(text).toContain('Quotation');
    expect(fixture.nativeElement.querySelector('.detail-status')?.textContent).toContain('New');
  });

  it('creates a driving directions link for the assigned shop', async () => {
    const request = {
      _id: 'request-id-12345678',
      shopIds: ['shop-1'],
      appliance: 'Air conditioner',
      description: 'Not cooling',
      serviceType: 'shop_visit' as const,
      status: 'open' as const,
      createdAt: '2026-11-09T15:00:00.000Z',
      quotations: [],
      shops: [],
      shop: {
        id: 'shop-1',
        name: 'Repair Shop',
        address: 'Sector 70, Mohali, Punjab',
        phone: null,
        email: 'shop@example.test',
      },
    };
    const portal = jasmine.createSpyObj<CustomerPortalService>('CustomerPortalService', [
      'getRepairJob',
    ]);
    portal.getRepairJob.and.returnValue(of(request));

    await TestBed.configureTestingModule({
      imports: [CustomerRepairJobPage],
      providers: [
        provideRouter([]),
        { provide: CustomerPortalService, useValue: portal },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => request._id } } },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CustomerRepairJobPage);
    fixture.detectChanges();

    const directionsLink: HTMLAnchorElement | null =
      fixture.nativeElement.querySelector('.map-directions-button');
    expect(directionsLink?.href).toContain(
      'destination=Sector%2070%2C%20Mohali%2C%20Punjab',
    );
    expect(directionsLink?.href).toContain('travelmode=driving');
  });
});
