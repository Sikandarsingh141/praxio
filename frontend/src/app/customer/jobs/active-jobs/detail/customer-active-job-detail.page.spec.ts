import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { CustomerRepairRequest, RepairReview } from '../../../models/customer-portal.models';
import { CustomerPortalService } from '../../../services/customer-portal.service';
import { JobSharedService } from '../../../../shared/services/job-shared.service';
import { CustomerActiveJobDetailPage } from './customer-active-job-detail.page';

describe('CustomerActiveJobDetailPage', () => {
  const request: CustomerRepairRequest = {
    _id: 'request-12345678',
    shopIds: [],
    appliance: 'Phone',
    brand: 'Example',
    model: 'Model One',
    description: 'Screen replacement',
    status: 'open',
    createdAt: '2026-11-18T10:00:00.000Z',
    quotations: [],
    photos: [],
    shop: null,
    repairJob: {
      status: 'inspection_pending',
      history: [{ action: 'inspection_started', at: '2026-11-19T10:00:00.000Z' }],
    },
  };
  let jobs: jasmine.SpyObj<JobSharedService>;
  let customerPortal: jasmine.SpyObj<CustomerPortalService>;

  beforeEach(async () => {
    jobs = jasmine.createSpyObj<JobSharedService>('JobSharedService', [
      'customerJob',
      'customerTimeline',
      'photoAttachments',
      'errorMessage',
    ]);
    jobs.customerJob.and.returnValue(of(request));
    jobs.customerTimeline.and.returnValue([
      { title: 'Inspection started', at: '2026-11-19T10:00:00.000Z' },
    ]);
    jobs.photoAttachments.and.returnValue([]);
    customerPortal = jasmine.createSpyObj<CustomerPortalService>('CustomerPortalService', [
      'getShop',
      'confirmPickup',
      'getRepairJob',
      'submitRepairReview',
    ]);
    customerPortal.getShop.and.returnValue(
      of({
        id: 'shop-123',
        shopName: 'Fixora Shop',
        businessType: 'Repair',
        description: '',
        yearsOfExperience: 0,
        services: [],
        address: '',
        street: '',
        area: '',
        city: '',
        state: '',
        country: '',
        postalCode: '',
        location: null,
        distanceKm: null,
        rating: null,
        reviewCount: 0,
        logoUrl: null,
        availability: 'unknown',
        phone: null,
        email: '',
      }),
    );
    customerPortal.confirmPickup.and.returnValue(of(undefined));
    customerPortal.getRepairJob.and.returnValue(of(request));

    await TestBed.configureTestingModule({
      imports: [CustomerActiveJobDetailPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => request._id } } },
        },
        { provide: JobSharedService, useValue: jobs },
        {
          provide: AuthService,
          useValue: {
            currentUser: () => ({
              firstName: 'Customer',
              lastName: 'One',
              email: 'customer@example.com',
              countryCode: '+1',
              mobileNumber: '5550100',
              profileImageUrl: null,
              location: null,
            }),
          },
        },
        { provide: CustomerPortalService, useValue: customerPortal },
      ],
    }).compileComponents();
  });

  it('keeps the active repair summary and matching detail-section order', () => {
    const fixture = TestBed.createComponent(CustomerActiveJobDetailPage);
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    const mainSections = Array.from(
      page.querySelectorAll('.customer-detail-main-card > .customer-detail-block'),
    );
    const sectionTitles = mainSections.map(
      (section) =>
        section.querySelector('.section-heading')?.textContent?.replace('↻', '').trim(),
    );

    expect(page.querySelector('.request-hero')).not.toBeNull();
    expect(page.querySelector('.request-progress')).not.toBeNull();
    expect(page.querySelector('.customer-detail-layout')).not.toBeNull();
    expect(sectionTitles).toEqual([
      'Customer Information',
      'Problem Description',
      'Location and Route',
      'Quotation and Payment',
      'Repair History',
    ]);
    expect(page.textContent).toContain('Active Repair Details');
    expect(page.querySelector('.repair-history-card app-job-timeline')).not.toBeNull();
    expect(page.querySelector('.repair-history-card .card-icon')?.textContent).toBe('↻');
    expect(page.querySelector('.repair-history-card')?.textContent).toContain('Inspection started');
  });

  it('shows an empty Repair History state when no history has been recorded', () => {
    jobs.customerTimeline.and.returnValue([]);
    jobs.customerJob.and.returnValue(
      of({ ...request, repairJob: { ...request.repairJob!, history: [] } }),
    );
    const fixture = TestBed.createComponent(CustomerActiveJobDetailPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.repair-history-card')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'No repair history has been recorded yet.',
    );
  });

  it('matches the Shop progress stages and horizontal tracker when pickup is required', () => {
    jobs.customerJob.and.returnValue(
      of({
        ...request,
        acceptedQuotationId: 'quotation-123',
        quotations: [
          {
            _id: 'quotation-123',
            repairRequestId: request._id,
            shopId: 'shop-123',
            amount: 44,
            currency: 'INR',
            message: 'Screen repair',
            status: 'accepted',
            createdAt: '2026-11-19T10:00:00.000Z',
            respondedAt: '2026-11-19T10:30:00.000Z',
          },
        ],
        repairJob: {
          ...request.repairJob!,
          acceptedQuotationId: 'quotation-123',
          requiresPhysicalPickup: true,
          servicePickup: {
            scheduledAt: '2026-11-19T11:00:00.000Z',
            collectedAt: '2026-11-19T12:00:00.000Z',
          },
        },
      }),
    );
    const fixture = TestBed.createComponent(CustomerActiveJobDetailPage);
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    const progress = page.querySelector('.request-progress') as HTMLOListElement;
    const steps = Array.from(progress.querySelectorAll('li'));
    expect(steps.map((step) => step.querySelector('strong')?.textContent?.trim())).toEqual([
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
    expect(steps[4].classList).toContain('current');
    expect(steps[4].getAttribute('aria-current')).toBe('step');
    expect(getComputedStyle(progress).gridAutoFlow).toBe('column');
    expect(getComputedStyle(progress).overflowX).toBe('auto');
  });

  it('opens the pickup confirmation popup from the right sidebar', () => {
    const readyRequest: CustomerRepairRequest = {
      ...request,
      acceptedQuotation: {
        _id: 'quotation-ready',
        repairRequestId: request._id,
        shopId: 'shop-123',
        amount: 44,
        currency: 'INR',
        message: 'Screen repair',
        status: 'accepted',
        createdAt: '2026-11-19T10:00:00.000Z',
      },
      repairJob: { status: 'ready_for_pickup' },
    };
    const pickedUpRequest: CustomerRepairRequest = {
      ...readyRequest,
      repairJob: { status: 'picked_up' },
    };
    jobs.customerJob.and.returnValue(of(readyRequest));
    customerPortal.getRepairJob.and.returnValue(of(pickedUpRequest));
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    const fixture = TestBed.createComponent(CustomerActiveJobDetailPage);
    fixture.detectChanges();

    const sidebar = fixture.nativeElement.querySelector(
      '.customer-detail-sidebar-card',
    ) as HTMLElement;
    const action = sidebar.querySelector('.pickup-confirmation-action') as HTMLElement;
    const actionButton = action.querySelector('button') as HTMLButtonElement;
    expect(actionButton.textContent?.trim()).toBe('Confirm item received');
    expect(actionButton.classList).toContain('job-button');
    expect(
      fixture.nativeElement.querySelector('.customer-detail-main .pickup-confirmation'),
    ).toBeNull();

    actionButton.click();
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector(
      '.pickup-confirmation-dialog',
    ) as HTMLElement;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.textContent).toContain('Confirm only after you have collected and inspected your item.');
    expect(dialog.textContent).toContain('Yes, I received my item');
    expect(dialog.textContent).toContain('Yes, I inspected the repair');
    expect(dialog.textContent).toContain('Repair satisfaction');
    expect(dialog.textContent).toContain('Additional comments (optional)');
    expect(dialog.textContent).toContain('Very satisfied');
    expect(dialog.textContent).toContain('Confirm item received');

    (dialog.querySelector('.decision-actions .primary-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(customerPortal.confirmPickup).toHaveBeenCalledWith(request._id, {
      received: true,
      inspected: true,
      satisfaction: 'satisfied',
      comments: undefined,
      issueDescription: undefined,
    });
    expect(navigate).toHaveBeenCalledWith([
      '/customer/jobs/completed-jobs',
      request._id,
    ]);
    expect(fixture.nativeElement.querySelector('.pickup-confirmation-dialog')).toBeNull();

    const reviewAction = sidebar.querySelector('.repair-review-action') as HTMLElement;
    expect(reviewAction.textContent).toContain('Rate your repair experience');
    expect(
      sidebar.textContent!.indexOf('Rate your repair experience'),
    ).toBeLessThan(sidebar.textContent!.indexOf('Device Information'));

    reviewAction.querySelector('button')?.dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();

    const reviewDialog = fixture.nativeElement.querySelector('.review-dialog') as HTMLElement;
    expect(reviewDialog.getAttribute('role')).toBe('dialog');
    expect(reviewDialog.textContent).toContain('Rate your repair experience');
    expect(reviewDialog.textContent).toContain('Overall shop rating');
    expect(reviewDialog.textContent).toContain('Repair quality');
    expect(reviewDialog.textContent).toContain('Your experience');
    expect(reviewDialog.textContent).toContain('Submit review and complete repair');

    const review: RepairReview = {
      _id: 'review-123',
      repairRequestId: readyRequest._id,
      overallRating: 5,
      repairQuality: 5,
      communication: 5,
      professionalism: 5,
      timeliness: 5,
      valueForMoney: 5,
      reviewText: 'Great repair',
      wouldRecommend: true,
      createdAt: '2026-11-19T13:00:00.000Z',
    };
    customerPortal.submitRepairReview.and.returnValue(of(review));
    customerPortal.getRepairJob.and.returnValue(
      of({ ...pickedUpRequest, repairJob: { status: 'completed' }, review }),
    );
    fixture.componentInstance.workflowRef()?.reviewText.set('Great repair');
    (reviewDialog.querySelector('.decision-actions .primary-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(customerPortal.submitRepairReview).toHaveBeenCalledWith(
      request._id,
      jasmine.objectContaining({ reviewText: 'Great repair' }),
    );
    expect(fixture.nativeElement.querySelector('.review-dialog')).toBeNull();
    expect(sidebar.textContent).toContain('Device Information');
  });
});
