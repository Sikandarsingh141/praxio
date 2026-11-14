import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SKIP_GLOBAL_LOADER } from '../core/loading/global-loader.context';
import { environment } from '../../environments/environment';
import { CustomerPortalService } from './customer-portal.service';

describe('CustomerPortalService', () => {
  let service: CustomerPortalService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), CustomerPortalService],
    });
    service = TestBed.inject(CustomerPortalService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('passes location, service, and distance filters to the real shop search API', () => {
    service
      .searchShops({
        query: 'Pune',
        service: 'AC Repair',
        latitude: 18.52,
        longitude: 73.85,
        maxDistanceKm: 10,
        sort: 'nearest',
      })
      .subscribe((shops) => expect(shops).toEqual([]));

    const request = http.expectOne(
      (candidate) => candidate.url === `${environment.apiBaseUrl}/customer/shops`,
    );
    expect(request.request.params.get('service')).toBe('AC Repair');
    expect(request.request.params.get('latitude')).toBe('18.52');
    expect(request.request.params.get('maxDistanceKm')).toBe('10');
    expect(request.request.context.get(SKIP_GLOBAL_LOADER)).toBeFalse();
    request.flush({ data: { shops: [] } });
  });

  it('can fetch address suggestions without showing the global loader', () => {
    service.suggestAddresses('Pune', true).subscribe((suggestions) => {
      expect(suggestions).toEqual([]);
    });

    const request = http.expectOne(
      (candidate) =>
        candidate.url === `${environment.apiBaseUrl}/customer/addresses` &&
        candidate.params.get('q') === 'Pune',
    );
    expect(request.request.context.get(SKIP_GLOBAL_LOADER)).toBeTrue();
    request.flush({ data: { suggestions: [] } });
  });

  it('submits one repair request and the same selected shops with optional photos', () => {
    const photo = new File(['image'], 'repair.jpg', { type: 'image/jpeg' });
    service
      .createRepairRequest({
        shopIds: ['shop-a', 'shop-b'],
        appliance: 'Refrigerator',
        description: 'Not cooling',
        photos: [photo],
      })
      .subscribe((requestId) => expect(requestId).toBe('request-id'));

    const request = http.expectOne(`${environment.apiBaseUrl}/customer/repair-requests`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body.get('shopIds')).toBe('["shop-a","shop-b"]');
    expect(request.request.body.getAll('photos')).toHaveSize(1);
    request.flush({ data: { request: { _id: 'request-id' } } });
  });

  it('passes customer repair-request filters to the list API', () => {
    service
      .getRepairRequests({
        status: 'open',
        repairStatus: 'in_progress',
        appliance: 'Refrigerator',
        from: '2026-10-01',
        to: '2026-10-31',
      })
      .subscribe((requests) => expect(requests).toEqual([]));

    const request = http.expectOne(
      (candidate) => candidate.url === `${environment.apiBaseUrl}/customer/repair-requests`,
    );
    expect(request.request.params.get('status')).toBe('open');
    expect(request.request.params.get('repairStatus')).toBe('in_progress');
    expect(request.request.params.get('appliance')).toBe('Refrigerator');
    expect(request.request.params.get('from')).toBe('2026-10-01');
    expect(request.request.params.get('to')).toBe('2026-10-31');
    request.flush({ data: { requests: [] } });
  });

  it('updates a repair request with selected shops, details, and optional photo changes', () => {
    const photo = new File(['image'], 'repair.png', { type: 'image/png' });
    service
      .updateRepairRequest('request-id', {
        shopIds: ['shop-a', 'shop-b'],
        appliance: 'Refrigerator',
        description: 'Not cooling',
        brand: 'Brand',
        model: 'Model',
        preferredServiceDate: '2026-11-15',
        serviceType: 'home_service',
        photos: [photo],
        removeExistingPhotos: false,
      })
      .subscribe();

    const request = http.expectOne(`${environment.apiBaseUrl}/customer/repair-requests/request-id`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body.get('shopIds')).toBe('["shop-a","shop-b"]');
    expect(request.request.body.get('appliance')).toBe('Refrigerator');
    expect(request.request.body.get('serviceType')).toBe('home_service');
    expect(request.request.body.get('removeExistingPhotos')).toBe('false');
    expect(request.request.body.getAll('photos')).toHaveSize(1);
    request.flush({ data: { request: { _id: 'request-id' } } });
  });
});
