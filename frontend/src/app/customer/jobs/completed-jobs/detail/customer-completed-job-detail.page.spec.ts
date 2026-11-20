import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { CustomerRepairRequest } from '../../../models/customer-portal.models';
import { CustomerPortalService } from '../../../services/customer-portal.service';
import { JobSharedService } from '../../../../shared/services/job-shared.service';
import { CustomerCompletedJobDetailPage } from './customer-completed-job-detail.page';

describe('CustomerCompletedJobDetailPage', () => {
  const request: CustomerRepairRequest = {
    _id: 'request-completed-123',
    shopIds: [],
    appliance: 'Phone',
    brand: 'Example',
    model: 'Model One',
    description: 'Screen replacement',
    status: 'open',
    createdAt: '2026-11-18T10:00:00.000Z',
    quotations: [
      {
        _id: 'quotation-123',
        repairRequestId: 'request-completed-123',
        shopId: 'shop-123',
        amount: 150,
        currency: 'USD',
        message: 'Screen replacement',
        status: 'accepted',
        createdAt: '2026-11-19T10:00:00.000Z',
      },
    ],
    acceptedQuotation: {
      _id: 'quotation-123',
      repairRequestId: 'request-completed-123',
      shopId: 'shop-123',
      amount: 150,
      currency: 'USD',
      message: 'Screen replacement',
      status: 'accepted',
      createdAt: '2026-11-19T10:00:00.000Z',
    },
    photos: [],
    shop: null,
    repairJob: {
      status: 'picked_up',
      approvedRepairAmount: 150,
      approvedAdditionalCharges: 20,
    },
  };
  let jobs: jasmine.SpyObj<JobSharedService>;
  let customerPortal: jasmine.SpyObj<CustomerPortalService>;

  beforeEach(async () => {
    jobs = jasmine.createSpyObj<JobSharedService>('JobSharedService', [
      'customerJob',
      'customerTimeline',
      'customerProgress',
      'photoAttachments',
      'errorMessage',
    ]);
    jobs.customerJob.and.returnValue(of(request));
    jobs.customerTimeline.and.returnValue([]);
    jobs.customerProgress.and.returnValue([]);
    jobs.photoAttachments.and.returnValue([]);

    customerPortal = jasmine.createSpyObj<CustomerPortalService>(
      'CustomerPortalService',
      ['getShop', 'getRepairRoute', 'submitRepairReview'],
    );

    await TestBed.configureTestingModule({
      imports: [CustomerCompletedJobDetailPage],
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

  it('opens the review popup from the completed repair details', () => {
    const fixture = TestBed.createComponent(CustomerCompletedJobDetailPage);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      '.repair-review-action button',
    ) as HTMLButtonElement;
    expect(button.textContent?.trim()).toBe('Rate your repair experience');
    expect(button.disabled).toBeFalse();
    expect(fixture.nativeElement.querySelector('.review-dialog')).toBeNull();

    button.click();
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('.review-dialog') as HTMLElement;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.textContent).toContain('Overall shop rating');
    expect(dialog.textContent).toContain('Repair quality');
    expect(dialog.textContent).toContain('Your experience');
    expect(
      dialog.querySelector('textarea[placeholder="Tell us about your repair experience..."]'),
    ).not.toBeNull();
  });

  it('shows the repair cost summary after the quotation in the same section', () => {
    const fixture = TestBed.createComponent(CustomerCompletedJobDetailPage);
    fixture.detectChanges();

    const quotationSection = fixture.nativeElement.querySelector(
      '.quotation-section',
    ) as HTMLElement;
    expect(
      fixture.nativeElement.querySelector('[aria-labelledby="cost-summary-title"]'),
    ).toBeNull();
    expect(quotationSection.textContent).toContain('Repair Cost Summary');
    expect(quotationSection.textContent).toContain('Approved repair estimate');
    expect(quotationSection.textContent).toContain('Approved additional charges');
    expect(quotationSection.textContent).toContain('Total approved cost');
    expect(quotationSection.textContent).toContain('$170.00');
    expect(quotationSection.textContent!.indexOf('Quotation and Payment')).toBeLessThan(
      quotationSection.textContent!.indexOf('Repair Cost Summary'),
    );
  });
});
