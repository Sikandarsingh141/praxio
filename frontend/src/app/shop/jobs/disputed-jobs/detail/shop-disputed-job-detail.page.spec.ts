import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { routes } from '../../../../app.routes';
import { ShopProfile } from '../../../../core/auth/auth.models';
import { AuthService } from '../../../../core/auth/auth.service';
import { JobSharedService } from '../../../../shared/services/job-shared.service';
import { RepairDispute } from '../../../../shared/models/disputes.models';
import { DisputesService } from '../../../../shared/services/disputes.service';
import { ShopRepairRequest } from '../../../repair-requests/shop-repair-requests.models';
import { ShopRepairRequestsService } from '../../../repair-requests/shop-repair-requests.service';
import { ShopDisputedJobDetailPage } from './shop-disputed-job-detail.page';

describe('ShopDisputedJobDetailPage', () => {
  it('routes Shop Issue Resolution detail URLs to the dedicated Shop page', async () => {
    const shopRoute = routes.find((route) => route.path === 'shop');
    const detailRoute = shopRoute?.children?.find(
      (route) => route.path === 'jobs/disputed-jobs/:id',
    );

    expect(detailRoute?.loadComponent).toBeDefined();
    expect(await detailRoute?.loadComponent?.()).toBe(ShopDisputedJobDetailPage);
  });

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
    status: 'OPEN',
    priority: 'normal',
    messages: [],
    statusHistory: [
      {
        from: 'NONE',
        to: 'OPEN',
        actorRole: 'customer',
        reason: 'Issue reported after repair.',
        at: '2026-11-17T09:27:01.000Z',
      },
    ],
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

  function createRepairRequest(
    location: ShopRepairRequest['customer']['location'],
  ): ShopRepairRequest {
    return {
      _id: 'request-45678901',
      appliance: 'Phone',
      description: 'Screen replacement',
      photos: [],
      status: 'open',
      createdAt: '2024-12-20T10:00:00.000Z',
      customer: {
        firstName: 'Customer',
        lastName: 'One',
        displayName: 'Customer One',
        email: 'customer@example.com',
        location,
      },
      shopResponse: { status: 'new' },
      quotations: [],
    };
  }

  async function renderPage(
    location: ShopRepairRequest['customer']['location'],
    loadedDispute: RepairDispute = dispute,
  ) {
    const disputes = jasmine.createSpyObj<DisputesService>('DisputesService', [
      'get',
      'sendMessage',
      'accept',
      'reject',
      'respondAsShop',
      'proposeResolution',
      'decideResolution',
      'startReinspection',
      'submitReinspection',
      'requestAdditionalCharges',
      'startRework',
      'addProgress',
      'completeRework',
    ]);
    disputes.get.and.returnValue(of(loadedDispute));
    disputes.sendMessage.and.returnValue(of(loadedDispute));
    disputes.accept.and.returnValue(of(loadedDispute));
    disputes.reject.and.returnValue(of(loadedDispute));
    disputes.respondAsShop.and.returnValue(of(loadedDispute));
    disputes.proposeResolution.and.returnValue(of(loadedDispute));
    disputes.decideResolution.and.returnValue(of(loadedDispute));
    disputes.startReinspection.and.returnValue(of(loadedDispute));
    disputes.submitReinspection.and.returnValue(of(loadedDispute));
    disputes.requestAdditionalCharges.and.returnValue(of(loadedDispute));
    disputes.startRework.and.returnValue(of(loadedDispute));
    disputes.addProgress.and.returnValue(of(loadedDispute));
    disputes.completeRework.and.returnValue(of(loadedDispute));
    const repairRequests = jasmine.createSpyObj<ShopRepairRequestsService>(
      'ShopRepairRequestsService',
      ['get'],
    );
    repairRequests.get.and.returnValue(of(createRepairRequest(location)));
    const authService = jasmine.createSpyObj<AuthService>('AuthService', ['getMyShopProfile']);
    const shopProfile: ShopProfile = {
      shopName: 'Repair Shop',
      businessType: 'repair',
      description: '',
      yearsOfExperience: 0,
      ownerFirstName: 'Shop',
      ownerLastName: 'Owner',
      email: 'shop@example.com',
      countryCode: '+1',
      mobileNumber: '5550100',
      address: '',
      city: '',
      state: '',
      postalCode: '',
      landmark: '',
      location: undefined,
      businessAddress: '',
      services: [],
      subscriptionPlan: 'Fixroa Shop monthly subscription',
      subscriptionAmountCents: 0,
      subscriptionCurrency: 'usd',
      paymentStatus: 'not_required',
      registrationStatus: 'approved',
      accountLifecycleStatus: 'active',
      submittedAt: null,
      adminApprovalStatus: 'approved',
      declineReason: null,
    };
    authService.getMyShopProfile.and.returnValue(of(shopProfile));

    await TestBed.configureTestingModule({
      imports: [ShopDisputedJobDetailPage],
      providers: [
        provideRouter([
          { path: 'shop/jobs/disputed-jobs/:id', component: ShopDisputedJobDetailPage },
        ]),
        { provide: DisputesService, useValue: disputes },
        { provide: ShopRepairRequestsService, useValue: repairRequests },
        { provide: AuthService, useValue: authService },
        {
          provide: JobSharedService,
          useValue: { errorMessage: jasmine.createSpy().and.returnValue('Unable to load details.') },
        },
      ],
    }).compileComponents();

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/shop/jobs/disputed-jobs/dispute-123', ShopDisputedJobDetailPage);
    return {
      page: harness.routeNativeElement as HTMLElement,
      component: harness.routeDebugElement?.componentInstance as ShopDisputedJobDetailPage,
      harness,
      disputes,
    };
  }

  it('uses the Customer detail layout and places customer route and dispute actions on the left', async () => {
    const { page } = await renderPage({ latitude: 40.7128, longitude: -74.006 });
    const text = page.textContent ?? '';

    expect(page.querySelector('.request-hero')).not.toBeNull();
    expect(page.querySelector('.request-progress')).not.toBeNull();
    expect(page.querySelector('.customer-detail-layout')).not.toBeNull();
    expect(page.querySelector('.customer-detail-main .route-section')).not.toBeNull();
    expect(page.querySelector('.customer-detail-sidebar .route-section')).toBeNull();
    expect(text).toContain('Issue Resolution Details');
    expect(text).toContain('Dispute Description');
    expect(text).toContain('The repaired device still does not work.');
    expect(text).toContain('Customer Location and Route');
    expect(text).toContain('Status History');
    expect(text).toContain('Case opened');
    expect(text).toContain('By Customer');
    expect(text).toContain('No messages yet');
    expect(text).toContain('Start the conversation to discuss and resolve this dispute.');
    expect(text).toContain('Attach files');
    expect(text).toContain('Propose a resolution to the customer');
    expect(text).toContain('Accept dispute');
    expect(text).toContain('Review customer dispute');
    expect(text).toContain('Reject dispute');
    expect(page.querySelector('.customer-detail-sidebar > section:first-child')?.className).toContain(
      'sidebar-action-card',
    );
    expect(page.querySelector('.sidebar-action-copy')?.textContent).toContain('Dispute decision');
    expect(page.querySelector('.sidebar-action-buttons')?.textContent).toContain('Accept dispute');
    expect(page.querySelector('.sidebar-action-buttons')?.textContent).toContain('Reject dispute');
    expect(page.querySelector('.customer-detail-sidebar > section:nth-child(2)')?.className).toContain(
      'resolution-action-card',
    );
    expect(page.querySelector('.resolution-action-card')?.textContent).toContain(
      'Propose resolution',
    );
    expect(page.querySelector('.resolution-action-card')?.textContent).toContain(
      'Review customer dispute',
    );
  });

  it('submits conversation, proposal, acceptance, formal response, and rejection through the Shop APIs', async () => {
    const { component, disputes } = await renderPage(null);
    component.message = 'I can help resolve this.';
    component.sendMessage(dispute);
    expect(disputes.sendMessage).toHaveBeenCalledWith('shop', 'dispute-123', {
      message: 'I can help resolve this.',
      attachments: [],
    });

    component.resolutionDescription = 'Repair the device again.';
    component.resolutionNotes = 'We will inspect it first.';
    component.proposeResolution(dispute);
    expect(disputes.proposeResolution).toHaveBeenCalledWith('shop', 'dispute-123', {
      type: 'repair_again',
      description: 'Repair the device again.',
      amount: undefined,
      responsibleParty: 'shop',
      notes: 'We will inspect it first.',
    });

    component.acceptDispute(dispute);
    component.shopResponseExplanation = 'The repair is being reviewed.';
    component.shopResponseMessage = 'Please bring the device in.';
    component.submitShopResponse(dispute);
    component.rejectionReason = 'The issue is outside repair scope.';
    component.rejectionExplanation = 'The submitted evidence confirms unrelated damage.';
    component.rejectDispute(dispute);

    expect(disputes.accept).toHaveBeenCalledWith('dispute-123');
    expect(disputes.respondAsShop).toHaveBeenCalledWith('dispute-123', {
      explanation: 'The repair is being reviewed.',
      message: 'Please bring the device in.',
      proposedResolution: undefined,
    });
    expect(disputes.reject).toHaveBeenCalledWith('dispute-123', {
      reason: 'The issue is outside repair scope.',
      explanation: 'The submitted evidence confirms unrelated damage.',
      attachments: [],
    });
  });

  it('opens separate popups for each issue resolution action', async () => {
    const { page, component, harness, disputes } = await renderPage(null);

    component.openProposeResolutionModal();
    harness.detectChanges();
    expect(page.querySelector('#propose-resolution-title')).not.toBeNull();
    component.resolutionDescription = 'Repair the device again.';
    component.resolutionNotes = 'We will inspect it first.';
    component.proposeResolution(dispute);
    harness.detectChanges();
    expect(disputes.proposeResolution).toHaveBeenCalled();
    expect(component.proposeResolutionModalOpen()).toBeFalse();

    component.openReviewDisputeModal();
    harness.detectChanges();
    expect(page.querySelector('#review-dispute-title')).not.toBeNull();
    expect(page.textContent).toContain('Send a formal response');
    component.closeReviewDisputeModal();
    harness.detectChanges();
    expect(component.reviewDisputeModalOpen()).toBeFalse();

    component.openAcceptDisputeModal();
    harness.detectChanges();
    expect(page.querySelector('#accept-dispute-title')).not.toBeNull();
    component.acceptDispute(dispute);
    harness.detectChanges();
    expect(disputes.accept).toHaveBeenCalledWith('dispute-123');
    expect(component.acceptDisputeModalOpen()).toBeFalse();

    component.openRejectDisputeModal();
    harness.detectChanges();
    expect(page.querySelector('#reject-dispute-title')).not.toBeNull();
    expect(page.querySelector('input[name="rejectionReason"]')).not.toBeNull();
    component.rejectionReason = 'Outside repair scope.';
    component.rejectionExplanation = 'The evidence shows unrelated damage.';
    component.rejectDispute(dispute);
    harness.detectChanges();
    expect(disputes.reject).toHaveBeenCalled();
    expect(component.rejectDisputeModalOpen()).toBeFalse();
    expect(page.querySelector('.issue-modal')).toBeNull();
  });

  it('requires a refund amount when proposing a refund', async () => {
    const { component, disputes } = await renderPage(null);
    component.resolutionType = 'partial_refund';
    component.resolutionDescription = 'Refund the unused service charge.';
    component.resolutionNotes = 'The repair did not resolve the reported issue.';

    component.proposeResolution(dispute);

    expect(disputes.proposeResolution).not.toHaveBeenCalled();
    expect(component.actionError()).toBe('Enter the proposed refund amount.');
  });

  it('shows Shop response and rework workflow panels for an awaiting-response dispute', async () => {
    const awaitingShopResponse: RepairDispute = {
      ...dispute,
      status: 'AWAITING_SHOP_RESPONSE',
      resolution: {
        ...dispute.resolution,
        state: 'proposed',
        description: 'Repair the device again.',
        notes: 'The customer requests another repair.',
      },
    };
    const { page } = await renderPage(null, awaitingShopResponse);
    const text = page.textContent ?? '';

    expect(text).toContain("Review the customer's response");
    expect(text).toContain('Submit reinspection findings');
    expect(text).toContain('Request additional charges');
    expect(text).toContain('Rework actions');
  });

  it('places reinspection submission actions after resolution actions', async () => {
    const reinspectionDispute: RepairDispute = {
      ...dispute,
      status: 'REINSPECTION_IN_PROGRESS',
    };
    const { page } = await renderPage(null, reinspectionDispute);
    const cardLabels = Array.from(page.querySelectorAll('.sidebar-action-card')).map((card) =>
      card.getAttribute('aria-label'),
    );

    expect(cardLabels).toContain('Resolution actions');
    expect(cardLabels).toContain('Reinspection submission actions');
    expect(cardLabels.indexOf('Reinspection submission actions')).toBeGreaterThan(
      cardLabels.indexOf('Resolution actions'),
    );
  });

  it('places rework actions after reinspection submission', async () => {
    const awaitingShopResponse: RepairDispute = {
      ...dispute,
      status: 'AWAITING_SHOP_RESPONSE',
    };
    const { page } = await renderPage(null, awaitingShopResponse);
    const cardLabels = Array.from(page.querySelectorAll('.sidebar-action-card')).map((card) =>
      card.getAttribute('aria-label'),
    );

    expect(cardLabels).toContain('Reinspection submission actions');
    expect(cardLabels).toContain('Rework actions');
    expect(cardLabels.indexOf('Rework actions')).toBeGreaterThan(
      cardLabels.indexOf('Reinspection submission actions'),
    );
  });

  it('opens separate popups for each rework workflow action', async () => {
    const awaitingShopResponse: RepairDispute = {
      ...dispute,
      status: 'AWAITING_SHOP_RESPONSE',
    };
    const { component, page, harness } = await renderPage(null, awaitingShopResponse);

    component.openReinspectionModal();
    harness.detectChanges();
    expect(page.querySelector('#reinspection-findings-title')).not.toBeNull();
    expect(
      page.querySelector('textarea[name="reinspectionFindings"]')?.getAttribute('placeholder'),
    ).toBe('Describe what you found during reinspection.');
    component.closeReinspectionModal();
    harness.detectChanges();

    component.openAdditionalChargesModal();
    harness.detectChanges();
    expect(page.querySelector('#additional-charges-title')).not.toBeNull();
    expect(
      page
        .querySelector('.issue-modal-charge-row input[type="number"]')
        ?.getAttribute('placeholder'),
    ).toBe('0.00');
    component.closeAdditionalChargesModal();
    harness.detectChanges();

    component.record.set({ ...dispute, status: 'REPAIR_IN_PROGRESS' });
    harness.detectChanges();

    component.openReworkProgressModal();
    harness.detectChanges();
    expect(page.querySelector('#rework-progress-title')).not.toBeNull();
    expect(page.querySelector('textarea[name="progressNotes"]')?.getAttribute('placeholder')).toBe(
      'Describe the work completed so far.',
    );
    component.closeReworkProgressModal();
    harness.detectChanges();

    component.openCompleteReworkModal();
    harness.detectChanges();
    expect(page.querySelector('#complete-rework-title')).not.toBeNull();
    expect(page.querySelector('textarea[name="reworkDescription"]')?.getAttribute('placeholder')).toBe(
      'Describe the work performed.',
    );
    expect(page.querySelector('textarea[name="testingResults"]')?.getAttribute('placeholder')).toBe(
      'Describe the tests and their results.',
    );
    expect(page.querySelector('input[name="reworkTested"]')).not.toBeNull();
    component.closeCompleteReworkModal();
    harness.detectChanges();

    expect(page.querySelector('.issue-modal')).toBeNull();
  });

  it('submits the Shop dispute workflow actions through the existing APIs', async () => {
    const awaitingShopResponse: RepairDispute = {
      ...dispute,
      status: 'AWAITING_SHOP_RESPONSE',
      resolution: {
        ...dispute.resolution,
        state: 'proposed',
      },
    };
    const { component, disputes } = await renderPage(null, awaitingShopResponse);

    component.resolutionDecisionReason = 'The proposed repair is not feasible.';
    component.decideResolution(awaitingShopResponse, 'reject');
    expect(disputes.decideResolution).toHaveBeenCalledWith('shop', 'dispute-123', {
      decision: 'reject',
      reason: 'The proposed repair is not feasible.',
    });

    component.reinspectionFindings = 'The device still fails to power on.';
    component.requiredRepairWork = 'Replace the charging assembly.';
    component.estimatedCompletionTime = 'Two business days';
    component.submitReinspection(awaitingShopResponse);
    expect(disputes.submitReinspection).toHaveBeenCalledWith('dispute-123', {
      findings: 'The device still fails to power on.',
      requiredRepairWork: 'Replace the charging assembly.',
      estimatedCompletionTime: 'Two business days',
      attachments: [],
    });

    component.chargeReason = 'The inspection found a damaged charging assembly.';
    component.chargeItems = [{ description: 'Charging assembly', amount: 25 }];
    component.chargeMessage = 'Please approve the replacement part.';
    component.requestCharges(awaitingShopResponse);
    expect(disputes.requestAdditionalCharges).toHaveBeenCalledWith('dispute-123', {
      reason: 'The inspection found a damaged charging assembly.',
      items: [{ description: 'Charging assembly', amount: 25 }],
      message: 'Please approve the replacement part.',
    });

    component.progressNotes = 'Replacement part installed.';
    component.addReworkProgress(awaitingShopResponse);
    expect(disputes.addProgress).toHaveBeenCalledWith('dispute-123', {
      notes: 'Replacement part installed.',
      attachments: [],
    });

    component.reworkDescription = 'Replaced the charging assembly.';
    component.testingResults = 'Charging and startup tests passed.';
    component.reworkTested = true;
    component.completeRework(awaitingShopResponse);
    expect(disputes.completeRework).toHaveBeenCalledWith('dispute-123', {
      workPerformed: 'Replaced the charging assembly.',
      partsReplaced: undefined,
      testingResults: 'Charging and startup tests passed.',
      finalNotes: undefined,
      tested: true,
      attachments: [],
    });
  });

  it('requires a reason when rejecting a proposed resolution', async () => {
    const awaitingShopResponse: RepairDispute = {
      ...dispute,
      status: 'AWAITING_SHOP_RESPONSE',
      resolution: { ...dispute.resolution, state: 'proposed' },
    };
    const { component, disputes } = await renderPage(null, awaitingShopResponse);

    component.decideResolution(awaitingShopResponse, 'reject');

    expect(disputes.decideResolution).not.toHaveBeenCalled();
    expect(component.actionError()).toBe(
      'Explain why you are rejecting the proposed resolution.',
    );
  });

  it('starts reinspection and rework only for eligible workflow statuses', async () => {
    const { component, disputes, page, harness } = await renderPage(null);
    const acceptedDispute: RepairDispute = { ...dispute, status: 'ACCEPTED' };
    const reinspectedDispute: RepairDispute = {
      ...dispute,
      status: 'REINSPECTION_IN_PROGRESS',
    };

    component.record.set(acceptedDispute);
    harness.detectChanges();
    expect(page.querySelector('.reinspection-action-card')).not.toBeNull();
    expect(page.querySelector('.reinspection-action-card')?.textContent).toContain(
      'Start reinspection',
    );

    component.startReinspection(acceptedDispute);
    component.startRework(reinspectedDispute);
    component.startRework(dispute);

    expect(disputes.startReinspection).toHaveBeenCalledWith('dispute-123');
    expect(disputes.startRework).toHaveBeenCalledOnceWith('dispute-123');
  });
});
