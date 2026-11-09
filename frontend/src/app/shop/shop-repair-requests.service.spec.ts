import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { ShopRepairRequestsService } from './shop-repair-requests.service';

describe('ShopRepairRequestsService', () => {
  let service: ShopRepairRequestsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ShopRepairRequestsService],
    });
    service = TestBed.inject(ShopRepairRequestsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('passes repair-status and other filters to the shop request API', () => {
    service
      .list({
        status: 'all',
        appliance: 'Refrigerator',
        repairStatus: 'in_progress',
        from: '2026-10-01',
        to: '2026-10-31',
        sort: 'newest',
        page: 2,
        limit: 10,
      })
      .subscribe((result) => expect(result.total).toBe(0));

    const request = http.expectOne(
      (candidate) => candidate.url === `${environment.apiBaseUrl}/shop/repair-requests`,
    );
    expect(request.request.params.get('repairStatus')).toBe('in_progress');
    expect(request.request.params.get('appliance')).toBe('Refrigerator');
    expect(request.request.params.get('from')).toBe('2026-10-01');
    expect(request.request.params.get('to')).toBe('2026-10-31');
    request.flush({
      data: {
        requests: [],
        page: 2,
        limit: 10,
        total: 0,
        summary: {
          total: 0,
          new: 0,
          pending: 0,
          accepted: 0,
          declined: 0,
          expired: 0,
        },
      },
    });
  });
});
