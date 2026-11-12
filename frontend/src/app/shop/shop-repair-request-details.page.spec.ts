import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { ShopProfile } from '../core/auth/auth.models';
import { ShopRepairRequest } from './shop-repair-requests.models';
import { ShopRepairRequestsService } from './shop-repair-requests.service';
import { ShopRepairRequestDetailsPage } from './shop-repair-request-details.page';

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
          useValue: { snapshot: { paramMap: convertToParamMap({ id: request._id }) } },
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
          },
        },
        {
          provide: AuthService,
          useValue: { getMyShopProfile: jasmine.createSpy().and.returnValue(of(shopProfile)) },
        },
      ],
    }).compileComponents();
  });

  it('shows the request progress design and directions without invented route metrics', () => {
    const fixture = TestBed.createComponent(ShopRepairRequestDetailsPage);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
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
});
