import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
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
      profileImageUrl: 'Y3VzdG9tZXI=',
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
            submitQuotation: jasmine.createSpy().and.returnValue(of(undefined)),
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
    expect(text).toContain('Quotation');
    expect(text).toContain('Initial Diagnosis');
    expect(text).toContain('Pending Inspection');
    expect(text).not.toContain('4.8 km');
    expect(text).not.toContain('12 min');
  });

  it('navigates to the Shop Active Repair Details route after inspection starts', () => {
    const fixture = TestBed.createComponent(ShopRepairRequestDetailsPage);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    fixture.componentInstance.setRequest({
      ...request,
      repairJob: { status: 'inspection_in_progress' },
    });

    fixture.componentInstance.onInspectionStarted();

    expect(navigate).toHaveBeenCalledOnceWith([
      '/shop/jobs/active-jobs',
      request._id,
    ]);
  });

  it('presents the assigned shop owner as a readable technician profile card', () => {
    const fixture = TestBed.createComponent(ShopRepairRequestDetailsPage);
    fixture.detectChanges();
    fixture.componentInstance.setRequest({
      ...request,
      acceptedQuotationId: 'quotation-1',
      technicianAssignment: {
        current: {
          technicianId: 'owner-1',
          assignedAt: '2026-11-19T12:46:16.000Z',
          note: '',
          technicianName: 'Sikandar Shop',
          profileImageData: 'data:image/jpeg;base64,c2hvcA==',
          isOwner: true,
        },
        history: [],
      },
    });
    fixture.detectChanges();

    const assignmentCard = fixture.nativeElement.querySelector(
      '.technician-assignment-card',
    ) as HTMLElement;
    const pickupHost = fixture.nativeElement.querySelector(
      'app-shop-repair-pickup',
    ) as HTMLElement;
    const profileCard = assignmentCard.querySelector('.assigned-technician') as HTMLElement;
    expect(pickupHost.classList.contains('customer-detail-block')).toBeFalse();
    expect(profileCard.querySelector('img')?.getAttribute('alt')).toBe(
      'Sikandar Shop profile photo',
    );
    expect(profileCard.querySelector('.assigned-technician-name')?.textContent).toContain(
      'Sikandar Shop',
    );
    expect(profileCard.querySelector('.assignment-owner-badge')?.textContent?.trim()).toBe(
      'You',
    );
    expect(profileCard.querySelector('time')?.getAttribute('datetime')).toBe(
      '2026-11-19T12:46:16.000Z',
    );
    expect(assignmentCard.textContent).toContain('Reassign Technician');
    expect(
      getComputedStyle(
        assignmentCard.querySelector('.assignment-action-button') as HTMLElement,
      ).whiteSpace,
    ).toBe('nowrap');
  });

  it('keeps the assigned profile readable when technician name or assignment date is missing', () => {
    const fixture = TestBed.createComponent(ShopRepairRequestDetailsPage);
    fixture.detectChanges();
    fixture.componentInstance.setRequest({
      ...request,
      acceptedQuotationId: 'quotation-1',
      technicianAssignment: {
        current: {
          technicianId: 'technician-1',
          assignedAt: '',
          note: '',
          technicianName: '',
          profileImageData: null,
          isOwner: false,
        },
        history: [],
      },
    });
    fixture.detectChanges();

    const assignmentCard = fixture.nativeElement.querySelector(
      '.technician-assignment-card',
    ) as HTMLElement;
    const profileCard = assignmentCard.querySelector('.assigned-technician') as HTMLElement;

    expect(profileCard.querySelector('.assignment-avatar')?.textContent?.trim()).toBe('T');
    expect(profileCard.querySelector('.assigned-technician-name')?.textContent?.trim()).toBe(
      'Assigned technician',
    );
    expect(profileCard.querySelector('.assigned-technician-date')).toBeNull();
  });

  it('places inspection submission in the sidebar and opens the inspection form', () => {
    const fixture = TestBed.createComponent(ShopRepairRequestDetailsPage);
    fixture.detectChanges();
    fixture.componentInstance.setRequest({
      ...request,
      acceptedQuotationId: 'quotation-1',
      repairJob: {
        status: 'inspection_in_progress',
        acceptedQuotationId: 'quotation-1',
        requiresPhysicalPickup: false,
      },
    });
    fixture.detectChanges();

    const sidebar = fixture.nativeElement.querySelector(
      '.customer-detail-sidebar-card',
    ) as HTMLElement;
    const inspectionAction = sidebar.querySelector(
      '.inspection-sidebar-action',
    ) as HTMLElement;
    const workflow = fixture.nativeElement.querySelector('.workflow-panel') as HTMLElement;
    expect(sidebar.textContent).toContain(
      'Complete an inspection report before any repair work begins.',
    );
    expect(inspectionAction.textContent).toContain('Submit Inspection & Request Approval');
    expect(workflow.textContent).not.toContain('Submit Inspection & Request Approval');

    (inspectionAction.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#inspection-form-title')).not.toBeNull();
  });

  it('places approved repair authorization after Technician Assignment in the sidebar', () => {
    const quotation = {
      _id: 'quotation-approved',
      repairRequestId: request._id,
      amount: 3.97,
      currency: 'INR',
      message: 'Repair',
      status: 'accepted' as const,
      createdAt: '2026-11-18T10:00:00.000Z',
    };
    const fixture = TestBed.createComponent(ShopRepairRequestDetailsPage);
    fixture.detectChanges();
    fixture.componentInstance.setRequest({
      ...request,
      acceptedQuotationId: quotation._id,
      shopResponse: { status: 'customer_accepted' },
      quotations: [quotation],
      repairJob: {
        status: 'inspection_approved',
        acceptedQuotationId: quotation._id,
        approvedRepairAmount: 3.97,
        inspection: {
          status: 'approved',
          parts: [],
          partsTotal: 0,
          labourCharge: 0,
          inspectionCharges: 0,
          otherCharges: 0,
          estimatedTotal: 3.97,
          images: [],
          decidedBy: 'customer-1',
        },
      },
    });
    fixture.detectChanges();

    const sidebar = fixture.nativeElement.querySelector(
      '.customer-detail-sidebar-card',
    ) as HTMLElement;
    const assignment = sidebar.querySelector('.technician-assignment-card') as HTMLElement;
    const repairAction = sidebar.querySelector('.start-repair-sidebar-action') as HTMLElement;
    const main = fixture.nativeElement.querySelector('.customer-detail-main') as HTMLElement;

    expect(assignment.compareDocumentPosition(repairAction) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(repairAction.textContent).toContain('The customer approved the inspection estimate.');
    expect(repairAction.textContent).toContain('₹3.97');
    expect(repairAction.querySelector('button')?.textContent?.trim()).toBe('Start Repair');
    const startButton = repairAction.querySelector('button') as HTMLButtonElement;
    expect(startButton.disabled).toBeFalse();
    expect(main.textContent).not.toContain('The customer approved the inspection estimate.');
    expect(main.querySelector('.start-repair-sidebar-action')).toBeNull();

    startButton.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Start repair?');
  });

  it('tracks inspection, pickup, and repair as distinct lifecycle stages', () => {
    const fixture = TestBed.createComponent(ShopRepairRequestDetailsPage);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const acceptedRequest: ShopRepairRequest = {
      ...request,
      acceptedQuotationId: 'quotation-qa-e2e',
      shopResponse: {
        status: 'customer_accepted',
        respondedAt: '2026-11-18T10:00:00.000Z',
      },
      quotations: [
        {
          _id: 'quotation-qa-e2e',
          repairRequestId: request._id,
          amount: 1000,
          currency: 'INR',
          message: 'Repair',
          status: 'accepted',
          respondedAt: '2026-11-18T10:00:00.000Z',
          createdAt: '2026-11-18T09:00:00.000Z',
        },
      ],
    };

    component.setRequest({
      ...acceptedRequest,
      repairJob: {
        status: 'inspection_approved',
        acceptedQuotationId: 'quotation-qa-e2e',
        inspectionCompletedBeforeQuotation: true,
        requiresPhysicalPickup: false,
        inspection: {
          status: 'approved',
          parts: [],
          partsTotal: 0,
          labourCharge: 0,
          inspectionCharges: 0,
          otherCharges: 0,
          estimatedTotal: 1000,
          images: [],
          decidedAt: '2026-11-18T10:00:00.000Z',
        },
      },
    });
    expect(component.progressSteps().map((step) => step.label)).toEqual([
      'Request Submitted',
      'Quotation Accepted',
      'Inspection Approved',
      'Repair',
      'Ready for Pickup',
      'Customer Picked Up',
      'Completed',
    ]);
    expect(fixture.nativeElement.textContent).not.toContain('Repair & Complete');
    expect(component.progressSteps().find((step) => step.current)?.label).toBe('Repair');

    component.setRequest({
      ...acceptedRequest,
      repairJob: {
        status: 'pickup_scheduled',
        acceptedQuotationId: 'quotation-qa-e2e',
        inspectionCompletedBeforeQuotation: false,
        requiresPhysicalPickup: true,
        servicePickup: { scheduledAt: '2026-11-19T10:00:00.000Z' },
      },
    });
    expect(component.progressSteps().map((step) => step.label)).toEqual([
      'Request Submitted',
      'Quotation Accepted',
      'Pickup Scheduled',
      'Item Collected',
      'Inspection',
      'Repair',
      'Ready for Pickup',
      'Customer Picked Up',
      'Completed',
    ]);
    expect(component.progressSteps().find((step) => step.current)?.label).toBe('Item Collected');
    fixture.detectChanges();
    const progress = fixture.nativeElement.querySelector(
      '.request-progress',
    ) as HTMLOListElement;
    expect(getComputedStyle(progress).gridAutoFlow).toBe('column');
    expect(getComputedStyle(progress).overflowX).toBe('auto');
    expect(
      getComputedStyle(progress.querySelector('li strong') as HTMLElement).whiteSpace,
    ).toBe('nowrap');
    const mainContent = fixture.nativeElement.querySelector(
      '.customer-detail-main',
    ) as HTMLElement;
    expect(mainContent.textContent.indexOf('Customer Location and Route')).toBeLessThan(
      mainContent.textContent.indexOf('Repair Inspection'),
    );
    const sidebarContent = fixture.nativeElement.querySelector(
      '.customer-detail-sidebar-card',
    ) as HTMLElement;
    expect(sidebarContent.textContent.indexOf('Technician Assignment')).toBeLessThan(
      sidebarContent.textContent.indexOf('Physical collection required'),
    );
    expect(
      sidebarContent.textContent.indexOf('Physical collection required'),
    ).toBeLessThan(sidebarContent.textContent.indexOf('Device Information'));
    expect(
      fixture.nativeElement
        .querySelector('app-shop-repair-pickup')
        ?.classList.contains('customer-detail-block'),
    ).toBeTrue();

    component.setRequest({
      ...acceptedRequest,
      repairJob: {
        status: 'inspection_pending',
        acceptedQuotationId: 'quotation-qa-e2e',
        inspectionCompletedBeforeQuotation: false,
        requiresPhysicalPickup: false,
      },
    });
    expect(component.progressSteps().map((step) => step.label)).not.toContain(
      'Pickup Scheduled',
    );
    expect(component.progressSteps().find((step) => step.current)?.label).toBe('Inspection');
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.detail-status')?.textContent?.trim(),
    ).toBe('Inspection pending');
  });

  it('keeps new-request shop actions in the customer-matched detail layout', () => {
    const fixture = TestBed.createComponent(ShopRepairRequestDetailsPage);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(fixture.nativeElement.querySelector('.customer-detail-layout')).not.toBeNull();
    expect(text).toContain('Customer Information');
    expect(
      fixture.nativeElement.querySelector('.customer-identity img')?.getAttribute('src'),
    ).toBe('data:image/jpeg;base64,Y3VzdG9tZXI=');
    expect(text).toContain('Device Information');
    expect(text).toContain('Submit Quotation');
    expect(text).toContain('Decline Request');
    expect(text).toContain(
      'Please review the request and choose to submit a quotation or decline it.',
    );
    const responseActions = fixture.nativeElement.querySelector(
      '.request-response-actions',
    ) as HTMLElement;
    expect(getComputedStyle(responseActions).flexWrap).toBe('wrap');
    expect(
      getComputedStyle(responseActions.querySelector('button') as HTMLElement).whiteSpace,
    ).toBe('normal');
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
      repairJob: {
        status: 'in_progress',
        history: [{ action: 'request confirmed', at: '2026-11-12T01:00:00.000Z' }],
      },
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
    expect(text).toContain('Repair History');
    expect(text).toContain('CONFIRMED REPAIR');
    expect(text).toContain('Repair progress');
    expect(text).toContain('Progress note (optional)');
    const customerInformation = fixture.nativeElement.querySelector(
      '.customer-detail-main-card',
    ) as HTMLElement;
    expect(customerInformation.querySelector('.quotations-card')).not.toBeNull();
    const repairHistory = customerInformation.querySelector('.repair-history-card');
    const repairProgress = customerInformation.querySelector('.repair-workflow');
    expect(repairHistory).not.toBeNull();
    expect(repairProgress).not.toBeNull();
    expect(customerInformation.contains(repairProgress)).toBeTrue();
    const detailText = customerInformation.textContent ?? '';
    expect(detailText.indexOf('Repair History')).toBeLessThan(
      detailText.indexOf('CONFIRMED REPAIR'),
    );
    expect(detailText.indexOf('CONFIRMED REPAIR')).toBeLessThan(
      detailText.indexOf('Progress note (optional)'),
    );
    expect(text.indexOf("Customer's original problem")).toBeLessThan(
      text.indexOf('Quotation Details'),
    );
    expect(text.indexOf('Quotation Details')).toBeLessThan(text.indexOf('Repair History'));
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

  it('offers completed-inspection and shop-pickup choices with a neutral shop-inspection default', () => {
    const fixture = TestBed.createComponent(ShopRepairRequestDetailsPage);
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.setRequest({ ...request, serviceType: 'shop_visit' });
    component.openQuotation();
    fixture.detectChanges();

    const inspectionModes = Array.from(
      fixture.nativeElement.querySelectorAll(
        'input[name="inspectionMode"]',
      ),
    ) as HTMLInputElement[];
    expect(inspectionModes.length).toBe(2);
    expect(component.inspectionCompletedBeforeQuotation()).toBeFalse();
    expect(component.requiresPhysicalPickup()).toBeFalse();
    expect(inspectionModes.every((mode) => !mode.checked)).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain(
      'For inspection at the shop without pickup, leave both choices unselected.',
    );

    inspectionModes[1].click();
    fixture.detectChanges();
    expect(component.inspectionCompletedBeforeQuotation()).toBeFalse();
    expect(component.requiresPhysicalPickup()).toBeTrue();
    expect(inspectionModes[1].checked).toBeTrue();

    inspectionModes[0].click();
    fixture.detectChanges();
    expect(component.inspectionCompletedBeforeQuotation()).toBeTrue();
    expect(component.requiresPhysicalPickup()).toBeFalse();

    component.setInspectionCompletedBeforeQuotation(false);
    component.setRequiresPhysicalPickup(false);
    fixture.detectChanges();
    expect(component.inspectionCompletedBeforeQuotation()).toBeFalse();
    expect(component.requiresPhysicalPickup()).toBeFalse();
    expect(inspectionModes.every((mode) => !mode.checked)).toBeTrue();
    component.quotationAmount.set(1900);
    component.completionDays.set(3);
    component.quotationSummaries.set(['General Repair']);
    component.submitQuotation();

    const requestsService = TestBed.inject(ShopRepairRequestsService);
    expect(requestsService.submitQuotation).toHaveBeenCalledWith(
      request._id,
      jasmine.objectContaining({
        inspectionCompletedBeforeQuotation: false,
        requiresPhysicalPickup: false,
      }),
    );
    expect(router.navigate).toHaveBeenCalledWith([
      '/shop/jobs/pending-jobs',
      request._id,
    ]);
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
