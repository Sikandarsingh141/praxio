import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import * as L from 'leaflet';
import { environment } from '../../environments/environment';
import { AdminMapData, AdminMapEntity, AdminMapMarker } from './admin.service';
import { AdminMapViewPage } from './admin-map-view.page';

describe('AdminMapViewPage', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminMapViewPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads repair requests and applies the global search filter', fakeAsync(() => {
    const fixture = TestBed.createComponent(AdminMapViewPage);
    fixture.detectChanges();
    const initialRequest = http.expectOne(
      (request) => request.url === `${environment.apiBaseUrl}/admin/map`,
    );
    expect(initialRequest.request.params.get('type')).toBe('requests');
    expect(initialRequest.request.params.get('limit')).toBe('20');
    flushMarkers(http, [makeMarker('request-1')]);
    const mixedResponse = mapData([makeEntity('request-1', 'request')]);
    mixedResponse.entities.unshift(
      makeEntity('customer-1', 'customer'),
      makeEntity('shop-1', 'shop'),
    );
    initialRequest.flush({ data: mixedResponse });
    fixture.detectChanges();

    const page = fixture.componentInstance;
    expect(fixture.nativeElement.querySelector('.entity-tabs')).toBeNull();
    expect(fixture.nativeElement.querySelector('.map-legend')).toBeNull();
    expect(page['markerLayer'].getLayers().length).toBe(1);
    expect(page.entities().map((entity) => entity.type)).toEqual(['request']);
    page.updateSearch('666E727C');
    tick(250);
    const searchRequest = http.expectOne(
      (request) =>
        request.url === `${environment.apiBaseUrl}/admin/map` &&
        request.params.get('type') === 'requests' &&
        request.params.get('search') === '666E727C',
    );
    flushMarkers(http, [makeMarker('request-1')], '666E727C');
    searchRequest.flush({ data: mapData([makeEntity('request-1', 'request')]) });
    fixture.detectChanges();
    expect(page.error()).toBe('');
    fixture.destroy();
  }));

  it('loads all map markers independently and appends list pages on scroll', () => {
    const fixture = TestBed.createComponent(AdminMapViewPage);
    fixture.detectChanges();
    const firstPageEntities = Array.from({ length: 20 }, (_, index) =>
      makeEntity(`request-${index}`, 'request'),
    );
    const firstPage = mapData(firstPageEntities);
    firstPage.total = 45;
    flushMarkers(
      http,
      Array.from({ length: 45 }, (_, index) => makeMarker(`request-${index}`)),
    );
    http
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/admin/map`)
      .flush({ data: firstPage });
    fixture.detectChanges();

    const page = fixture.componentInstance;
    expect(page.visibleCount).toBe(20);
    expect(page.data()?.total).toBe(45);
    expect(page.mapEntities()).toHaveSize(45);
    const cluster = page['markerLayer'].getLayers()[0] as L.Marker;
    expect((cluster.getIcon() as L.DivIcon).options.html).toContain('45');
    const atBottom = document.createElement('div');
    Object.defineProperties(atBottom, {
      scrollHeight: { value: 1000 },
      scrollTop: { value: 950 },
      clientHeight: { value: 100 },
    });
    page.onResultsScroll({ target: atBottom } as unknown as Event);
    const nextPageRequest = http.expectOne(
      (request) =>
        request.url === `${environment.apiBaseUrl}/admin/map` &&
        request.params.get('page') === '2' &&
        request.params.get('limit') === '20',
    );
    const nextPageEntities = Array.from({ length: 20 }, (_, index) =>
      makeEntity(`request-${index + 20}`, 'request'),
    );
    const nextPage = mapData(nextPageEntities);
    nextPage.page = 2;
    nextPage.total = 45;
    nextPageRequest.flush({ data: nextPage });
    fixture.detectChanges();

    expect(page.visibleCount).toBe(40);
    expect(page.mapEntities()).toHaveSize(45);
    http.expectNone(`${environment.apiBaseUrl}/admin/map/markers`);

    page.onResultsScroll({ target: atBottom } as unknown as Event);
    const lastPageRequest = http.expectOne(
      (request) =>
        request.url === `${environment.apiBaseUrl}/admin/map` &&
        request.params.get('page') === '3' &&
        request.params.get('limit') === '20',
    );
    const lastPage = mapData(
      Array.from({ length: 5 }, (_, index) => makeEntity(`request-${index + 40}`, 'request')),
    );
    lastPage.page = 3;
    lastPage.total = 45;
    lastPageRequest.flush({ data: lastPage });
    fixture.detectChanges();
    expect(page.visibleCount).toBe(45);
    fixture.destroy();
  });

  it('zooms in enough to separate nearby request locations', () => {
    const fixture = TestBed.createComponent(AdminMapViewPage);
    fixture.detectChanges();
    const markers = [
      {
        ...makeMarker('request-1'),
        location: { latitude: 43.65, longitude: -79.38 },
      },
      {
        ...makeMarker('request-2'),
        location: { latitude: 43.652, longitude: -79.38 },
      },
    ];
    flushMarkers(http, markers);
    http
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/admin/map`)
      .flush({ data: mapData([]) });
    fixture.detectChanges();

    expect(fixture.componentInstance['map']?.getZoom()).toBe(15);
    expect(fixture.componentInstance['markerLayer'].getLayers()).toHaveSize(2);
    fixture.destroy();
  });

  it('shows customer and shop locations with directional map pins in each request row', () => {
    const fixture = TestBed.createComponent(AdminMapViewPage);
    fixture.detectChanges();
    const request = {
      ...makeEntity('request-1', 'request'),
      location: { latitude: 43.65, longitude: -79.38 },
      shopName: 'Northstar Repairs',
      shopAddress: '10 King Street',
      shopCity: 'Toronto',
      shopState: 'Ontario',
    };
    flushMarkers(http, [makeMarker(request.id)]);
    http
      .expectOne((pending) => pending.url === `${environment.apiBaseUrl}/admin/map`)
      .flush({ data: mapData([request]) });
    fixture.detectChanges();

    const route = fixture.nativeElement.querySelector('.result-route') as HTMLElement;
    expect(route.querySelectorAll('.route-pin')).toHaveSize(2);
    expect(route.querySelector('.route-direction')?.textContent).toBe('→');
    expect(route.textContent).toContain('43.6500, -79.3800');
    expect(route.textContent).toContain('10 King Street, Toronto, Ontario');
    fixture.destroy();
  });

  it('fetches a marker request not loaded in the list and avoids duplicate list entries', () => {
    const fixture = TestBed.createComponent(AdminMapViewPage);
    fixture.detectChanges();
    const first = makeEntity('request-1', 'request');
    const second = makeEntity('request-2', 'request');
    const firstPage = mapData([first]);
    firstPage.total = 2;
    flushMarkers(http, [makeMarker(first.id), makeMarker(second.id)]);

    const page = fixture.componentInstance;
    page['selectMapMarker'](makeMarker(second.id));
    http
      .expectOne(`${environment.apiBaseUrl}/admin/map/repair-requests/${second.id}`)
      .flush({ data: second });
    http
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/admin/map`)
      .flush({ data: firstPage });

    expect(page.visibleCount).toBe(2);
    expect(page.entities().map((entity) => entity.id)).toEqual([first.id, second.id]);
    expect(page.selectedEntity()?.id).toBe(second.id);
    fixture.destroy();
  });

  it('uses the shared side drawer to apply map filters together', () => {
    const fixture = TestBed.createComponent(AdminMapViewPage);
    fixture.detectChanges();
    http
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/admin/map`)
      .flush({ data: mapData([]) });
    flushMarkers(http, []);
    fixture.detectChanges();

    const filterTrigger = fixture.nativeElement.querySelector(
      '.filter-trigger',
    ) as HTMLButtonElement;
    filterTrigger.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();

    const setInput = (selector: string, value: string): void => {
      const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    setInput('#city', 'Calgary');
    setInput('#state', 'Alberta');
    setInput('#dateRange-from', '2026-03-01');
    setInput('#dateRange-to', '2026-03-31');
    const status = fixture.nativeElement.querySelector('#status') as HTMLSelectElement;
    status.value = 'pending';
    status.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.apply-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const request = http.expectOne(
      (pending) =>
        pending.url === `${environment.apiBaseUrl}/admin/map` &&
        pending.params.get('city') === 'Calgary' &&
        pending.params.get('state') === 'Alberta' &&
        pending.params.get('from') === '2026-03-01' &&
        pending.params.get('to') === '2026-03-31' &&
        pending.params.get('status') === 'pending' &&
        pending.params.get('approvalStatus') === null,
    );
    const markerRequest = http.expectOne(
      (pending) =>
        pending.url === `${environment.apiBaseUrl}/admin/map/markers` &&
        pending.params.get('city') === 'Calgary' &&
        pending.params.get('state') === 'Alberta' &&
        pending.params.get('from') === '2026-03-01' &&
        pending.params.get('to') === '2026-03-31' &&
        pending.params.get('status') === 'pending',
    );
    markerRequest.flush({ data: { markers: [] } });
    request.flush({ data: mapData([]) });
    fixture.destroy();
  });

  it('moves marketplace totals into selectable filter statuses', () => {
    const fixture = TestBed.createComponent(AdminMapViewPage);
    fixture.detectChanges();
    http
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/admin/map`)
      .flush({ data: mapData([]) });
    flushMarkers(http, []);
    fixture.detectChanges();

    const page = fixture.componentInstance;
    const categoryOptions = page.filterConfig.fields.find(
      (field) => field.key === 'mapCategory',
    )?.options;
    expect(categoryOptions?.map((option) => option.label)).toEqual([
      'Total Repair Requests (9)',
      'Active Repairs (3)',
      'Completed Repairs (4)',
      'Disputed Repairs (1)',
    ]);
    expect(page.filterConfig.fields.some((field) => field.key === 'approvalStatus')).toBeFalse();
    expect(fixture.nativeElement.querySelector('.statistics-grid')).toBeNull();

    page.applyFilters({ mapCategory: 'active' });
    expect(page.status()).toBe('active');
    const activeRequest = http.expectOne(
      (request) =>
        request.url === `${environment.apiBaseUrl}/admin/map` &&
        request.params.get('type') === 'requests' &&
        request.params.get('status') === 'active',
    );
    activeRequest.flush({ data: mapData([]) });
    flushMarkers(http, [], undefined, 'active');
    fixture.destroy();
  });

  it('shows only the short request ID', () => {
    const page = TestBed.createComponent(AdminMapViewPage).componentInstance;

    expect(page.formatRequestId('6afad85h46jg666e727c')).toBe('666E727C');
  });

  it('focuses a selected request and displays provider route metrics', () => {
    const fixture = TestBed.createComponent(AdminMapViewPage);
    fixture.detectChanges();
    const request = makeEntity('request-1', 'request');
    http
      .expectOne((pending) => pending.url === `${environment.apiBaseUrl}/admin/map`)
      .flush({ data: mapData([request]) });
    flushMarkers(http, [makeMarker(request.id)]);
    fixture.detectChanges();

    const map = fixture.componentInstance['map'];
    const flyTo = spyOn(map!, 'flyTo').and.callThrough();
    const card = fixture.nativeElement.querySelector('.result-card') as HTMLButtonElement;
    card.click();
    fixture.detectChanges();

    expect(flyTo).toHaveBeenCalledWith(
      [request.location!.latitude, request.location!.longitude],
      14,
      { duration: 0.6 },
    );
    const routeRequest = http.expectOne(
      `${environment.apiBaseUrl}/admin/map/repair-requests/request-1/route`,
    );
    routeRequest.flush({
      data: {
        route: {
          distanceMeters: 4200,
          durationSeconds: 900,
          description: 'Driving route',
          path: [
            { latitude: 43.65, longitude: -79.38 },
            { latitude: 43.67, longitude: -79.4 },
          ],
        },
      },
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.routeDistance()).toBe('4.2 km');
    expect(fixture.componentInstance.routeDuration()).toBe('15 min');
    expect(fixture.nativeElement.textContent).toContain('Driving route');
    fixture.destroy();
  });

  it('shows a clear route-unavailable message when coordinates are missing', () => {
    const page = TestBed.createComponent(AdminMapViewPage).componentInstance;
    const request = {
      ...makeEntity('request-2', 'request'),
      shopLocation: null,
    };

    page.showRoute(request);

    expect(page.routeError()).toContain('saved customer and shop location');
    http.expectNone(`${environment.apiBaseUrl}/admin/map/repair-requests/request-2/route`);
  });
});

function mapData(entities: AdminMapEntity[]): AdminMapData {
  return {
    counts: {
      customers: 12,
      shops: 5,
      requests: 9,
      active: 3,
      completed: 4,
      disputed: 1,
    },
    entities,
    page: 1,
    limit: 20,
    total: entities.length,
  };
}

function flushMarkers(
  http: HttpTestingController,
  markers: AdminMapMarker[],
  search?: string,
  status?: string,
): void {
  const request = http.expectOne(
    (pending) =>
      pending.url === `${environment.apiBaseUrl}/admin/map/markers` &&
      pending.params.get('search') === (search ?? null) &&
      pending.params.get('status') === (status ?? 'all'),
  );
  request.flush({ data: { markers } });
}

function makeMarker(id: string): AdminMapMarker {
  return {
    id,
    type: 'request',
    name: 'Phone repair',
    status: 'in_progress',
    location: { latitude: 43.65, longitude: -79.38 },
  };
}

function makeEntity(id: string, type: AdminMapEntity['type']): AdminMapEntity {
  return {
    id,
    type,
    name: type === 'request' ? 'Phone repair' : 'Avery Johnson',
    location: { latitude: 43.65, longitude: -79.38 },
    address: '',
    city: '',
    state: '',
    email: 'avery@example.test',
    phone: '+1 4165550100',
    status: type === 'request' ? 'in_progress' : 'active',
    customerName: 'Avery Johnson',
    shopName: 'Northstar Repairs',
    shopEmail: 'shop@example.test',
    shopPhone: '+1 4165550199',
    shopLocation: { latitude: 43.67, longitude: -79.4 },
    appliance: 'Phone',
    description: 'Screen is cracked',
    createdAt: '2026-10-28T12:00:00.000Z',
    quotationAmount: 125,
    quotationCurrency: 'CAD',
    repairCounts: { total: 3, active: 1, completed: 1 },
  };
}
