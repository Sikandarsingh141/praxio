import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { CustomerPortalService } from './customer-portal.service';
import { CustomerRepairJobPage } from './customer-repair-job.page';

import { CustomerRepairRequest } from './customer-portal.models';

describe('CustomerRepairJobPage', () => {
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
      repairJob: { status: 'inspection_approved' },
    } as CustomerRepairRequest);

    expect(page.currentProgressStep).toBe(4);
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
    expect(steps).toHaveSize(4);
    expect(getComputedStyle(fixture.nativeElement.querySelector('.request-progress')).display).toBe(
      'grid',
    );
    expect(fixture.nativeElement.querySelectorAll('.progress-marker svg')).toHaveSize(4);
    expect(steps.every((step) => step.classList.contains('completed'))).toBeTrue();
    expect(fixture.nativeElement.querySelector('[aria-current="step"]')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.request-progress time')).toHaveSize(4);
    const requestIdBadge = fixture.nativeElement.querySelector(
      '.request-header-meta .request-id',
    ) as HTMLElement;
    const disputeLink = fixture.nativeElement.querySelector(
      '.job-header-actions .dispute-link',
    ) as HTMLElement;
    expect(disputeLink).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('.request-header-meta .dispute-link'),
    ).toBeNull();
    expect(fixture.nativeElement.querySelector('.job-header-actions .status-badge')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.request-meta-divider')).toBeNull();
    expect(parseFloat(getComputedStyle(requestIdBadge).minHeight)).toBeLessThan(
      parseFloat(getComputedStyle(disputeLink).minHeight),
    );
    expect(
      getComputedStyle(fixture.nativeElement.querySelector('.request-header-meta')).display,
    ).toBe('flex');
    expect(
      getComputedStyle(fixture.nativeElement.querySelector('.job-header-actions')).flexDirection,
    ).toBe('column');
    expect(
      getComputedStyle(fixture.nativeElement.querySelector('.request-summary-card .details dt'))
        .display,
    ).toBe('flex');
    expect(fixture.componentInstance.progressDate(1)).toBe('2026-11-09T15:35:00.000Z');
    expect(fixture.componentInstance.progressDate(3)).toBe('2026-11-10T12:05:00.000Z');
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
      'Repair request details',
    );
    expect(text).not.toContain('REPAIR REQUEST DETAILS');
    expect(text).toContain('Request ID:');
    expect(text).toContain('12345678');
    expect(text).toContain('Issue / Problem');
    expect(text).toContain('Not cooling');
    expect(text).toContain('Preferred Date');
    expect(text).toContain('Shop visit');
    expect(text).toContain('Shop Visit');
    expect(text).toContain('No (At shop)');
    expect(text).toContain('Amit Sharma');
    expect(text).toContain('AS');
    expect(text).toContain('View Quotations');
    expect(text).toContain('Repair Information');
    expect(text).toContain('Route to Repair Shop');
    expect(text).toContain('Pending Inspection');
    expect(fixture.nativeElement.querySelector('.status-badge')?.textContent).toContain('Open');
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
