import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { ShopSearchResult } from '../models/customer-portal.models';
import { CustomerPortalService } from '../services/customer-portal.service';
import { CustomerShopDetailsPage } from './customer-shop-details.page';

describe('CustomerShopDetailsPage', () => {
  function makeShop(overrides: Partial<ShopSearchResult> = {}): ShopSearchResult {
    return {
      id: 'shop-1',
      ownerName: 'Amit Shah',
      shopName: 'Amit Repair',
      businessType: 'Electronics Repair Shop',
      description: 'Repairs for common home appliances.',
      yearsOfExperience: 6,
      services: ['AC Repair', 'Refrigerator Repair'],
      address: '12 Main Street',
      street: '',
      area: '',
      city: 'Pune',
      state: 'Maharashtra',
      country: '',
      postalCode: '',
      location: null,
      distanceKm: 2.4,
      rating: 4.5,
      reviewCount: 8,
      logoUrl: null,
      profileImageUrl: 'data:image/png;base64,BB==',
      availability: 'unknown',
      phone: '+91 (987) 654-3210',
      email: 'contact@example.test',
      ...overrides,
    };
  }

  function createPage(shop: ShopSearchResult) {
    const portal = jasmine.createSpyObj<CustomerPortalService>('CustomerPortalService', [
      'getShop',
    ]);
    portal.getShop.and.returnValue(of(shop));

    TestBed.configureTestingModule({
      imports: [CustomerShopDetailsPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: shop.id }) } },
        },
        { provide: CustomerPortalService, useValue: portal },
      ],
    });

    const fixture = TestBed.createComponent(CustomerShopDetailsPage);
    fixture.detectChanges();
    return { fixture, portal };
  }

  it('renders the available shop profile, rating, contact actions, and repair request link', () => {
    const { fixture, portal } = createPage(makeShop());
    const element = fixture.nativeElement as HTMLElement;

    expect(portal.getShop).toHaveBeenCalledWith('shop-1');
    expect(element.querySelector('#shop-details-title')?.textContent?.trim()).toBe('Amit Repair');
    expect(element.querySelector('.owner-profile-copy strong')?.textContent?.trim()).toBe(
      'Amit Shah',
    );
    expect(element.querySelector('.owner-profile-photo img')?.getAttribute('alt')).toBe(
      'Amit Shah profile photo',
    );
    expect(element.querySelector('.detail-back-link')?.getAttribute('href')).toBe(
      '/customer/shops',
    );
    expect(element.querySelector('.hero-cover')).toBeNull();
    expect(
      element.querySelector('.shop-content-grid > .shop-main-column > .shop-hero'),
    ).not.toBeNull();
    expect(element.querySelectorAll('.shop-main-column > .panel-section').length).toBe(4);
    expect(
      element.querySelector('.shop-content-grid > .shop-side-column .contact-card'),
    ).not.toBeNull();
    expect(element.querySelectorAll('.shop-side-column > .panel-section').length).toBe(2);
    expect(element.querySelectorAll('.detail-card').length).toBe(0);
    expect(
      element.querySelector('.hero-request-button')?.classList.contains('button-primary'),
    ).toBeTrue();
    expect(element.textContent).toContain('Approved on Fixora');
    expect(element.textContent).toContain('4.5');
    expect(element.textContent).toContain('8 customer reviews');
    expect(element.textContent).toContain('2.4 km away');
    expect(element.textContent).toContain('Services Offered');
    expect(element.textContent).toContain('AC Repair');
    expect(element.textContent).toContain('12 Main Street, Pune, Maharashtra');
    expect(element.querySelector('.contact-row[href="tel:+919876543210"]')).not.toBeNull();
    expect(element.querySelector('.directions-action')?.getAttribute('href')).toContain(
      '12%20Main%20Street',
    );
    expect(element.querySelector('.hero-request-button')?.getAttribute('href')).toContain(
      'shop=shop-1',
    );

    const logo = element.querySelector('.shop-logo img');
    expect(logo).toBeNull();
    expect(element.querySelector('.shop-initials')?.textContent).toBe('A');
    fixture.destroy();
  });

  it('does not show a loading card while shop details are pending', () => {
    const portal = jasmine.createSpyObj<CustomerPortalService>('CustomerPortalService', [
      'getShop',
    ]);
    const pendingShop = new Subject<ShopSearchResult>();
    portal.getShop.and.returnValue(pendingShop.asObservable());

    TestBed.configureTestingModule({
      imports: [CustomerShopDetailsPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'shop-1' }) } },
        },
        { provide: CustomerPortalService, useValue: portal },
      ],
    });

    const fixture = TestBed.createComponent(CustomerShopDetailsPage);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.state-card')).toBeNull();

    pendingShop.complete();
    fixture.destroy();
  });

  it('falls back cleanly when profile details are absent and the shop image fails', () => {
    const { fixture } = createPage(
      makeShop({
        description: '',
        yearsOfExperience: 0,
        services: [],
        distanceKm: null,
        rating: null,
        reviewCount: 0,
        logoUrl: 'https://example.test/shop-logo.png',
        phone: null,
        email: '',
      }),
    );
    const element = fixture.nativeElement as HTMLElement;
    const logo = element.querySelector('.shop-logo img') as HTMLImageElement;
    const ownerPhoto = element.querySelector('.owner-profile-photo img') as HTMLImageElement;

    logo.dispatchEvent(new Event('error'));
    ownerPhoto.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(element.querySelector('.shop-logo img')).toBeNull();
    expect(element.querySelector('.shop-initials')?.textContent).toBe('A');
    expect(element.querySelector('.owner-profile-photo img')).toBeNull();
    expect(element.querySelector('.owner-profile-photo')?.textContent?.trim()).toBe('A');
    expect(element.textContent).toContain('No reviews yet');
    expect(element.textContent).toContain('This shop has not listed its repair services yet.');
    expect(element.textContent).toContain('Contact details have not been provided');
    expect(element.textContent).not.toContain('Working hours');
    expect(element.textContent).not.toContain('Availability');
    expect(element.querySelector('.contact-action')).toBeNull();
    expect(element.querySelector('.directions-action')).not.toBeNull();
    fixture.destroy();
  });
});
