import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ShopProfile } from '../../core/auth/auth.models';
import { ShopRepairRequest } from '../repair-requests/shop-repair-requests.models';
import { ShopRepairRequestsService } from '../repair-requests/shop-repair-requests.service';
import { JobSharedService } from '../../shared/services/job-shared.service';
import { ShopRepairRequestDetailsPage } from './shop-repair-request-details.page';
import { TechniciansService } from '../technicians/technicians.service';

describe('ShopRepairRequestDetailsPage directions', () => {
  it('does not label pre-repair statuses as complete', () => {
    const fixture = TestBed.createComponent(ShopRepairRequestDetailsPage);
    fixture.detectChanges();

    for (const status of [
      'inspection_pending',
      'awaiting_customer_approval',
      'inspection_approved',
    ] as const) {
      fixture.componentInstance.setRequest({
        ...request,
        repairJob: { status },
      });
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).not.toContain(
        'This repair is complete.',
      );
    }

    fixture.componentInstance.setRequest({
      ...request,
      repairJob: { status: 'completed' },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'This repair is complete.',
    );
  });

  const request: ShopRepairRequest = {
    _id: 'request-id',
    appliance: 'Washing machine',
    description: 'The appliance needs repair.',
    customerLatitude: 30.7,
    customerLongitude: 76.7,
    photos: [],
    status: 'open',
    createdAt: '2026-11-12T00:00:00.000Z',
    customer: {
      firstName: 'Ava',
      lastName: 'Customer',
      displayName: 'Ava Customer',
      location: { latitude: 30.7, longitude: 76.7 },
    },
    shopResponse: { status: 'new' },
    quotations: [],
  };
  const shopProfile: ShopProfile = {
    shopName: 'Fixora Shop',
    businessType: 'Appliance repair',
    description: 'Repair services',
    yearsOfExperience: 5,
    ownerFirstName: 'Sam',
    ownerLastName: 'Shop',
    email: 'shop@example.test',
    countryCode: '+91',
    mobileNumber: '9876543210',
    address: 'Sector 70',
    city: 'Mohali',
    state: 'Punjab',
    postalCode: '160062',
    landmark: '',
    location: { latitude: 30.72, longitude: 76.72 },
    businessAddress: 'Sector 70, Mohali',
    services: [],
    subscriptionPlan: 'Fixroa Shop monthly subscription',
    subscriptionAmountCents: 0,
    subscriptionCurrency: 'usd',
    paymentStatus: 'paid',
    registrationStatus: 'approved',
    accountLifecycleStatus: 'active',
    submittedAt: null,
    adminApprovalStatus: 'approved',
    declineReason: null,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShopRepairRequestDetailsPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: request._id }),
              data: { jobStatus: 'assigned' },
            },
          },
        },
        {
          provide: ShopRepairRequestsService,
          useValue: {
            get: jasmine.createSpy().and.returnValue(of(request)),
            getDirections: jasmine
              .createSpy()
              .and.returnValue(
                throwError(() => ({ error: { message: 'Directions service unavailable.' } })),
              ),
            startRepair: jasmine.createSpy().and.returnValue(of(request)),
            holdRepair: jasmine.createSpy().and.returnValue(of(request)),
            completeRepair: jasmine.createSpy().and.returnValue(of(request)),
            readyForPickup: jasmine.createSpy().and.returnValue(of(request)),
          },
        },
        {
          provide: JobSharedService,
          useValue: { shopTimeline: jasmine.createSpy().and.returnValue([]) },
        },
        {
          provide: AuthService,
          useValue: { getMyShopProfile: jasmine.createSpy().and.returnValue(of(shopProfile)) },
        },
        {
          provide: TechniciansService,
          useValue: {
            list: jasmine.createSpy().and.returnValue(of({ technicians: [], summary: {} })),
            assign: jasmine.createSpy().and.returnValue(of({ warning: null })),
            unassign: jasmine.createSpy().and.returnValue(of(undefined)),
          },
        },
      ],
    }).compileComponents();
  });

  it('shows the request progress design and directions without invented route metrics', () => {
    const fixture = TestBed.createComponent(ShopRepairRequestDetailsPage);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(fixture.nativeElement.querySelector('main.customer-active-job-detail-page')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.request-hero')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.customer-detail-layout')).not.toBeNull();
    const directionsLink: HTMLAnchorElement | null =
      fixture.nativeElement.querySelector('.directions-button[href]');

    expect(directionsLink?.href).toContain('origin=30.72,76.72');
    expect(directionsLink?.href).toContain('destination=30.7,76.7');
    expect(directionsLink?.href).toContain('travelmode=driving');
    expect(text).toContain('View on Map');
    expect(text).toContain('Get Directions');
    expect(text).toContain('Directions service unavailable.');
    expect(text).toContain('Inspection Pending');
    expect(text).toContain('Initial Diagnosis');
    expect(text).toContain('Pending Inspection');
    expect(text).not.toContain('4.8 km');
    expect(text).not.toContain('12 min');
  });

  it('keeps new-request shop actions in the customer-matched detail layout', () => {
    const fixture = TestBed.createComponent(ShopRepairRequestDetailsPage);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(fixture.nativeElement.querySelector('.customer-detail-layout')).not.toBeNull();
    expect(text).toContain('Customer Information');
    expect(text).toContain('Device Information');
    expect(text).toContain('Submit Quotation');
    expect(text).toContain('Decline Request');
    expect(text).toContain(
      'Please review the request and choose to submit a quotation or decline it.',
    );
    expect(text.indexOf('Submit Quotation')).toBeLessThan(
      text.indexOf('Device Information'),
    );
    expect(text.indexOf('Decline Request')).toBeLessThan(
      text.indexOf('Device Information'),
    );
    expect(
      fixture.nativeElement
        .querySelector('.request-response-actions')
        ?.closest('.customer-detail-sidebar-card'),
    ).not.toBeNull();
  });

  it('uses the assigned-jobs context when opened from that stage', () => {
    const fixture = TestBed.createComponent(ShopRepairRequestDetailsPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Assigned Request Details');
    const backLink: HTMLAnchorElement | null = fixture.nativeElement.querySelector('.back-link');
    expect(backLink?.getAttribute('href')).toBe('/shop/jobs/assigned-jobs');
  });

  it('renders quotation details in the redesigned summary table', () => {
    const fixture = TestBed.createComponent(ShopRepairRequestDetailsPage);
    fixture.detectChanges();
    fixture.componentInstance.setRequest({
      ...request,
      quotations: [
        {
          _id: 'quotation-1',
          repairRequestId: request._id,
          amount: 1000,
          currency: 'INR',
          message: 'Inspection and service',
          estimatedDays: 3,
          status: 'sent',
          createdAt: '2026-11-12T00:00:00.000Z',
        },
      ],
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Quotation Details');
    expect(text).toContain('QTN-001');
    expect(text).toContain('Fixora Shop');
    expect(text).toContain('Inspection and service');
    expect(text).toContain('View Details');
  });

  it('does not offer directions when the customer location is missing', () => {
    const fixture = TestBed.createComponent(ShopRepairRequestDetailsPage);
    fixture.detectChanges();
    fixture.componentInstance.setRequest({
      ...request,
      customer: { ...request.customer, location: null },
      customerLatitude: undefined,
      customerLongitude: undefined,
    });
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('.directions-button[href]'),
    ).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('A valid shop and customer location');
    expect(fixture.nativeElement.querySelector('.directions-button.disabled')).not.toBeNull();
  });

  it('supports multiple quotation activities and requires details when Other is selected', () => {
    const fixture = TestBed.createComponent(ShopRepairRequestDetailsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.quotationOpen.set(true);
    component.quotationSummaryOpen.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('input[name="quotationSummarySearch"]')).not.toBeNull();
    const options: HTMLElement | null = fixture.nativeElement.querySelector('.quotation-options');
    expect(options).not.toBeNull();
    expect(getComputedStyle(options!).position).toBe('static');
    expect(getComputedStyle(options!).overflowY).toBe('visible');

    component.quotationSummarySearch.set('battery');
    expect(component.filteredQuotationSummaries().map((option) => option)).toEqual([
      'Battery Replacement',
    ]);

    component.toggleQuotationSummary('General Repair');
    component.toggleQuotationSummary('Other');
    fixture.detectChanges();

    expect(component.quotationSummaries()).toEqual(['General Repair', 'Other']);
    expect(fixture.nativeElement.querySelectorAll('.quotation-chip').length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Additional Repair Details');

    component.quotationAmount.set(1000);
    component.completionDays.set(3);
    component.quotationAttempted.set(true);
    expect(component.isQuotationValid()).toBeFalse();

    component.additionalRepairDetails.set('Board-level repair');
    expect(component.isQuotationValid()).toBeTrue();
    expect(component.quotationProposedSolution()).toBe('General Repair, Other');
    expect(component.quotationMessage()).toBe('Board-level repair');
  });

  it('supports completion multi-select, Other, dynamic parts, and preserves the API contract', () => {
    const fixture = TestBed.createComponent(ShopRepairRequestDetailsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.setRequest({
      ...request,
      repairJob: { status: 'in_progress' },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.completion-action button')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.completion-modal-backdrop')).toBeNull();

    component.openCompletionModal();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.completion-modal-backdrop')).not.toBeNull();
    expect(
      fixture.nativeElement
        .querySelector('textarea[name="completionDescription"]')
        ?.getAttribute('placeholder'),
    ).toBe('Summarize the completed repair.');
    expect(
      fixture.nativeElement
        .querySelector('textarea[name="finalNotes"]')
        ?.getAttribute('placeholder'),
    ).toBe('Add any final notes for the customer.');

    component.workPerformedSearch.set('battery');
    expect(component.filteredWorkPerformedOptions()).toEqual(['Battery Replacement']);

    component.toggleWorkPerformedOption('Battery Replacement');
    component.toggleWorkPerformedOption('Other');
    component.workPerformedOther.set('Board-level solder repair');
    fixture.detectChanges();

    expect(component.workPerformedSelections()).toEqual(['Battery Replacement', 'Other']);
    expect(fixture.nativeElement.querySelectorAll('.completion-chip').length).toBe(2);
    expect(fixture.nativeElement.querySelector('input[name="workPerformedOther"]')).not.toBeNull();

    component.updateReplacedPartName(0, 'Battery');
    component.updateReplacedPartQuantity(0, 2);
    component.addReplacedPart();
    component.updateReplacedPartName(1, 'Charging port');
    fixture.detectChanges();

    expect(component.partsReplacedValue()).toBe('Battery × 2, Charging port × 1');
    expect(fixture.nativeElement.querySelectorAll('.completion-part-row').length).toBe(2);

    component.completionDescription.set('Device repaired and tested.');
    component.finalNotes.set('Customer should keep it dry.');
    fixture.detectChanges();
    expect(component.isCompletionValid()).toBeTrue();

    component.completeRepair();
    const completeRepairSpy = TestBed.inject(ShopRepairRequestsService).completeRepair as jasmine.Spy;
    expect(completeRepairSpy).toHaveBeenCalledWith(request._id, {
      completionDescription: 'Device repaired and tested.',
      workPerformed: 'Battery Replacement, Other: Board-level solder repair',
      partsReplaced: 'Battery × 2, Charging port × 1',
      finalNotes: 'Customer should keep it dry.',
    });
    expect(component.completionModalOpen()).toBeFalse();
  });

  it('opens a pickup popup and keeps the ready-for-pickup API payload', () => {
    const fixture = TestBed.createComponent(ShopRepairRequestDetailsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.setRequest({
      ...request,
      repairJob: { status: 'repair_completed' },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.pickup-action button')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#pickup-dialog-title')).toBeNull();

    component.openPickupModal();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#pickup-dialog-title')?.textContent).toContain(
      'Mark Ready for Pickup',
    );
    expect(
      fixture.nativeElement
        .querySelector('textarea[name="pickupInstructions"]')
        ?.getAttribute('placeholder'),
    ).toBe('Shop address, hours, or pickup requirements');

    component.pickupInstructions.set('Collect from Sector 70, 10 AM to 6 PM.');
    component.pickupMessage.set('Please bring the receipt.');
    fixture.detectChanges();

    component.markReadyForPickup();
    const readySpy = TestBed.inject(ShopRepairRequestsService).readyForPickup as jasmine.Spy;
    expect(readySpy).toHaveBeenCalledWith(request._id, {
      pickupInstructions: 'Collect from Sector 70, 10 AM to 6 PM.',
      message: 'Please bring the receipt.',
    });
    expect(component.pickupModalOpen()).toBeFalse();
  });
});
