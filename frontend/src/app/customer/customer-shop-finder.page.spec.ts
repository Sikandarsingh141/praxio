import { By } from '@angular/platform-browser';
import { ActivatedRoute, provideRouter, Router, convertToParamMap } from '@angular/router';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { AddressSuggestion, ShopSearchResult } from './customer-portal.models';
import { formatShopAddress } from '../shared/format-shop-address';
import { CustomerPortalService } from './customer-portal.service';
import { CustomerShopFinderPage } from './customer-shop-finder.page';
import { ShopResultsMapComponent } from './shop-results-map.component';

describe('CustomerShopFinderPage', () => {
  it('shows the inline location spinner only while address suggestions are pending', fakeAsync(() => {
    const portal = createPortalMock();
    const suggestions = new Subject<AddressSuggestion[]>();
    portal.searchShops.and.returnValue(of([]));
    portal.suggestAddresses.and.returnValue(suggestions);
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

    expect(portal.searchShops).toHaveBeenCalledWith(jasmine.any(Object));
    expect(fixture.nativeElement.querySelector('.inline-search-spinner')).toBeNull();

    page.onAddressInput('Pune');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.inline-search-spinner')).not.toBeNull();

    tick(350);
    expect(portal.suggestAddresses).toHaveBeenCalledWith('Pune', true);
    suggestions.next([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.inline-search-spinner')).toBeNull();
    fixture.destroy();
  }));

  it('selects up to five visible shops at once', () => {
    const portal = createPortalMock();
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

    expect(
      fixture.nativeElement.querySelector('app-admin-page-header .admin-page-title')?.textContent,
    ).toContain('Find Repair Shops');
    expect(
      fixture.nativeElement.querySelector('app-admin-page-header .admin-page-description')
        ?.textContent,
    ).toContain('Explore approved repair shops near you');
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

  it('reveals more shop results when scrolling instead of showing pagination', () => {
    const portal = createPortalMock();
    portal.searchShops.and.returnValue(
      of(Array.from({ length: 24 }, (_, index) => makeShop(`shop-${index + 1}`, `Shop ${index + 1}`))),
    );
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
    const page = fixture.componentInstance;
    const results = fixture.nativeElement.querySelector('.shop-results') as HTMLElement;
    const scrollTo = (scrollTop: number, scrollHeight: number): void => {
      Object.defineProperties(results, {
        scrollTop: { configurable: true, value: scrollTop },
        scrollHeight: { configurable: true, value: scrollHeight },
        clientHeight: { configurable: true, value: 440 },
      });
      results.dispatchEvent(new Event('scroll'));
      fixture.detectChanges();
    };

    expect(page.visibleShops()).toHaveSize(10);
    expect(fixture.nativeElement.querySelectorAll('.shop-card')).toHaveSize(10);
    expect(fixture.nativeElement.querySelector('app-pagination')).toBeNull();
    expect(fixture.nativeElement.querySelector('.results-heading h2').textContent).toContain(
      '24 shops found',
    );
    expect(fixture.nativeElement.querySelector('.shop-load-more-hint')?.textContent).toContain(
      'Scroll to load more shops',
    );

    scrollTo(200, 2000);
    expect(page.visibleShops()).toHaveSize(10);

    scrollTo(1450, 2000);
    expect(page.visibleShops()).toHaveSize(20);
    expect(fixture.nativeElement.querySelectorAll('.shop-card')).toHaveSize(20);

    scrollTo(2500, 3000);
    expect(page.visibleShops()).toHaveSize(24);
    expect(fixture.nativeElement.querySelectorAll('.shop-card')).toHaveSize(24);
    expect(fixture.nativeElement.querySelector('.shop-load-more-hint')).toBeNull();
    fixture.destroy();
  });

  it('renders shop photos from search data and shows a fallback when a photo cannot load', () => {
    const portal = createPortalMock();
    const shopImageData =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/bGkAAAAASUVORK5CYII=';
    portal.searchShops.and.returnValue(
      of([
        {
          ...makeShop('shop-1', 'Amit Repair'),
          logoUrl: shopImageData,
          businessType: 'Electronics Repair',
          services: ['Mobile Repair', 'TV Repair'],
          address: 'Main Road',
          city: 'Pune',
          rating: 4.5,
          reviewCount: 8,
          distanceKm: 2.3,
        },
      ]),
    );
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
    spyOn(page, 'focusShopOnMap');
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('.shop-card') as HTMLElement;
    const photo = card.querySelector('img') as HTMLImageElement;
    expect(photo.loading).toBe('lazy');
    expect(photo.src).toBe(shopImageData);
    expect(photo.alt).toBe('Amit Repair shop photo');
    expect(card.textContent).toContain('Electronics Repair');
    expect(card.textContent).toContain('4.5');
    expect(card.textContent).toContain('(8 reviews)');
    expect(card.textContent).toContain('2.3 km away');
    expect(card.querySelector('.approved-badge')).toBeNull();
    expect(card.textContent).not.toContain('Approved');
    expect(card.querySelectorAll('.service-tag')).toHaveSize(2);

    (card.querySelector('.shop-view') as HTMLButtonElement).click();
    expect(page.focusShopOnMap).toHaveBeenCalledWith(page.shops()[0]);

    photo.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(card.querySelector('.shop-photo-placeholder')?.textContent).toContain(
      'Shop photo unavailable',
    );
    fixture.destroy();
  });

  it('searches for shops in the request form and adds and removes them', fakeAsync(() => {
    const portal = createPortalMock();
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
    const portal = createPortalMock();
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

  it('focuses the map on a shop when its result card is clicked', () => {
    const portal = createPortalMock();
    const shop = {
      ...makeShop('shop-1', 'Amit Shop'),
      location: { latitude: 28.6139, longitude: 77.209 },
    };
    portal.searchShops.and.returnValue(of([shop]));
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
    const map = fixture.debugElement.query(By.directive(ShopResultsMapComponent))
      .componentInstance as ShopResultsMapComponent;
    spyOn(map, 'focusShop');

    (fixture.nativeElement.querySelector('.shop-card') as HTMLElement).click();

    expect(map.focusShop).toHaveBeenCalledWith(shop.id);
    expect(fixture.nativeElement.querySelector('.shop-view')?.textContent).toContain(
      'Show on map',
    );
    fixture.destroy();
  });

  it('opens the repair form without navigating away from the shop finder', () => {
    const portal = createPortalMock();
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
    const scrollIntoView = spyOn(requestPanel, 'scrollIntoView');

    (fixture.nativeElement.querySelector('.request-link') as HTMLButtonElement).click();

    expect(router.url).toBe(originalUrl);
    expect(document.activeElement).toBe(requestPanel);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'end' });
    expect(requestPanel.querySelector('#request-title')?.textContent).toContain(
      'Request a Repair for',
    );
  });

  it('navigates to the created repair request details', () => {
    const portal = createPortalMock();
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
    const portal = createPortalMock();
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

function createPortalMock(): jasmine.SpyObj<CustomerPortalService> {
  const portal = jasmine.createSpyObj<CustomerPortalService>('CustomerPortalService', [
    'searchShops',
    'suggestAddresses',
    'createRepairRequest',
  ]);
  return portal;
}
