import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { CustomerRepairRequest } from '../../../customer/models/customer-portal.models';
import { CustomerPortalService } from '../../../customer/services/customer-portal.service';
import {
  AdminMapEntity,
  AdminMapRoute,
  AdminRepairJob,
  AdminService,
} from '../../../admin/services/admin.service';
import { DisputeListResult, RepairDispute } from '../../models/disputes.models';
import { DisputesService } from '../../services/disputes.service';
import { ToastService } from '../../../core/toast/toast.service';
import { DisputeCenterComponent } from './dispute-center.component';

function createAdminServiceStub() {
  const service = jasmine.createSpyObj<AdminService>('AdminService', [
    'getMapRequest',
    'getMapRoute',
    'getRepairJobDetails',
  ]);
  service.getRepairJobDetails.and.returnValue(
    of({
      _id: 'repair-request-12345678',
      appliance: 'Air conditioner',
      description: 'The screen is broken.',
      brand: 'Fixroa',
      model: 'AC-100',
      serviceType: 'shop_visit',
      preferredServiceDate: '2026-11-18T00:00:00.000Z',
      photos: [{ mimeType: 'image/png', data: 'data:image/png;base64,repair-photo' }],
      createdAt: '2026-11-10T00:00:00.000Z',
      updatedAt: '2026-11-18T00:00:00.000Z',
      repairJob: {
        status: 'completed',
        approvedRepairAmount: 450,
        workPerformed: 'Replaced the display.',
        partsReplaced: 'Display panel',
        completionDescription: 'Device works correctly.',
        history: [
          { action: 'repair_completed', notes: 'Tested successfully.', at: '2026-11-18T00:00:00.000Z' },
        ],
        inspection: {
          identifiedProblem: 'Broken display',
          findings: 'Display panel is damaged.',
          requiredRepairWork: 'Replace display panel.',
          estimatedTotal: 450,
          images: [],
        },
      },
      customer: {
        displayName: 'Taylor Morgan',
        email: 'taylor@example.com',
        countryCode: '+1',
        mobileNumber: '555-0199',
        profileImageUrl: 'data:image/png;base64,customer',
      },
      shopName: 'Repair Shop',
      shop: {
        displayName: 'Sam Shop',
        email: 'shop@example.com',
        countryCode: '+1',
        mobileNumber: '555-0123',
        address: 'Mohali, Punjab, 140062',
        city: 'mohali',
        state: 'Punjab',
        postalCode: '140062',
        profileImageUrl: 'data:image/png;base64,shop-owner',
      },
      quotation: {
        amount: 450,
        currency: 'INR',
        status: 'accepted',
        proposedSolution: 'Replace the display panel.',
        createdAt: '2026-11-17T00:00:00.000Z',
        validUntil: '2026-11-24T00:00:00.000Z',
        estimatedDays: 2,
      },
    } satisfies AdminRepairJob),
  );
  service.getMapRequest.and.returnValue(
    of({
      id: 'repair-request-12345678',
      type: 'request',
      name: 'Air conditioner',
      location: null,
      address: '',
      city: '',
      state: '',
      email: '',
      phone: '',
      status: 'completed',
      shopLocation: null,
    } satisfies AdminMapEntity),
  );
  service.getMapRoute.and.returnValue(
    of({
      distanceMeters: 1000,
      durationSeconds: 600,
      description: 'Route',
      path: [{ latitude: 12, longitude: 77 }],
    } satisfies AdminMapRoute),
  );
  return service;
}

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
        customer: {
          id: 'customer-id',
          name: 'Taylor Morgan',
          profileImageUrl: 'data:image/png;base64,profile',
        },
        shop: {
          id: 'shop-id',
          name: 'Repair Shop',
          personName: 'Sam Shop',
          profileImageUrl: 'data:image/png;base64,shop-owner',
          shopImageUrl: 'data:image/png;base64,shop-logo',
        },
      },
      repair: {
        id: 'repair-id',
        appliance: 'Air conditioner',
        brand: 'Fixroa',
        model: 'AC-100',
        description: 'Not cooling',
        photos: [{ mimeType: 'image/png', data: 'data:image/png;base64,repair-photo' }],
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
        { provide: AdminService, useValue: createAdminServiceStub() },
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
    expect(
      fixture.nativeElement.querySelector(
        '.shop-dispute-list-page .customer-dispute-table-card',
      ),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.customer-dispute-table')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-job-pagination')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('.dispute-device-copy')?.textContent,
    ).toContain('Air conditioner');
    expect(
      fixture.nativeElement.querySelector('.dispute-device-copy')?.textContent,
    ).toContain('Fixroa');
    expect(
      fixture.nativeElement.querySelector('.dispute-customer-name')?.textContent,
    ).toContain('Taylor Morgan');
    expect(
      fixture.nativeElement
        .querySelector('.dispute-customer-avatar')
        ?.getAttribute('src'),
    ).toBe('data:image/png;base64,profile');
    expect(
      (fixture.nativeElement.querySelector('.dispute-action-popup a') as HTMLAnchorElement).href,
    ).toContain('/shop/disputes/dispute-id');

    fixture.componentInstance.role.set('admin');
    fixture.detectChanges();

    const adminTable = fixture.nativeElement.querySelector(
      '.admin-dispute-list-page .customer-dispute-table',
    ) as HTMLTableElement;
    expect(adminTable).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.result-count')).toBeNull();
    expect(Array.from(adminTable.querySelectorAll('th')).map((header) => header.textContent?.trim()))
      .toContain('Customer');
    expect(adminTable.querySelector('.dispute-customer-name')?.textContent).toContain('Taylor Morgan');
    expect(
      (adminTable.querySelector('.dispute-customer-avatar') as HTMLImageElement).src,
    ).toContain('data:image/png;base64,profile');
    expect(
      (adminTable.querySelector('.dispute-device-thumbnail img') as HTMLImageElement).src,
    ).toContain('data:image/png;base64,repair-photo');
    expect(adminTable.querySelector('.dispute-shop-copy > strong')?.textContent).toContain(
      'Repair Shop',
    );
    expect(adminTable.querySelector('.dispute-shop-owner')?.textContent).toContain('Sam Shop');
    expect(
      (adminTable.querySelector('.dispute-shop-logo') as HTMLImageElement).src,
    ).toContain('data:image/png;base64,shop-logo');
    expect(
      (adminTable.querySelector('.dispute-shop-owner-avatar') as HTMLImageElement).src,
    ).toContain('data:image/png;base64,shop-owner');
    expect(
      (adminTable.querySelector('.dispute-action-popup a') as HTMLAnchorElement).href,
    ).toContain('/admin/disputes/dispute-id');
  });

  it('opens the raise-dispute form with the completed repair ID and submits against it', async () => {
    const request: CustomerRepairRequest = {
      _id: '507f1f77bcf86cd7099f4b67bb',
      shopIds: ['shop-id'],
      appliance: 'Mobile Phone',
      brand: 'Apple',
      model: '17',
      description: 'Screen still does not work',
      status: 'completed',
      createdAt: '2026-11-17T00:00:00.000Z',
      quotations: [],
      repairJob: { status: 'completed' },
    };
    const disputes = jasmine.createSpyObj<DisputesService>('DisputesService', ['list', 'create']);
    disputes.list.and.returnValue(
      of({
        items: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        summary: { TOTAL: 0, OPEN: 0, UNDER_REVIEW: 0, RESOLVED: 0, CLOSED: 0 },
      } satisfies DisputeListResult),
    );
    disputes.create.and.returnValue(of({ _id: 'new-dispute' } as RepairDispute));
    const customerPortal = jasmine.createSpyObj<CustomerPortalService>(
      'CustomerPortalService',
      ['getRepairRequests'],
    );
    customerPortal.getRepairRequests.and.returnValue(of([request]));
    const toastService = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);

    await TestBed.configureTestingModule({
      imports: [DisputeCenterComponent],
      providers: [
        provideRouter([]),
        { provide: DisputesService, useValue: disputes },
        { provide: CustomerPortalService, useValue: customerPortal },
        { provide: ToastService, useValue: toastService },
        { provide: AdminService, useValue: createAdminServiceStub() },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DisputeCenterComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));

    (fixture.nativeElement.querySelector('.raise-dispute-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    const requestOption = dialog.querySelector(
      'option[value="507f1f77bcf86cd7099f4b67bb"]',
    ) as HTMLOptionElement;
    expect(requestOption.textContent?.trim()).toBe('Mobile Phone · Apple 17 (#9F4B67BB)');
    expect(dialog.querySelector('.repair-status')?.textContent?.trim()).toBe('Completed');
    expect(dialog.textContent).toContain('Dispute Guidelines');

    fixture.componentInstance.description = 'Screen still does not work';
    fixture.componentInstance.createDispute();

    expect(disputes.create).toHaveBeenCalledWith(
      '507f1f77bcf86cd7099f4b67bb',
      jasmine.objectContaining({
        category: 'repair_quality',
        description: 'Screen still does not work',
      }),
    );
    expect(router.navigate).toHaveBeenCalledWith(['/customer/disputes', 'new-dispute']);
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
        customer: {
          id: 'customer-id',
          name: 'Customer',
          email: 'customer@example.com',
          profileImageUrl: 'data:image/png;base64,customer',
        },
        shop: {
          id: 'shop-id',
          name: 'Repair Shop',
          personName: 'Sam Shop',
          email: 'shop@example.com',
          profileImageUrl: 'data:image/png;base64,shop-owner',
          shopImageUrl: 'data:image/png;base64,shop-logo',
        },
      },
      repair: {
        id: 'repair-id',
        appliance: 'Air conditioner',
        brand: 'Fixroa',
        model: 'AC-100',
        description: 'Not cooling',
        photos: [{ mimeType: 'image/png', data: 'repair-photo' }],
        status: 'completed',
        createdAt: '2026-11-01T00:00:00.000Z',
      },
    } as RepairDispute;
    const disputes = jasmine.createSpyObj<DisputesService>('DisputesService', ['get']);
    disputes.get.and.returnValue(of(dispute));
    const adminService = createAdminServiceStub();

    await TestBed.configureTestingModule({
      imports: [DisputeCenterComponent],
      providers: [
        provideRouter([{ path: 'customer/disputes/:id', component: DisputeCenterComponent }]),
        { provide: DisputesService, useValue: disputes },
        { provide: CustomerPortalService, useValue: { getRepairJob: jasmine.createSpy() } },
        { provide: AdminService, useValue: adminService },
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

    const component = harness.routeDebugElement!.componentInstance as DisputeCenterComponent;
    component.role.set('shop');
    harness.detectChanges();

    expect(page.querySelector('.customer-dispute-detail-page')).not.toBeNull();
    expect(page.querySelector('.request-hero')).not.toBeNull();
    expect(page.querySelector('.request-progress')).not.toBeNull();
    expect(page.querySelector('.customer-detail-sidebar')).not.toBeNull();
    expect(page.querySelector('.participants-card')).toBeNull();
    expect((page.querySelector('.repair-details-link') as HTMLAnchorElement).href).toContain(
      '/shop/repair-requests/repair-id',
    );

    component.role.set('admin');
    component.loadDetail('dispute-id');
    harness.detectChanges();

    expect(adminService.getMapRequest).toHaveBeenCalledWith('repair-request-12345678');
    expect(adminService.getRepairJobDetails).toHaveBeenCalledWith('repair-request-12345678');
    expect(page.querySelector('.route-section')).not.toBeNull();
    expect(
      page
        .querySelector('.customer-information-card')!
        .compareDocumentPosition(page.querySelector('.route-section')!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(page.textContent).toContain(
      'Customer and shop locations are not available for this repair.',
    );
    expect(page.querySelector('main')?.classList.contains('admin-dispute-detail-page')).toBeTrue();
    expect(page.querySelector('.detail-page-title')?.textContent).toContain('Issue Resolution');
    expect(page.querySelector('.request-hero h2')?.textContent).toContain('Air conditioner');
    expect(page.querySelector('.request-progress')).not.toBeNull();
    expect(
      getComputedStyle(page.querySelector('.request-hero-photo') as HTMLElement).width,
    ).toBe('96px');
    expect(getComputedStyle(page.querySelector('.detail-back-link svg') as Element).width).toBe(
      '16px',
    );
    expect(page.querySelector('.customer-detail-sidebar')).not.toBeNull();
    expect(page.querySelector('.customer-layout-disabled')).toBeNull();
    const partyAvatars = page.querySelectorAll<HTMLImageElement>('img.dispute-party-avatar');
    expect(partyAvatars.length).toBe(2);
    expect(partyAvatars[0].src).toContain('data:image/png;base64,customer');
    expect(partyAvatars[1].src).toContain('data:image/png;base64,shop-owner');
    expect((page.querySelector('.request-hero-photo img') as HTMLImageElement).src).toContain(
      'data:image/png;base64,repair-photo',
    );
    expect((page.querySelector('.shop-link') as HTMLAnchorElement).href).toContain(
      '/admin/repair-jobs/repair-id',
    );
    expect(page.textContent).toContain('Investigation notes');
    component.dispute.update((current) =>
      current
        ? {
            ...current,
            status: 'OPEN',
            resolution: { ...current.resolution, state: 'proposed' },
          }
        : current,
    );
    harness.detectChanges();

    const actionCard = page.querySelector('.admin-action-card') as HTMLElement;
    const disputeInformationCard = page.querySelector(
      '.customer-detail-sidebar-card[aria-label="Dispute and repair information"]',
    ) as HTMLElement;
    expect(actionCard).not.toBeNull();
    expect(
      actionCard.compareDocumentPosition(disputeInformationCard) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(actionCard.textContent).toContain('Investigation notes');
    expect(actionCard.textContent).toContain('Close dispute');

    const investigationButton = Array.from(actionCard.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Investigation notes'),
    ) as HTMLButtonElement;
    investigationButton.click();
    harness.detectChanges();

    const investigationDialog = page.querySelector(
      '[role="dialog"][aria-labelledby="admin-investigation-notes-title"]',
    ) as HTMLElement;
    expect(investigationDialog).not.toBeNull();
    expect(investigationDialog.querySelector('textarea')?.getAttribute('placeholder')).toContain(
      'Record your findings',
    );
    component.closeInvestigationNotesModal();
    harness.detectChanges();

    const closeButton = Array.from(
      (page.querySelector('.admin-action-card') as HTMLElement).querySelectorAll('button'),
    ).find((button) => button.textContent?.trim() === 'Close dispute') as HTMLButtonElement;
    closeButton.click();
    harness.detectChanges();

    const closeDialog = page.querySelector(
      '[role="dialog"][aria-labelledby="admin-close-dispute-title"]',
    ) as HTMLElement;
    expect(closeDialog).not.toBeNull();
    expect(closeDialog.querySelector('input')?.getAttribute('placeholder')).toContain(
      'Explain why this dispute is being closed',
    );
    component.closeCloseDisputeModal();
    harness.detectChanges();

    const managementCard = page.querySelector('.admin-management-card') as HTMLElement;
    expect(managementCard).not.toBeNull();
    expect(managementCard.querySelectorAll('button').length).toBe(1);
    const manageButton = managementCard.querySelector('button') as HTMLButtonElement;
    manageButton.click();
    harness.detectChanges();

    const actionDialog = page.querySelector(
      '[role="dialog"][aria-labelledby="admin-action-modal-title"]',
    ) as HTMLElement;
    expect(actionDialog).not.toBeNull();
    expect(actionDialog.textContent).toContain('Manage dispute status or complete resolution');
    const actionOptions = Array.from(
      actionDialog.querySelectorAll<HTMLButtonElement>('.admin-action-option'),
    );
    expect(actionOptions.length).toBe(2);
    expect(actionOptions[0].textContent).toContain('Manage dispute status');
    expect(actionOptions[1].textContent).toContain('Complete resolution');

    actionOptions[0].click();
    harness.detectChanges();
    const statusDialog = page.querySelector(
      '[role="dialog"][aria-labelledby="admin-action-modal-title"]',
    ) as HTMLElement;
    expect(statusDialog.textContent).toContain('Update status');
    expect(statusDialog.querySelector('textarea')?.getAttribute('placeholder')).toContain(
      'Explain why this status',
    );

    component.backToAdminActionChoices();
    harness.detectChanges();
    const completionOption = Array.from(
      (
        page.querySelector('[role="dialog"][aria-labelledby="admin-action-modal-title"]') as HTMLElement
      ).querySelectorAll<HTMLButtonElement>('.admin-action-option'),
    ).find((option) => option.textContent?.includes('Complete resolution')) as HTMLButtonElement;
    completionOption.click();
    harness.detectChanges();

    const completionDialog = page.querySelector(
      '[role="dialog"][aria-labelledby="admin-action-modal-title"]',
    ) as HTMLElement;
    expect(completionDialog.querySelector('textarea')?.getAttribute('placeholder')).toContain(
      'Describe what was completed',
    );
    component.closeAdminActionModal();
    harness.detectChanges();

    expect(page.textContent).toContain('Customer Information');
    expect(page.textContent).toContain('taylor@example.com');
    expect(page.textContent).toContain('555-0199');
    expect(page.textContent).toContain('The screen is broken.');
    expect(page.textContent).toContain('Accepted Quotation');
    expect(page.textContent).toContain('Inspection Report');
    expect(page.textContent).toContain('Repair and Completion');
    expect(page.textContent).toContain('Service type');
    expect(page.textContent).toContain('Mohali, Punjab, 140062');
    expect(page.textContent).not.toContain('Mohali, Punjab, 140062, mohali');
    expect(page.querySelector('.dispute-detail-main-card')).not.toBeNull();
    expect(
      getComputedStyle(
        page.querySelector('.dispute-detail-main-card .complaint-card') as HTMLElement,
      ).boxShadow,
    ).toBe('none');
  });
});
