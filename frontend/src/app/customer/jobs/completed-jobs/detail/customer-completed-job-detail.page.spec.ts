import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { CustomerRepairRequest } from '../../../models/customer-portal.models';
import { CustomerPortalService } from '../../../services/customer-portal.service';
import { JobSharedService } from '../../../../shared/services/job-shared.service';
import { RepairInvoicesService } from '../../../../shared/services/repair-invoices.service';
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
  let repairInvoices: jasmine.SpyObj<RepairInvoicesService>;

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

    customerPortal = jasmine.createSpyObj<CustomerPortalService>('CustomerPortalService', [
      'getShop',
      'getRepairRoute',
      'submitRepairReview',
    ]);
    customerPortal.getShop.and.returnValue(
      of({
        id: 'shop-123',
        ownerName: 'Shop Owner',
        shopName: 'Fixora Shop',
        businessType: 'Repair',
        description: '',
        yearsOfExperience: 0,
        services: [],
        address: 'Main Road',
        street: '',
        area: '',
        city: 'Pune',
        state: '',
        country: 'India',
        postalCode: '',
        location: null,
        distanceKm: null,
        rating: 4.5,
        reviewCount: 8,
        logoUrl: null,
        profileImageUrl: null,
        availability: 'unknown',
        phone: '+1 5550101',
        email: 'shop@example.com',
      }),
    );
    repairInvoices = jasmine.createSpyObj<RepairInvoicesService>('RepairInvoicesService', [
      'getCustomerInvoiceForRepair',
    ]);
    repairInvoices.getCustomerInvoiceForRepair.and.returnValue(of(null));

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
        { provide: RepairInvoicesService, useValue: repairInvoices },
      ],
    }).compileComponents();
  });

  it('shows the repair shop profile on completed repair details', () => {
    const fixture = TestBed.createComponent(CustomerCompletedJobDetailPage);
    fixture.detectChanges();

    const shopProfile = fixture.nativeElement.querySelector(
      'app-customer-repair-shop-profile',
    ) as HTMLElement;
    expect(shopProfile.textContent).toContain('Shopkeeper Name');
    expect(shopProfile.textContent).toContain('Shop Owner');
    expect(shopProfile.textContent).toContain('Fixora Shop');
    expect(shopProfile.textContent).toContain('shop@example.com');
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

  it('shows invoice availability in the customer invoice dialog', () => {
    const fixture = TestBed.createComponent(CustomerCompletedJobDetailPage);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      '.invoice-open-button',
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('.invoice-modal-dialog') as HTMLElement;
    expect(dialog.textContent).toContain('The shop has not generated the invoice yet.');
    expect(dialog.textContent).toContain('It will appear here once the shop issues it.');
  });
});
