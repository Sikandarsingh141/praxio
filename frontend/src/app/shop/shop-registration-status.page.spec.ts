import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../core/auth/auth.service';
import { ShopProfile } from '../core/auth/auth.models';
import { ShopRepairRequestsService } from './shop-repair-requests.service';
import { ShopRegistrationStatusPage } from './shop-registration-status.page';

describe('ShopRegistrationStatusPage', () => {
  const profile: ShopProfile = {
    shopName: 'Amit Shop',
    businessType: 'Electronics Repair Shop',
    description: 'Repair services for home appliances.',
    yearsOfExperience: 1,
    ownerFirstName: 'Amit',
    ownerLastName: 'Sharma',
    email: 'amit@example.com',
    countryCode: '+91',
    mobileNumber: '9876543210',
    address: 'Sector 70',
    city: 'Mohali',
    state: 'Punjab',
    country: 'India',
    postalCode: '140062',
    landmark: '',
    businessAddress: 'Sector 70, Mohali, Punjab, 140062',
    services: ['Refrigerator Repair', 'AC Repair'],
    subscriptionPlan: 'Fixroa Shop monthly subscription',
    subscriptionAmountCents: 2900,
    subscriptionCurrency: 'usd',
    paymentStatus: 'paid',
    registrationStatus: 'approved',
    accountLifecycleStatus: 'active',
    submittedAt: '2026-11-08T21:25:54.000Z',
    adminApprovalStatus: 'approved',
    declineReason: null,
    shopImageData: 'data:image/png;base64,c2hvcA==',
  };

  it('renders the profile summary, company tabs, and subscription details', async () => {
    const auth = {
      currentUser: signal({
        id: 'shop-1',
        email: profile.email,
        createdAt: '',
        profileImageUrl: 'data:image/png;base64,dXNlcg==',
      }),
      getMyShopProfile: jasmine.createSpy().and.returnValue(of(profile)),
      getMyShopInvoices: jasmine.createSpy().and.returnValue(
        of({
          invoices: [
            {
              stripeInvoiceId: 'in_test_invoice',
              invoiceNumber: 'INV-1001',
              totalAmountCents: 2900,
              amountPaidCents: 2900,
              refundedAmountCents: 0,
              currency: 'usd',
              status: 'paid',
              generatedAt: '2026-03-01T00:00:00.000Z',
              paidAt: '2026-03-01T00:01:00.000Z',
              hostedInvoiceUrl: 'https://invoice.stripe.test/hosted',
              invoicePdfUrl: 'https://invoice.stripe.test/invoice.pdf',
            },
          ],
          pagination: { page: 1, limit: 5, total: 1, totalPages: 1 },
        }),
      ),
    };
    const shopRequests = {
      getReviews: jasmine.createSpy().and.returnValue(
        of({
          averageRating: 3.9,
          reviewCount: 26,
          distribution: [],
          reviews: [],
        }),
      ),
    };
    await TestBed.configureTestingModule({
      imports: [ShopRegistrationStatusPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ShopRepairRequestsService, useValue: shopRequests },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ShopRegistrationStatusPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Amit Shop');
    expect(fixture.nativeElement.textContent).toContain('3.9 Rating');
    expect(fixture.nativeElement.textContent).toContain('Company Information');
    expect(fixture.nativeElement.textContent).toContain('Business Address');
    expect(fixture.nativeElement.textContent).toContain('Refrigerator Repair, AC Repair');
    expect(fixture.nativeElement.querySelector('.profile-layout')).toBeTruthy();
    const summaryPhoto = fixture.nativeElement.querySelector(
      '.profile-summary-card .shop-avatar img',
    ) as HTMLImageElement;
    expect(summaryPhoto.src).toContain('dXNlcg==');
    expect(summaryPhoto.alt).toBe('Amit Sharma profile photo');

    const subscriptionTab = fixture.nativeElement.querySelectorAll(
      '[role="tab"]',
    )[1] as HTMLButtonElement;
    subscriptionTab.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Subscription Details');
    expect(fixture.nativeElement.textContent).toContain('Paid');
    expect(fixture.nativeElement.textContent).toContain('INV-1001');
    const invoiceLinks = fixture.nativeElement.querySelectorAll(
      '.invoice-links a',
    ) as NodeListOf<HTMLAnchorElement>;
    expect(invoiceLinks.length).toBe(2);
    expect(invoiceLinks[1].href).toBe('https://invoice.stripe.test/invoice.pdf');

    (fixture.nativeElement.querySelector('.edit-profile-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-shop-profile-editor')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Edit Business Profile');
    expect(fixture.nativeElement.textContent).toContain('Business Address Information');
    expect(fixture.nativeElement.querySelector('app-shop-image-editor')).toBeTruthy();

    (fixture.nativeElement.querySelector('.cancel-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Business profile');
    expect(fixture.nativeElement.querySelector('app-shop-profile-editor')).toBeNull();
  });
});
