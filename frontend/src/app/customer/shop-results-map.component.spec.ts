import { TestBed } from '@angular/core/testing';
import { ShopSearchResult } from './customer-portal.models';
import { clusterProjectedShops, ShopResultsMapComponent } from './shop-results-map.component';

describe('clusterProjectedShops', () => {
  it('displays the exact number of shops in each nearby cluster', () => {
    const points = [
      { shop: makeShop('shop-1'), x: 10, y: 10 },
      { shop: makeShop('shop-2'), x: 25, y: 20 },
      { shop: makeShop('shop-3'), x: 160, y: 100 },
    ];

    const clusters = clusterProjectedShops(points);

    expect(clusters.map((cluster) => cluster.shops.length).sort()).toEqual([1, 2]);
    expect(clusters.reduce((total, cluster) => total + cluster.shops.length, 0)).toBe(3);
  });
});

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
