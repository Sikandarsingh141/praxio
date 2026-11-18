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
      status: 'AWAITING_CUSTOMER_RESPONSE',
      priority: 'normal',
      messages: [],
      shopResponse: {
        explanation: 'Please confirm whether the issue is resolved.',
        message: 'We have reviewed the repair.',
        attachments: [],
        respondedAt: '2025-01-03T09:00:00.000Z',
      },
      statusHistory: [
        {
          from: 'AWAITING_SHOP_RESPONSE',
          to: 'AWAITING_CUSTOMER_RESPONSE',
          actorRole: 'shop',
          reason: 'The shop submitted reinspection findings.',
          at: '2025-01-03T09:00:00.000Z',
        },
      ],
      resolution: {
        documents: [],
        completionDocuments: [],
        requiredActionCompleted: false,
      },
      reinspections: [
        {
          findings: 'The device still fails to power on.',
          identifiedProblem: 'Charging assembly is damaged.',
          requiredRepairWork: 'Replace the charging assembly.',
          attachments: [],
          submittedAt: '2025-01-03T08:59:59.000Z',
        },
      ],
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

    const disputes = jasmine.createSpyObj<DisputesService>('DisputesService', [
      'get',
      'sendMessage',
      'reportUnresolved',
      'decideResolution',
      'confirmResolution',
    ]);
    disputes.get.and.returnValue(of(dispute));
    disputes.decideResolution.and.returnValue(of(dispute));
    disputes.confirmResolution.and.returnValue(of(dispute));
    const sentMessage = 'The issue is still happening.';
    disputes.sendMessage.and.returnValue(
      of({
        ...dispute,
        messages: [
          {
            authorId: 'customer-1',
            authorRole: 'customer',
            message: sentMessage,
            attachments: [],
            internal: false,
            createdAt: '2025-01-03T10:00:00.000Z',
          },
        ],
      }),
    );
    disputes.reportUnresolved.and.returnValue(
      of({ ...dispute, status: 'UNDER_REVIEW' }),
    );

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
    const component = harness.routeDebugElement!.componentInstance as CustomerDisputedJobDetailPage;
    const text = page.textContent ?? '';
    expect(page.querySelector('.request-hero')).not.toBeNull();
    expect(page.querySelector('.request-progress')).not.toBeNull();
    expect(page.querySelector('.customer-detail-layout')).not.toBeNull();
    expect(text).toContain('Issue Resolution Details');
    expect(text).toContain('Dispute Description');
    expect(text).toContain('The repaired device still does not work.');
    expect(text).toContain('Repair Shop');
    expect(text).toContain('Conversation');
    expect(text).toContain('Customer response');
    expect(text).toContain('Reinspection submission');
    expect(page.querySelector('.empty-conversation strong')?.textContent).toContain('No messages yet');
    const messageInput = page.querySelector<HTMLTextAreaElement>('.conversation-compose textarea');
    const sendButton = page.querySelector<HTMLButtonElement>('.conversation-compose button[type="submit"]');
    expect(messageInput).not.toBeNull();
    expect(sendButton?.disabled).toBeTrue();
    messageInput!.value = sentMessage;
    messageInput!.dispatchEvent(new Event('input', { bubbles: true }));
    harness.fixture.detectChanges();
    expect(sendButton?.disabled).toBeFalse();
    sendButton?.click();
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();
    expect(disputes.sendMessage).toHaveBeenCalledWith('customer', 'dispute-123', {
      message: sentMessage,
      attachments: [],
    });
    expect(page.textContent).toContain(sentMessage);
    expect(page.textContent).toContain('Message sent.');
    const reinspectionButton = Array.from(
      page.querySelectorAll<HTMLButtonElement>('.customer-response-action-card button'),
    ).find((button) => button.textContent?.includes('Reinspection submission'));
    expect(reinspectionButton).not.toBeUndefined();
    reinspectionButton!.click();
    harness.fixture.detectChanges();
    expect(page.querySelector('#reinspection-submission-title')).not.toBeNull();
    expect(page.textContent).toContain("Review the shop's reinspection findings");
    expect(page.textContent).toContain('The device still fails to power on.');
    const reinspectionReply = page.querySelector<HTMLTextAreaElement>(
      'textarea[name="reinspectionReply"]',
    );
    expect(reinspectionReply).not.toBeNull();
    const reply = 'I reviewed the findings. Please proceed with the listed repair.';
    component.reinspectionReply = reply;
    harness.fixture.detectChanges();
    const replyButton = Array.from(
      page.querySelectorAll<HTMLButtonElement>('.issue-modal button'),
    ).find((button) => button.textContent?.includes('Send response to shop'));
    expect(replyButton?.disabled).toBeFalse();
    replyButton?.click();
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();
    expect(disputes.sendMessage).toHaveBeenCalledWith('customer', 'dispute-123', {
      message: reply,
      attachments: [],
    });
    expect(page.textContent).toContain('Response sent to the shop.');
    reinspectionButton!.click();
    harness.fixture.detectChanges();
    const unresolvedInput = page.querySelector<HTMLTextAreaElement>(
      'textarea[name="reinspectionUnresolvedNotes"]',
    );
    expect(unresolvedInput).not.toBeNull();
    const unresolvedNotes = 'The issue is still not fixed.';
    component.unresolvedNotes = unresolvedNotes;
    harness.fixture.detectChanges();
    const reportButton = Array.from(
      page.querySelectorAll<HTMLButtonElement>('.issue-modal button'),
    ).find((button) => button.textContent?.includes('Report issue still exists'));
    expect(reportButton?.disabled).toBeFalse();
    reportButton?.click();
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();
    expect(disputes.reportUnresolved).toHaveBeenCalledWith('dispute-123', {
      notes: unresolvedNotes,
      attachments: [],
    });
    const proposedDispute: RepairDispute = {
      ...dispute,
      status: 'AWAITING_CUSTOMER_RESPONSE',
      resolution: {
        ...dispute.resolution,
        state: 'proposed',
        description: 'Repair the charging assembly again.',
      },
    };
    component.record.set(proposedDispute);
    harness.fixture.detectChanges();
    const reviewButton = Array.from(
      page.querySelectorAll<HTMLButtonElement>('.customer-response-action-card button'),
    ).find((button) => button.textContent?.includes('Review proposed resolution'));
    expect(reviewButton).not.toBeUndefined();
    reviewButton!.click();
    harness.fixture.detectChanges();
    expect(page.querySelector('#review-proposed-resolution-title')).not.toBeNull();
    expect(page.textContent).toContain('Repair the charging assembly again.');
    const reasonInput = page.querySelector<HTMLTextAreaElement>(
      'textarea[name="resolutionDecisionReason"]',
    );
    expect(reasonInput?.getAttribute('placeholder')).toBe(
      'Explain why you are rejecting this resolution.',
    );
    const rejectButton = Array.from(
      page.querySelectorAll<HTMLButtonElement>('.issue-modal button'),
    ).find((button) => button.textContent?.includes('Reject resolution'));
    expect(rejectButton?.disabled).toBeTrue();
    const reason = 'The proposed repair does not address the issue.';
    component.resolutionDecisionReason = reason;
    harness.fixture.detectChanges();
    expect(rejectButton?.disabled).toBeFalse();
    rejectButton!.click();
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();
    expect(disputes.decideResolution).toHaveBeenCalledWith('customer', 'dispute-123', {
      decision: 'reject',
      reason,
    });
    expect(component.reviewResolutionModalOpen()).toBeFalse();

    const completedDispute: RepairDispute = {
      ...dispute,
      status: 'CUSTOMER_VERIFICATION_PENDING',
      reworkCompletions: [
        {
          workPerformed: 'Component replacement',
          testingResults: 'Device powers on and charges correctly.',
          tested: true,
          attachments: [],
          completedAt: '2025-01-04T10:00:00.000Z',
        },
      ],
    };
    component.record.set(completedDispute);
    harness.fixture.detectChanges();
    const sidebarCards = Array.from(page.querySelectorAll('.customer-detail-sidebar-card'));
    const inspectionCardIndex = sidebarCards.findIndex(
      (card) => card.getAttribute('aria-label') === 'Device inspection actions',
    );
    const disputeInfoIndex = sidebarCards.findIndex(
      (card) => card.getAttribute('aria-label') === 'Dispute summary',
    );
    expect(inspectionCardIndex).toBeGreaterThan(-1);
    expect(inspectionCardIndex).toBeLessThan(disputeInfoIndex);
    const inspectButton = Array.from(
      page.querySelectorAll<HTMLButtonElement>('.customer-response-action-card button'),
    ).find((button) => button.textContent?.includes('Inspect and test device'));
    expect(inspectButton).not.toBeUndefined();
    inspectButton!.click();
    harness.fixture.detectChanges();
    expect(page.querySelector('#inspection-test-title')).not.toBeNull();
    expect(page.textContent).toContain('Please inspect and test your device');
    let inspectionModal = page.querySelector(
      '.issue-modal[aria-labelledby="inspection-test-title"]',
    );
    expect(inspectionModal?.querySelectorAll('form.inspection-choice-form').length).toBe(0);
    const resolvedChoice = page.querySelector<HTMLInputElement>(
      'input[name="inspectionChoice"][value="resolved"]',
    );
    expect(resolvedChoice).not.toBeNull();
    expect(page.querySelector('textarea[name="verificationNotes"]')).toBeNull();
    expect(page.querySelector('textarea[name="inspectionUnresolvedNotes"]')).toBeNull();
    resolvedChoice!.click();
    harness.fixture.detectChanges();
    const verificationInput = page.querySelector<HTMLTextAreaElement>(
      'textarea[name="verificationNotes"]',
    );
    expect(verificationInput?.getAttribute('placeholder')).toBe(
      'Confirm that the device works as expected.',
    );
    expect(page.querySelector('textarea[name="inspectionUnresolvedNotes"]')).toBeNull();
    expect(
      inspectionModal?.querySelectorAll('form.inspection-choice-form').length,
    ).toBe(1);
    expect(
      page
        .querySelector('input[name="inspectionChoice"][value="resolved"]')
        ?.closest('.inspection-choice-option')
        ?.classList.contains('is-selected'),
    ).toBeTrue();
    const resolvedCard = resolvedChoice!.closest(
      '.inspection-choice-option',
    ) as HTMLElement;
    expect(getComputedStyle(resolvedCard).display).toBe('flex');
    const confirmation = 'Device works now.';
    component.verificationNotes = confirmation;
    harness.fixture.detectChanges();
    const confirmButton = Array.from(
      page.querySelectorAll<HTMLButtonElement>('.issue-modal button'),
    ).find((button) => button.textContent?.includes('Confirm issue resolved'));
    expect(confirmButton?.disabled).toBeFalse();
    confirmButton!.click();
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();
    expect(disputes.confirmResolution).toHaveBeenCalledWith('dispute-123', {
      message: confirmation,
    });
    expect(component.inspectionTestModalOpen()).toBeFalse();

    component.openInspectionTestModal();
    harness.fixture.detectChanges();
    inspectionModal = page.querySelector(
      '.issue-modal[aria-labelledby="inspection-test-title"]',
    );
    const unresolvedChoice = page.querySelector<HTMLInputElement>(
      'input[name="inspectionChoice"][value="unresolved"]',
    );
    expect(unresolvedChoice).not.toBeNull();
    unresolvedChoice!.click();
    harness.fixture.detectChanges();
    expect(inspectionModal?.querySelector('textarea[name="inspectionUnresolvedNotes"]')).not.toBeNull();
    expect(inspectionModal?.querySelector('input[type="file"]')).not.toBeNull();
    expect(inspectionModal?.querySelector('textarea[name="verificationNotes"]')).toBeNull();
    expect(
      inspectionModal?.querySelectorAll('form.inspection-choice-form').length,
    ).toBe(1);

    expect(text).not.toContain('Open customer dispute page for permitted actions');
    expect(page.querySelector('.dispute-actions-link')).toBeNull();
    expect(disputes.get).toHaveBeenCalledWith('customer', 'dispute-123');
  });
});
