import { ActivatedRoute, provideRouter, Router, convertToParamMap } from '@angular/router';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { ShopSearchResult } from './customer-portal.models';
import { formatShopAddress } from '../shared/format-shop-address';
import { CustomerPortalService } from './customer-portal.service';
import { CustomerShopFinderPage } from './customer-shop-finder.page';

describe('CustomerShopFinderPage', () => {
  it('selects up to five visible shops at once', () => {
    const portal = jasmine.createSpyObj<CustomerPortalService>('CustomerPortalService', [
      'searchShops',
      'createRepairRequest',
    ]);
    const shops: ShopSearchResult[] = Array.from({ length: 6 }, (_, index) => ({
      id: `shop-${index + 1}`,
      shopName: `Shop ${index + 1}`,
      businessType: 'Electronics Repair Shop',
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
    }));
    portal.searchShops.and.returnValue(of(shops));
    portal.createRepairRequest.and.returnValue(of('created-request-id'));

    TestBed.configureTestingModule({
      imports: [CustomerShopFinderPage],
      providers: [
        { provide: CustomerPortalService, useValue: portal },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
        provideRouter([]),
      ],
    });

    const fixture = TestBed.createComponent(CustomerShopFinderPage);
    const page = fixture.componentInstance;
    fixture.detectChanges();

    page.toggleVisibleShops();

    expect(page.selectedShops()).toEqual(['shop-1', 'shop-2', 'shop-3', 'shop-4', 'shop-5']);
    expect(page.selectedShopDetails().map(({ shop }) => shop?.shopName)).toEqual([
      'Shop 1',
      'Shop 2',
      'Shop 3',
      'Shop 4',
      'Shop 5',
    ]);
    expect(page.requestError()).toBe('');

    page.toggleVisibleShops();
    expect(page.selectedShops()).toEqual([]);
    expect(page.requestError()).toBe('');

    page.toggleVisibleShops();
    page.addShop(shops[5]);
    expect(page.selectedShops()).toHaveSize(5);
    expect(page.shopPickerMessage()).toContain('up to 5');

    page.removeShop('shop-1');
    page.addShop(shops[5]);
    page.addShop(shops[5]);
    expect(page.selectedShops()).toEqual(['shop-2', 'shop-3', 'shop-4', 'shop-5', 'shop-6']);
  });

  it('searches for shops in the request form and adds and removes them', fakeAsync(() => {
    const portal = jasmine.createSpyObj<CustomerPortalService>('CustomerPortalService', [
      'searchShops',
      'createRepairRequest',
    ]);
    const shops = [makeShop('shop-1', 'Amit Shop'), makeShop('shop-2', 'Rahul Repair')];
    portal.searchShops.and.returnValue(of(shops));
    portal.createRepairRequest.and.returnValue(of('created-request-id'));

    TestBed.configureTestingModule({
      imports: [CustomerShopFinderPage],
      providers: [
        { provide: CustomerPortalService, useValue: portal },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
        provideRouter([]),
      ],
    });

    const fixture = TestBed.createComponent(CustomerShopFinderPage);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    page.toggleShop('shop-1');
    page.onShopSearchInput('Rahul');
    tick(300);
    fixture.detectChanges();

    const addButton = fixture.nativeElement.querySelector(
      '.shop-search-results button',
    ) as HTMLButtonElement;
    expect(addButton.textContent).toContain('Add');
    addButton.click();
    fixture.detectChanges();

    expect(page.selectedShops()).toEqual(['shop-1', 'shop-2']);
    expect(fixture.nativeElement.querySelectorAll('.selected-shop-list li')).toHaveSize(2);
    expect(fixture.nativeElement.querySelector('.shop-search-results').textContent).toContain(
      'Added',
    );

    page.addShop(shops[1]);
    expect(page.selectedShops()).toEqual(['shop-1', 'shop-2']);

    const removeButton = fixture.nativeElement.querySelector(
      '.selected-shop-list button[aria-label="Remove Amit Shop"]',
    ) as HTMLButtonElement;
    removeButton.click();
    fixture.detectChanges();
    expect(page.selectedShops()).toEqual(['shop-2']);
    expect(fixture.nativeElement.querySelectorAll('.selected-shop-list li')).toHaveSize(1);
  }));

  it('renders the shop finder alongside the repair request form', () => {
    const portal = jasmine.createSpyObj<CustomerPortalService>('CustomerPortalService', [
      'searchShops',
      'createRepairRequest',
    ]);
    portal.searchShops.and.returnValue(of([]));
    portal.createRepairRequest.and.returnValue(of('created-request-id'));

    TestBed.configureTestingModule({
      imports: [CustomerShopFinderPage],
      providers: [
        { provide: CustomerPortalService, useValue: portal },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
        provideRouter([]),
      ],
    });

    const fixture = TestBed.createComponent(CustomerShopFinderPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.finder-layout')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.results-layout')).toBeTruthy();
    expect(
      getComputedStyle(fixture.nativeElement.querySelector('.shop-results')).overflowY,
    ).toBe('auto');
    expect(fixture.nativeElement.querySelector('.request-panel-header h2')?.textContent).toContain(
      'Request a Repair',
    );
    expect(fixture.nativeElement.querySelector('.shop-map')).toBeTruthy();
  });

  it('opens the repair form without navigating away from the shop finder', () => {
    const portal = jasmine.createSpyObj<CustomerPortalService>('CustomerPortalService', [
      'searchShops',
      'createRepairRequest',
    ]);
    portal.searchShops.and.returnValue(of([]));
    portal.createRepairRequest.and.returnValue(of('created-request-id'));

    TestBed.configureTestingModule({
      imports: [CustomerShopFinderPage],
      providers: [
        { provide: CustomerPortalService, useValue: portal },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
        provideRouter([]),
      ],
    });

    const fixture = TestBed.createComponent(CustomerShopFinderPage);
    const router = TestBed.inject(Router);
    fixture.detectChanges();
    const originalUrl = router.url;
    const requestPanel = fixture.nativeElement.querySelector('.request-panel');

    (fixture.nativeElement.querySelector('.request-link') as HTMLButtonElement).click();

    expect(router.url).toBe(originalUrl);
    expect(document.activeElement).toBe(requestPanel);
    expect(requestPanel.querySelector('#request-title')?.textContent).toContain(
      'Request a Repair for',
    );
  });

  it('navigates to the created repair request details', () => {
    const portal = jasmine.createSpyObj<CustomerPortalService>('CustomerPortalService', [
      'searchShops',
      'createRepairRequest',
    ]);
    portal.searchShops.and.returnValue(of([]));
    portal.createRepairRequest.and.returnValue(of('created-request-id'));

    TestBed.configureTestingModule({
      imports: [CustomerShopFinderPage],
      providers: [
        { provide: CustomerPortalService, useValue: portal },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
        provideRouter([]),
      ],
    });

    const fixture = TestBed.createComponent(CustomerShopFinderPage);
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    const page = fixture.componentInstance;
    page.selectedShops.set(['shop-id', 'another-shop-id']);
    page.appliance.set('Refrigerator');
    page.description.set('Not cooling');
    fixture.detectChanges();

    page.submitRepairRequest();

    expect(portal.createRepairRequest).toHaveBeenCalledTimes(1);
    expect(portal.createRepairRequest).toHaveBeenCalledWith(
      jasmine.objectContaining({ shopIds: ['shop-id', 'another-shop-id'] }),
    );
    expect(router.navigate).toHaveBeenCalledWith([
      '/customer/repair-requests',
      'created-request-id',
    ]);
  });

  it('does not repeat address parts already present in the full address', () => {
    expect(
      formatShopAddress({
        address: 'Agra, Uttar Pradesh, 280001',
        street: '',
        area: 'Agra',
        city: 'Agra',
        state: 'Uttar Pradesh',
        postalCode: '280001',
        country: 'India',
      }),
    ).toBe('Agra, Uttar Pradesh, 280001, India');
  });

  it('enables rating filtering and highest-rated sorting', () => {
    const portal = jasmine.createSpyObj<CustomerPortalService>('CustomerPortalService', [
      'searchShops',
      'createRepairRequest',
    ]);
    portal.searchShops.and.returnValue(of([]));
    portal.createRepairRequest.and.returnValue(of('created-request-id'));

    TestBed.configureTestingModule({
      imports: [CustomerShopFinderPage],
      providers: [
        { provide: CustomerPortalService, useValue: portal },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
        provideRouter([]),
      ],
    });

    const fixture = TestBed.createComponent(CustomerShopFinderPage);
    const page = fixture.componentInstance;
    fixture.detectChanges();

    const ratingSelect = fixture.nativeElement.querySelector(
      'select[aria-label="Minimum rating"]',
    ) as HTMLSelectElement;
    expect(ratingSelect.disabled).toBeFalse();
    expect(
      Array.from(ratingSelect.options).map((option) => option.textContent?.trim()),
    ).toContain('4 stars & up');

    page.minimumRating.set('4');
    page.sortBy.set('rating');
    page.search();
    expect(portal.searchShops.calls.mostRecent().args[0]).toEqual(
      jasmine.objectContaining({ minRating: 4, sort: 'rating' }),
    );
  });
});

function makeShop(id: string, shopName: string): ShopSearchResult {
  return {
    id,
    shopName,
    businessType: 'Electronics Repair Shop',
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
  };
}
