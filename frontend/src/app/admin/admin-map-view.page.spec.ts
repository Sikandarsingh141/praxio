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
    expect(fixture.nativeElement.querySelector('.entity-tabs')).not.toBeNull();
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

  it('switches between request, customer, and shop tabs with tab-specific data and markers', () => {
    const fixture = TestBed.createComponent(AdminMapViewPage);
    fixture.detectChanges();
    const initialData = http.expectOne(
      (request) => request.url === `${environment.apiBaseUrl}/admin/map`,
    );
    const initialMarkers = http.expectOne(
      (request) => request.url === `${environment.apiBaseUrl}/admin/map/markers`,
    );
    initialData.flush({ data: mapData([makeEntity('request-1', 'request')]) });
    initialMarkers.flush({ data: { markers: [makeMarker('request-1')] } });
    fixture.detectChanges();

    const page = fixture.componentInstance;
    const tabs = Array.from(
      fixture.nativeElement.querySelectorAll('.entity-tabs button') as NodeListOf<HTMLElement>,
    );
    expect(tabs).toHaveSize(3);
    expect(tabs[0].classList).toContain('active');
    expect(tabs[0].textContent).toContain('All Requests');
    expect(tabs[0].textContent).toContain('(9)');
    expect(tabs[1].textContent).toContain('Customers');
    expect(tabs[1].textContent).toContain('(12)');
    expect(tabs[2].textContent).toContain('Shops');
    expect(tabs[2].textContent).toContain('(5)');

    page.selectTab('customers');
    expect(page.searchText()).toBe('');
    expect(page.appliedFilters()).toEqual({});
    expect(page.filterConfig.fields.map((field) => field.key)).toEqual(['dateRange']);
    const customerRequest = http.expectOne(
      (request) =>
        request.url === `${environment.apiBaseUrl}/admin/map` &&
        request.params.get('type') === 'customers',
    );
    const customerMarkers = http.expectOne(
      (request) =>
        request.url === `${environment.apiBaseUrl}/admin/map/markers` &&
        request.params.get('type') === 'customers',
    );
    const customer = {
      ...makeEntity('customer-1', 'customer'),
      name: 'Avery Johnson',
      email: 'avery@example.test',
      phone: '+1 4165550100',
      city: 'Toronto',
      state: 'Ontario',
      location: { latitude: 43.65, longitude: -79.38 },
      repairCounts: { total: 4, active: 1, completed: 2 },
    };
    customerRequest.flush({ data: mapData([customer]) });
    customerMarkers.flush({ data: { markers: [makeMarker(customer.id, 'customer')] } });
    fixture.detectChanges();

    const customerCard = fixture.nativeElement.querySelector('.result-card') as HTMLElement;
    expect(customerCard.textContent).toContain('Avery Johnson');
    expect(customerCard.textContent).toContain('avery@example.test');
    expect(customerCard.textContent).toContain('Requests 4');
    expect(customerCard.querySelector('.result-avatar')).not.toBeNull();
    expect(page.mapEntities()).toHaveSize(1);
    expect(page.mapEntities()[0].type).toBe('customer');

    page.selectTab('shops');
    expect(page.filterConfig.fields.map((field) => field.key)).toEqual([
      'approvalStatus',
      'city',
      'state',
      'dateRange',
    ]);
    const shopRequest = http.expectOne(
      (request) =>
        request.url === `${environment.apiBaseUrl}/admin/map` &&
        request.params.get('type') === 'shops' &&
        request.params.get('approvalStatus') === 'all',
    );
    const shopMarkers = http.expectOne(
      (request) =>
        request.url === `${environment.apiBaseUrl}/admin/map/markers` &&
        request.params.get('type') === 'shops' &&
        request.params.get('approvalStatus') === 'all',
    );
    const shop = {
      ...makeEntity('shop-1', 'shop'),
      name: 'Northstar Repairs',
      ownerName: 'Morgan Lee',
      approvalStatus: 'approved',
      status: 'approved',
      address: '10 King Street',
      city: 'Toronto',
      state: 'Ontario',
      location: { latitude: 43.66, longitude: -79.39 },
      services: ['Phone repair', 'Laptop repair', 'Tablet repair'],
      rating: 4.6,
      reviewCount: 12,
      repairCounts: { total: 7, active: 2, completed: 4 },
    };
    shopRequest.flush({ data: mapData([shop]) });
    shopMarkers.flush({ data: { markers: [makeMarker(shop.id, 'shop')] } });
    fixture.detectChanges();

    const shopCard = fixture.nativeElement.querySelector('.result-card') as HTMLElement;
    expect(shopCard.textContent).toContain('Northstar Repairs');
    expect(shopCard.textContent).toContain('Approved');
    expect(shopCard.textContent).toContain('4.6 (12)');
    expect(shopCard.textContent).toContain('Phone repair, Laptop repair +1');
    expect(shopCard.textContent).toContain('Requests 7');
    expect(page.mapEntities()[0].type).toBe('shop');
    fixture.destroy();
  });

  it('loads customer details when a customer marker is not in the list', () => {
    const fixture = TestBed.createComponent(AdminMapViewPage);
    fixture.detectChanges();
    http
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/admin/map`)
      .flush({ data: mapData([]) });
    flushMarkers(http, []);
    const page = fixture.componentInstance;

    page.selectTab('customers');
    http
      .expectOne(
        (request) =>
          request.url === `${environment.apiBaseUrl}/admin/map` &&
          request.params.get('type') === 'customers',
      )
      .flush({ data: mapData([]) });
    const customerMarker = makeMarker('customer-2', 'customer');
    http
      .expectOne(
        (request) =>
          request.url === `${environment.apiBaseUrl}/admin/map/markers` &&
          request.params.get('type') === 'customers',
      )
      .flush({ data: { markers: [customerMarker] } });

    page['selectMapMarker'](customerMarker);
    const detailRequest = http.expectOne(
      (request) =>
        request.url === `${environment.apiBaseUrl}/admin/map` &&
        request.params.get('type') === 'customers' &&
        request.params.get('search') === customerMarker.id &&
        request.params.get('limit') === '10',
    );
    const customer = {
      ...makeEntity(customerMarker.id, 'customer'),
      name: 'Jordan Blake',
      city: 'Toronto',
      state: 'Ontario',
      location: { latitude: 43.7, longitude: -79.4 },
    };
    detailRequest.flush({ data: mapData([customer]) });

    expect(page.selectedEntity()?.id).toBe(customerMarker.id);
    expect(page.entities().some((entity) => entity.id === customerMarker.id)).toBeTrue();
    fixture.destroy();
  });

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
    const markers = page['markerLayer'].getLayers() as L.Marker[];
    expect(markers).toHaveSize(1);
    const clusterIcon = String((markers[0].getIcon() as L.DivIcon).options.html ?? '');
    expect(clusterIcon).toContain('admin-map-cluster');
    expect(clusterIcon).toContain('45');
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

  it('clusters nearby request locations until the admin zooms in', () => {
    const fixture = TestBed.createComponent(AdminMapViewPage);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const canvas = fixture.nativeElement.querySelector('.map-canvas') as HTMLElement;
    canvas.style.width = '640px';
    canvas.style.height = '480px';
    fixture.componentInstance['map']?.invalidateSize();
    const markers = [
      {
        ...makeMarker('request-1'),
        location: { latitude: 43.65, longitude: -79.38 },
      },
      {
        ...makeMarker('request-2'),
        location: { latitude: 43.6515, longitude: -79.38 },
      },
    ];
    flushMarkers(http, markers);
    http
      .expectOne((request) => request.url === `${environment.apiBaseUrl}/admin/map`)
      .flush({ data: mapData([]) });
    fixture.detectChanges();

    const page = fixture.componentInstance;
    const map = page['map']!;
    expect(map.getZoom()).toBe(15);
    let layers = page['markerLayer'].getLayers() as L.Marker[];
    expect(layers).toHaveSize(1);
    expect(String((layers[0].getIcon() as L.DivIcon).options.html)).toContain('admin-map-cluster');

    map.setZoom(16, { animate: false });
    fixture.detectChanges();

    layers = page['markerLayer'].getLayers() as L.Marker[];
    expect(layers).toHaveSize(2);
    expect(layers[0].getLatLng().equals(layers[1].getLatLng())).toBeFalse();
    expect(
      layers.every((layer) =>
        String((layer.getIcon() as L.DivIcon).options.html ?? '').includes('admin-map-dot'),
      ),
    ).toBeTrue();
    fixture.nativeElement.remove();
    fixture.destroy();
  });

  it('spiderfies a cluster and keeps the selected request marker green', () => {
    const fixture = TestBed.createComponent(AdminMapViewPage);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const canvas = fixture.nativeElement.querySelector('.map-canvas') as HTMLElement;
    canvas.style.width = '640px';
    canvas.style.height = '480px';
    fixture.componentInstance['map']?.invalidateSize();

    const requests = ['request-1', 'request-2', 'request-3'].map((id, index) => ({
      ...makeEntity(id, 'request'),
      location: { latitude: 43.65, longitude: -79.38 },
      address: `1${index} King Street`,
      city: 'Toronto',
      state: 'Ontario',
      appliance: index === 0 ? 'Phone' : 'Laptop',
      customerName: `Customer ${index + 1}`,
      createdAt: '2026-10-28T12:00:00.000Z',
    }));
    flushMarkers(
      http,
      requests.map((request) => makeMarker(request.id)),
    );
    http
      .expectOne((pending) => pending.url === `${environment.apiBaseUrl}/admin/map`)
      .flush({ data: mapData(requests) });
    http
      .expectOne((pending) => pending.url === `${environment.apiBaseUrl}/admin/map/reverse-geocode`)
      .flush({ data: { label: 'Toronto, Ontario, Canada' } });
    fixture.detectChanges();

    const page = fixture.componentInstance;
    let layers = page['markerLayer'].getLayers() as L.Marker[];
    expect(layers).toHaveSize(1);
    expect(String((layers[0].getIcon() as L.DivIcon).options.html)).toContain('admin-map-cluster');

    layers[0].fire('click');
    fixture.detectChanges();

    layers = page['markerLayer'].getLayers() as L.Marker[];
    expect(layers).toHaveSize(3);
    expect(page['spiderLayer'].getLayers()).toHaveSize(3);
    expect(
      layers.every((layer) =>
        String((layer.getIcon() as L.DivIcon).options.html ?? '').includes('admin-map-spider-dot'),
      ),
    ).toBeTrue();

    layers[1].fire('click');
    fixture.detectChanges();

    layers = page['markerLayer'].getLayers() as L.Marker[];
    expect(layers).toHaveSize(3);
    expect(page['spiderLayer'].getLayers()).toHaveSize(2);
    const selected = layers.filter((layer) =>
      String((layer.getIcon() as L.DivIcon).options.html ?? '').includes('selected'),
    );
    expect(selected).toHaveSize(1);
    expect((selected[0].getIcon() as L.DivIcon).options.html).toContain('admin-map-dot selected');

    const popup = document.querySelector('.admin-map-popup') as HTMLElement;
    expect(popup).not.toBeNull();
    expect(popup.textContent).toContain('Request ID');
    expect(popup.textContent).toContain('EQUEST-2');
    expect(popup.textContent).toContain('Customer 2');
    expect(popup.textContent).toContain('Laptop');
    expect(popup.textContent).toContain('11 King Street, Toronto, Ontario');
    expect(popup.textContent).toContain('2026');
    const details = popup.querySelector('.admin-map-popup-actions a') as HTMLAnchorElement;
    expect(details.textContent).toBe('View Details');
    expect(details.getAttribute('href')).toBe(
      `/admin/repair-jobs/${encodeURIComponent(requests[1].id)}`,
    );

    fixture.nativeElement.remove();
    fixture.destroy();
  });

  it('uses individual dots, highlights the selected request, and shows request details', () => {
    const fixture = TestBed.createComponent(AdminMapViewPage);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const canvas = fixture.nativeElement.querySelector('.map-canvas') as HTMLElement;
    canvas.style.width = '640px';
    canvas.style.height = '480px';
    fixture.componentInstance['map']?.invalidateSize();
    const id = '6afad85h46jg666e727c';
    const request = {
      ...makeEntity(id, 'request'),
      location: { latitude: 43.65, longitude: -79.38 },
      address: '12 King Street',
      city: 'Toronto',
      state: 'Ontario',
      appliance: 'Phone',
      customerName: 'Avery Johnson',
      createdAt: '2026-10-28T12:00:00.000Z',
    };
    flushMarkers(http, [makeMarker(id)]);
    http
      .expectOne((pending) => pending.url === `${environment.apiBaseUrl}/admin/map`)
      .flush({ data: mapData([request]) });
    http
      .expectOne((pending) => pending.url === `${environment.apiBaseUrl}/admin/map/reverse-geocode`)
      .flush({ data: { label: 'Toronto, Ontario, Canada' } });
    fixture.detectChanges();

    const page = fixture.componentInstance;
    const marker = page['markerLayer'].getLayers()[0] as L.Marker;
    const icon = (marker.getIcon() as L.DivIcon).options.html ?? '';
    expect(icon).toContain('admin-map-dot');
    expect(icon).not.toContain('selected');

    marker.fire('click');
    fixture.detectChanges();

    const selected = page['markerLayer'].getLayers()[0] as L.Marker;
    expect((selected.getIcon() as L.DivIcon).options.html).toContain('admin-map-dot selected');
    const popup = document.querySelector('.admin-map-popup') as HTMLElement;
    expect(popup).not.toBeNull();
    expect(popup.textContent).toContain('Request ID');
    expect(popup.textContent).toContain('666E727C');
    expect(popup.textContent).toContain('Avery Johnson');
    expect(popup.textContent).toContain('Phone');
    expect(popup.textContent).toContain('In progress');
    expect(popup.textContent).toContain('12 King Street, Toronto, Ontario');
    expect(popup.textContent).toContain('2026');
    const details = popup.querySelector('.admin-map-popup-actions a') as HTMLAnchorElement;
    expect(details.textContent).toBe('View Details');
    expect(details.getAttribute('href')).toBe(`/admin/repair-jobs/${encodeURIComponent(id)}`);
    fixture.nativeElement.remove();
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
    const reverseGeocodeRequest = http.expectOne(
      (pending) =>
        pending.url === `${environment.apiBaseUrl}/admin/map/reverse-geocode` &&
        pending.params.get('latitude') === '43.65' &&
        pending.params.get('longitude') === '-79.38',
    );
    reverseGeocodeRequest.flush({ data: { label: 'Toronto, Ontario, Canada' } });
    fixture.detectChanges();

    const route = fixture.nativeElement.querySelector('.result-route') as HTMLElement;
    expect(route.querySelectorAll('.route-pin')).toHaveSize(2);
    expect(route.querySelector('.route-direction')?.textContent).toBe('→');
    expect(route.textContent).toContain('Toronto, Ontario, Canada');
    expect(route.textContent).not.toContain('43.6500, -79.3800');
    expect(route.textContent).toContain('10 King Street, Toronto, Ontario');
    fixture.destroy();
  });

  it('renders compact status badges with matching card accents', () => {
    const fixture = TestBed.createComponent(AdminMapViewPage);
    fixture.detectChanges();
    const requests = [
      { ...makeEntity('completed-1', 'request'), status: 'completed' },
      { ...makeEntity('pending-1', 'request'), status: 'inspection_pending' },
      { ...makeEntity('cancelled-1', 'request'), status: 'cancelled' },
      { ...makeEntity('in-progress-1', 'request'), status: 'in_progress' },
    ];
    flushMarkers(
      http,
      requests.map((request) => makeMarker(request.id)),
    );
    http
      .expectOne((pending) => pending.url === `${environment.apiBaseUrl}/admin/map`)
      .flush({ data: mapData(requests) });
    fixture.detectChanges();

    const cards = Array.from(
      fixture.nativeElement.querySelectorAll('.result-card') as NodeListOf<HTMLElement>,
    );
    const badges = Array.from(
      fixture.nativeElement.querySelectorAll('.result-status') as NodeListOf<HTMLElement>,
    );
    expect(cards.map((card) => card.classList.contains('completed'))).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(cards.map((card) => card.classList.contains('pending'))).toEqual([
      false,
      true,
      false,
      false,
    ]);
    expect(cards.map((card) => card.classList.contains('cancelled'))).toEqual([
      false,
      false,
      true,
      false,
    ]);
    expect(cards.map((card) => card.classList.contains('in-progress'))).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(badges.map((badge) => badge.textContent?.trim())).toEqual([
      '✓ Completed',
      '◷ Pending',
      '× Cancelled',
      '↻ In progress',
    ]);
    expect(
      badges.map(
        (badge) => getComputedStyle(badge.querySelector('span') as HTMLElement).backgroundColor,
      ),
    ).toEqual(['rgb(23, 107, 52)', 'rgb(168, 91, 12)', 'rgb(104, 117, 129)', 'rgb(46, 105, 173)']);
    fixture.destroy();
  });

  it('uses a repair tool icon and places readable service and date details at the bottom', () => {
    const fixture = TestBed.createComponent(AdminMapViewPage);
    fixture.detectChanges();
    const request = {
      ...makeEntity('request-1', 'request'),
      appliance: 'Laptop',
      serviceType: 'home_service',
    };
    flushMarkers(http, [makeMarker(request.id)]);
    http
      .expectOne((pending) => pending.url === `${environment.apiBaseUrl}/admin/map`)
      .flush({ data: mapData([request]) });
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.result-card') as HTMLElement;
    const markerIcon = card.querySelector('.result-marker svg') as SVGElement;
    const metadata = card.querySelector('.result-meta') as HTMLElement;
    expect(markerIcon.querySelector('rect')).toBeNull();
    expect(markerIcon.querySelector('path')).not.toBeNull();
    expect(metadata.previousElementSibling?.classList.contains('result-route')).toBeTrue();
    expect(metadata.textContent).toContain('Home service');
    expect(metadata.textContent).toContain('2026');
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
    const request = {
      ...makeEntity('request-1', 'request'),
      location: { latitude: 43.65, longitude: -79.38 },
      shopLocation: { latitude: 43.67, longitude: -79.4 },
      shopAddress: '10 King Street',
      shopCity: 'Toronto',
      shopState: 'Ontario',
    };
    http
      .expectOne((pending) => pending.url === `${environment.apiBaseUrl}/admin/map`)
      .flush({ data: mapData([request]) });
    http
      .expectOne(
        (pending) =>
          pending.url === `${environment.apiBaseUrl}/admin/map/reverse-geocode` &&
          pending.params.get('latitude') === '43.65',
      )
      .flush({ data: { label: 'Toronto, Ontario, Canada' } });
    flushMarkers(http, [makeMarker(request.id)]);
    fixture.detectChanges();

    const map = fixture.componentInstance['map'];
    const flyTo = spyOn(map!, 'flyTo').and.callThrough();
    const card = fixture.nativeElement.querySelector('.result-card') as HTMLButtonElement;
    card.click();
    fixture.detectChanges();

    expect(flyTo).toHaveBeenCalledWith(
      [request.location!.latitude, request.location!.longitude],
      16,
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

function makeMarker(id: string, type: AdminMapMarker['type'] = 'request'): AdminMapMarker {
  return {
    id,
    type,
    name: type === 'request' ? 'Phone repair' : 'Avery Johnson',
    status: type === 'request' ? 'in_progress' : 'approved',
    location: { latitude: 43.65, longitude: -79.38 },
  };
}

function makeEntity(id: string, type: AdminMapEntity['type']): AdminMapEntity {
  return {
    id,
    type,
    name: type === 'request' ? 'Phone repair' : 'Avery Johnson',
    location: null,
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
    shopLocation: null,
    appliance: 'Phone',
    description: 'Screen is cracked',
    createdAt: '2026-10-28T12:00:00.000Z',
    quotationAmount: 125,
    quotationCurrency: 'CAD',
    repairCounts: { total: 3, active: 1, completed: 1 },
  };
}
