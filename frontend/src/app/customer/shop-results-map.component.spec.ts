import { TestBed } from '@angular/core/testing';
import * as L from 'leaflet';
import { ShopSearchResult } from './customer-portal.models';
import { ShopResultsMapComponent } from './shop-results-map.component';

describe('ShopResultsMapComponent', () => {
  it('lets the map canvas fill its grid row beside the shop list', () => {
    TestBed.configureTestingModule({ imports: [ShopResultsMapComponent] });
    const fixture = TestBed.createComponent(ShopResultsMapComponent);
    fixture.detectChanges();

    const mapShell = fixture.nativeElement.querySelector('.map-shell') as HTMLElement;
    const mapCanvas = fixture.nativeElement.querySelector('.shop-map') as HTMLElement;
    expect(parseFloat(getComputedStyle(mapShell).minHeight)).toBeGreaterThan(0);
    expect(parseFloat(getComputedStyle(mapCanvas).minHeight)).toBeGreaterThan(0);
    expect(mapCanvas.getBoundingClientRect().height).toBeGreaterThanOrEqual(
      mapShell.getBoundingClientRect().height,
    );
    fixture.destroy();
  });

  it('provides an accessible control to expand the map', () => {
    TestBed.configureTestingModule({ imports: [ShopResultsMapComponent] });
    const fixture = TestBed.createComponent(ShopResultsMapComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    spyOn(component, 'toggleFullscreen');

    const button = fixture.nativeElement.querySelector(
      '.map-fullscreen-control',
    ) as HTMLButtonElement;
    button.click();

    expect(button.getAttribute('aria-label')).toBe('Expand map to full screen');
    expect(component.toggleFullscreen).toHaveBeenCalled();
    fixture.destroy();
  });

  it('keeps Leaflet overlay layers inside the map stacking context', () => {
    TestBed.configureTestingModule({ imports: [ShopResultsMapComponent] });
    const fixture = TestBed.createComponent(ShopResultsMapComponent);
    fixture.detectChanges();

    const shell = fixture.nativeElement.querySelector('.map-shell') as HTMLElement;
    expect(getComputedStyle(shell).zIndex).toBe('0');
    fixture.destroy();
  });

  it('enables mouse-wheel zoom on the map', () => {
    TestBed.configureTestingModule({ imports: [ShopResultsMapComponent] });
    const fixture = TestBed.createComponent(ShopResultsMapComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance['map']?.scrollWheelZoom.enabled()).toBeTrue();
    fixture.destroy();
  });

  it('shows an individual blue dot and detailed actions for a single shop', () => {
    TestBed.configureTestingModule({ imports: [ShopResultsMapComponent] });
    const fixture = TestBed.createComponent(ShopResultsMapComponent);
    const shop = {
      ...makeShop('shop-1'),
      shopName: 'Aarav <script>alert(1)</script>',
      businessType: 'Electronics Repair Shop',
      services: ['Mobile Repair', 'Computer Repair'],
      rating: 4.8,
      reviewCount: 276,
      distanceKm: 2.4,
      logoUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/rNcAAAAASUVORK5CYII=',
      address: '14 Residency Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560025',
    };
    fixture.componentInstance.shops = [shop];
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.shop-marker-dot')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.shop-marker-cluster')).toBeNull();
    const marker = fixture.componentInstance['shopMarkers'].getLayers()[0] as L.Marker;
    const popup = marker.getPopup()?.getContent() as string;
    expect(popup).toContain(
      '<img class="shop-map-popup-photo" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/rNcAAAAASUVORK5CYII="',
    );
    expect(popup).toContain('Aarav &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(popup).toContain('4.8 (276 reviews)');
    expect(popup).toContain('14 Residency Road, Bengaluru, Karnataka, 560025');
    expect(popup).toContain('Mobile Repair');
    expect(popup).toContain('Get Directions');
    expect(popup).toContain('View Details');
    expect(popup).toContain('Request a Repair');
    fixture.destroy();
  });

  it('renders a separate dot for every shop, even at the same coordinates', () => {
    TestBed.configureTestingModule({ imports: [ShopResultsMapComponent] });
    const fixture = TestBed.createComponent(ShopResultsMapComponent);
    fixture.componentInstance.shops = [makeShop('shop-1'), makeShop('shop-2'), makeShop('shop-3')];
    fixture.detectChanges();

    const markers = fixture.componentInstance['shopMarkers'].getLayers() as L.Marker[];
    expect(markers.length).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('.shop-marker-dot').length).toBe(3);
    expect(fixture.nativeElement.querySelector('.shop-marker-cluster')).toBeNull();
    const locations = markers.map((marker) => {
      const latLng = marker.getLatLng();
      return `${latLng.lat},${latLng.lng}`;
    });
    expect(new Set(locations).size).toBe(3);
    expect(markers.map((marker) => marker.getPopup()?.getContent())).toEqual(
      jasmine.arrayContaining([
        jasmine.stringMatching(/shop-1/),
        jasmine.stringMatching(/shop-2/),
        jasmine.stringMatching(/shop-3/),
      ]),
    );
    fixture.destroy();
  });

  it('keeps the user location marker visible alongside shop dots', () => {
    TestBed.configureTestingModule({ imports: [ShopResultsMapComponent] });
    const fixture = TestBed.createComponent(ShopResultsMapComponent);
    fixture.componentInstance.shops = [makeShop('shop-1')];
    fixture.componentInstance.center = { latitude: 27.1767, longitude: 78.0081 };
    fixture.detectChanges();

    expect(fixture.componentInstance['locationMarkers'].getLayers().length).toBe(1);
    expect(fixture.componentInstance['shopMarkers'].getLayers().length).toBe(1);
    expect(fixture.nativeElement.querySelector('.shop-marker-dot')).not.toBeNull();
    fixture.destroy();
  });

  it('opens the matching shop popup when a spread dot is clicked', () => {
    TestBed.configureTestingModule({ imports: [ShopResultsMapComponent] });
    const fixture = TestBed.createComponent(ShopResultsMapComponent);
    fixture.componentInstance.shops = [makeShop('shop-1'), makeShop('shop-2')];
    fixture.detectChanges();

    const markers = fixture.componentInstance['shopMarkers'].getLayers() as L.Marker[];
    expect(markers.length).toBe(2);
    expect(markers[0].getLatLng().equals(markers[1].getLatLng())).toBeFalse();

    markers[1].fire('click');

    expect(markers[1].getPopup()?.isOpen()).toBeTrue();
    expect(markers[1].getPopup()?.getContent()).toContain('shop-2');
    fixture.destroy();
  });

  it('spreads shops with nearby locations into distinct markers', () => {
    TestBed.configureTestingModule({ imports: [ShopResultsMapComponent] });
    const fixture = TestBed.createComponent(ShopResultsMapComponent);
    fixture.componentInstance.shops = [
      makeShop('shop-1'),
      {
        ...makeShop('shop-2'),
        location: { latitude: 27.17671, longitude: 78.00811 },
      },
    ];
    fixture.detectChanges();

    const markers = fixture.componentInstance['shopMarkers'].getLayers() as L.Marker[];
    expect(markers.length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('.shop-marker-dot').length).toBe(2);
    expect(markers[0].getLatLng().equals(markers[1].getLatLng())).toBeFalse();
    expect(markers.map((marker) => marker.getPopup()?.getContent())).toEqual(
      jasmine.arrayContaining([jasmine.stringMatching(/shop-1/), jasmine.stringMatching(/shop-2/)]),
    );
    fixture.destroy();
  });

  it('emits the shop when the popup Request a Repair action is selected', () => {
    TestBed.configureTestingModule({ imports: [ShopResultsMapComponent] });
    const fixture = TestBed.createComponent(ShopResultsMapComponent);
    const shop = makeShop('shop-1');
    fixture.componentInstance.shops = [shop];
    let requestedShop: ShopSearchResult | undefined;
    fixture.componentInstance.requestRepair.subscribe((value) => (requestedShop = value));
    fixture.detectChanges();

    const marker = fixture.componentInstance['shopMarkers'].getLayers()[0] as L.Marker;
    marker.openPopup();
    const button = document.querySelector<HTMLButtonElement>('[data-request-shop]');
    expect(button).not.toBeNull();
    button?.click();

    expect(requestedShop).toBe(shop);
    fixture.destroy();
  });

  it('zooms to the selected shop coordinates', () => {
    TestBed.configureTestingModule({ imports: [ShopResultsMapComponent] });
    const fixture = TestBed.createComponent(ShopResultsMapComponent);
    fixture.componentInstance.shops = [
      { ...makeShop('shop-1'), location: { latitude: 28.6139, longitude: 77.209 } },
    ];
    fixture.detectChanges();

    const map = fixture.componentInstance['map'];
    const flyTo = spyOn(map!, 'flyTo');
    fixture.componentInstance.focusShop('shop-1');

    expect(flyTo).toHaveBeenCalledWith([28.6139, 77.209], 15, { duration: 0.7 });
    fixture.destroy();
  });
});

function makeShop(id: string): ShopSearchResult {
  return {
    id,
    shopName: id,
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
    location: { latitude: 27.1767, longitude: 78.0081 },
    distanceKm: null,
    rating: null,
    reviewCount: 0,
    logoUrl: null,
    availability: 'unknown',
    phone: null,
    email: '',
  };
}
