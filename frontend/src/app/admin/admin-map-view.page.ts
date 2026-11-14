import { DatePipe, DecimalPipe } from '@angular/common';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as L from 'leaflet';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  from,
  map,
  mergeMap,
  of,
  Subject,
} from 'rxjs';
import {
  CommonFilterComponent,
  FilterConfig,
  FilterRangeValue,
  FilterValue,
  FilterValues,
} from '../shared/common-filter.component';
import {
  AdminMapData,
  AdminMapEntity,
  AdminMapMarker,
  AdminMapRoute,
  AdminService,
} from './admin.service';

interface ProjectedMapEntity {
  entity: AdminMapMarker;
  x: number;
  y: number;
}

interface ProjectedMapCluster {
  markers: ProjectedMapEntity[];
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
}

@Component({
  selector: 'app-admin-map-view-page',
  standalone: true,
  imports: [CommonFilterComponent, DatePipe, DecimalPipe],
  templateUrl: './admin-map-view.page.html',
})
export class AdminMapViewPage implements OnInit, AfterViewInit, OnDestroy {
  private readonly adminService = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchChanges = new Subject<string>();
  private requestSequence = 0;
  private markerSequence = 0;
  private selectionSequence = 0;
  private readonly markerDetailRequests = new Set<string>();
  private routeSequence = 0;
  private map?: L.Map;
  private markerLayer = L.layerGroup();
  private routeLayer = L.layerGroup();
  private streetLayer?: L.TileLayer;
  private satelliteLayer?: L.TileLayer;
  private resizeObserver?: ResizeObserver;
  private selectedEntityId: string | null = null;
  private openSelectedPopup = false;
  private lastSelectedMarker?: AdminMapMarker;
  @ViewChild('mapElement') private mapElement?: ElementRef<HTMLDivElement>;
  @ViewChild('mapShell') private mapShell?: ElementRef<HTMLDivElement>;

  readonly data = signal<AdminMapData | null>(null);
  readonly entities = signal<AdminMapEntity[]>([]);
  readonly mapEntities = signal<AdminMapMarker[]>([]);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly mapLoading = signal(false);
  readonly error = signal('');
  readonly loadMoreError = signal('');
  readonly mapError = signal('');
  readonly searchText = signal('');
  readonly city = signal('');
  readonly state = signal('');
  readonly fromDate = signal('');
  readonly toDate = signal('');
  readonly status = signal('all');
  readonly page = signal(1);
  readonly visibleLimit = signal(20);
  readonly listView = signal<'list' | 'map'>('list');
  readonly mapStyle = signal<'street' | 'satellite'>('street');
  readonly fullscreen = signal(false);
  readonly selectedEntity = signal<AdminMapEntity | null>(null);
  readonly route = signal<AdminMapRoute | null>(null);
  readonly routeLoading = signal(false);
  readonly routeError = signal('');
  readonly appliedFilters = signal<FilterValues>({});
  readonly locationLabels = signal<Record<string, string>>({});
  private readonly pendingLocationLookups = new Set<string>();

  get filterConfig(): FilterConfig {
    const category = this.filterText(this.appliedFilters()['mapCategory']);
    const fields: FilterConfig['fields'] = [
      {
        key: 'mapCategory',
        label: 'Repair request status',
        type: 'select',
        placeholder: 'All repair requests',
        options: [
          { label: `Total Repair Requests (${this.counts.requests})`, value: 'requests' },
          { label: `Active Repairs (${this.counts.active})`, value: 'active' },
          { label: `Completed Repairs (${this.counts.completed})`, value: 'completed' },
          { label: `Disputed Repairs (${this.counts.disputed})`, value: 'disputed' },
        ],
      },
      { key: 'city', label: 'City', type: 'text', placeholder: 'Enter a city' },
      {
        key: 'state',
        label: 'State or region',
        type: 'text',
        placeholder: 'Enter a state or region',
      },
      { key: 'dateRange', label: 'Date range', type: 'date-range' },
    ];

    if (!['active', 'completed', 'disputed'].includes(category)) {
      fields.push({
        key: 'status',
        label: 'Repair status',
        type: 'select',
        placeholder: 'All repair statuses',
        options: [
          { label: 'Pending', value: 'pending' },
          { label: 'Confirmed', value: 'confirmed' },
          { label: 'Inspection pending', value: 'inspection_pending' },
          { label: 'Inspection in progress', value: 'inspection_in_progress' },
          { label: 'Awaiting approval', value: 'awaiting_customer_approval' },
          { label: 'Inspection approved', value: 'inspection_approved' },
          { label: 'Repair declined', value: 'repair_declined' },
          { label: 'In progress', value: 'in_progress' },
          { label: 'On hold', value: 'on_hold' },
          { label: 'Repair completed', value: 'repair_completed' },
          { label: 'Ready for pickup', value: 'ready_for_pickup' },
          { label: 'Picked up', value: 'picked_up' },
          { label: 'Completed', value: 'completed' },
          { label: 'Disputed', value: 'disputed' },
          { label: 'Cancelled', value: 'cancelled' },
        ],
      });
    }

    return { title: 'Map filters', fields };
  }

  ngOnInit(): void {
    this.searchChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadData(true));
    this.loadData(true);
  }

  ngAfterViewInit(): void {
    this.initializeMap();
  }

  ngOnDestroy(): void {
    this.requestSequence += 1;
    this.markerSequence += 1;
    this.selectionSequence += 1;
    this.routeSequence += 1;
    this.resizeObserver?.disconnect();
    this.map?.remove();
  }

  get counts(): AdminMapData['counts'] {
    return (
      this.data()?.counts ?? {
        customers: 0,
        shops: 0,
        requests: 0,
        active: 0,
        completed: 0,
        disputed: 0,
      }
    );
  }

  get visibleCount(): number {
    return this.visibleEntities.length;
  }

  get visibleEntities(): AdminMapEntity[] {
    return this.entities().slice(0, this.visibleLimit());
  }

  get hasMore(): boolean {
    const total = this.data()?.total ?? 0;
    return (
      this.visibleLimit() < this.entities().length ||
      (this.entities().length < total && this.page() * 20 < total)
    );
  }

  updateSearch(value: string): void {
    this.searchText.set(value);
    this.searchChanges.next(value.trim());
  }

  applyFilters(filters: FilterValues): void {
    const category = this.filterText(filters['mapCategory']);
    const nextFilters = { ...filters };
    if (['active', 'completed', 'disputed'].includes(category)) {
      delete nextFilters['status'];
    }

    this.appliedFilters.set(nextFilters);
    this.city.set(this.filterText(filters['city']));
    this.state.set(this.filterText(filters['state']));
    const dateRange = this.filterDateRange(filters['dateRange']);
    this.fromDate.set(dateRange.from ?? '');
    this.toDate.set(dateRange.to ?? '');
    this.status.set(
      ['active', 'completed', 'disputed'].includes(category)
        ? category
        : this.filterText(filters['status']) || 'all',
    );
    this.loadData(true);
  }

  loadMore(): void {
    if (this.loadingMore() || !this.hasMore) return;
    if (this.visibleLimit() < this.entities().length) {
      this.visibleLimit.update((limit) => Math.min(limit + 20, this.entities().length));
      return;
    }
    this.loadData(false, this.page() + 1);
  }

  onResultsScroll(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 72) {
      this.loadMore();
    }
  }

  retry(): void {
    this.loadData(true);
  }

  retryLoadMore(): void {
    this.loadMoreError.set('');
    this.loadMore();
  }

  retryMapError(): void {
    if (this.lastSelectedMarker) this.selectMapMarker(this.lastSelectedMarker);
    else this.loadMarkers();
  }

  setListView(view: 'list' | 'map'): void {
    this.listView.set(view);
    requestAnimationFrame(() => this.map?.invalidateSize());
  }

  setMapStyle(style: 'street' | 'satellite'): void {
    this.mapStyle.set(style);
    if (!this.map) return;
    if (style === 'satellite') {
      this.streetLayer?.remove();
      this.satelliteLayer ??= L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Tiles &copy; Esri', maxZoom: 19 },
      );
      this.satelliteLayer.addTo(this.map);
      return;
    }
    this.satelliteLayer?.remove();
    this.streetLayer?.addTo(this.map);
  }

  zoomIn(): void {
    this.map?.zoomIn();
  }

  zoomOut(): void {
    this.map?.zoomOut();
  }

  async toggleFullscreen(): Promise<void> {
    const shell = this.mapShell?.nativeElement;
    if (!shell) return;
    try {
      if (document.fullscreenElement === shell) await document.exitFullscreen();
      else await shell.requestFullscreen();
    } catch {
      this.error.set('Full screen is unavailable in this browser or window.');
    }
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.fullscreen.set(document.fullscreenElement === this.mapShell?.nativeElement);
    requestAnimationFrame(() => {
      this.map?.invalidateSize();
      this.renderMarkers();
    });
  }

  focusEntity(entity: AdminMapEntity, showRoute = false): void {
    this.selectionSequence += 1;
    this.selectedEntity.set(entity);
    this.selectedEntityId = entity.id;
    this.openSelectedPopup = true;
    this.renderMarkers();
    if (entity.location && this.isValidLocation(entity.location)) {
      this.map?.flyTo([entity.location.latitude, entity.location.longitude], 14, {
        duration: 0.6,
      });
    }
    this.scrollToEntity(entity.id);
    if (showRoute && entity.type === 'request') this.showRoute(entity);
  }

  showRoute(entity: AdminMapEntity): void {
    if (
      entity.type !== 'request' ||
      !entity.location ||
      !entity.shopLocation ||
      !this.isValidLocation(entity.location) ||
      !this.isValidLocation(entity.shopLocation)
    ) {
      this.route.set(null);
      this.routeError.set('A saved customer and shop location are required to show a route.');
      return;
    }
    const sequence = ++this.routeSequence;
    this.routeLoading.set(true);
    this.routeError.set('');
    this.route.set(null);
    this.routeLayer.clearLayers();
    this.adminService.getMapRoute(entity.id).subscribe({
      next: (route) => {
        if (sequence !== this.routeSequence) return;
        if (!this.isValidRoute(route)) {
          this.routeError.set('The routing service returned invalid route data.');
          this.routeLoading.set(false);
          return;
        }
        this.route.set(route);
        const line = L.polyline(
          route.path.map((point) => [point.latitude, point.longitude]),
          { color: '#2367db', opacity: 0.95, weight: 5 },
        );
        this.routeLayer.clearLayers();
        this.routeLayer.addLayer(
          L.circleMarker([entity.location!.latitude, entity.location!.longitude], {
            radius: 7,
            color: '#fff',
            weight: 2,
            fillColor: '#4387c8',
            fillOpacity: 1,
          }).bindTooltip('Customer starting location'),
        );
        this.routeLayer.addLayer(
          L.circleMarker([entity.shopLocation!.latitude, entity.shopLocation!.longitude], {
            radius: 7,
            color: '#fff',
            weight: 2,
            fillColor: '#168043',
            fillOpacity: 1,
          }).bindTooltip('Repair shop destination'),
        );
        this.routeLayer.addLayer(line);
        if (this.map) {
          this.map.fitBounds(line.getBounds(), { padding: [48, 48], maxZoom: 14 });
        }
        this.routeLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        if (sequence !== this.routeSequence) return;
        this.routeError.set(
          error.error?.message || 'Driving directions are temporarily unavailable.',
        );
        this.routeLoading.set(false);
      },
    });
  }

  clearRoute(): void {
    this.routeSequence += 1;
    this.route.set(null);
    this.routeLoading.set(false);
    this.routeError.set('');
    this.routeLayer.clearLayers();
  }

  markerColor(entity: Pick<AdminMapEntity, 'type' | 'status'>): string {
    if (entity.type === 'customer') return 'customer';
    if (entity.type === 'shop') return 'shop';
    if (
      ['completed', 'repair_completed', 'ready_for_pickup', 'picked_up'].includes(entity.status)
    ) {
      return 'completed';
    }
    if (['disputed', 'repair_declined'].includes(entity.status)) return 'disputed';
    if (entity.status === 'cancelled') return 'cancelled';
    if (
      [
        'confirmed',
        'inspection_approved',
        'in_progress',
        'inspection_in_progress',
        'awaiting_customer_approval',
        'on_hold',
      ].includes(entity.status)
    ) {
      return 'in-progress';
    }
    return 'pending';
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pending',
      inspection_pending: 'Pending',
      confirmed: 'Confirmed',
      inspection_approved: 'In progress',
      in_progress: 'In progress',
      inspection_in_progress: 'In progress',
      awaiting_customer_approval: 'Awaiting approval',
      on_hold: 'On hold',
      repair_completed: 'Completed',
      ready_for_pickup: 'Completed',
      picked_up: 'Completed',
      completed: 'Completed',
      repair_declined: 'Declined',
      disputed: 'Disputed',
      cancelled: 'Cancelled',
    };
    return (
      labels[status] ??
      status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    );
  }

  statusIcon(status: string): string {
    if (['completed', 'repair_completed', 'ready_for_pickup', 'picked_up'].includes(status)) {
      return '✓';
    }
    if (['cancelled', 'repair_declined'].includes(status)) return '×';
    if (status === 'disputed') return '!';
    if (['pending', 'inspection_pending'].includes(status)) return '◷';
    return '↻';
  }

  serviceTypeLabel(entity: AdminMapEntity): string {
    if (entity.serviceType === 'home_service') return 'Home service';
    if (entity.serviceType === 'shop_visit') return 'Shop visit';
    return entity.serviceType ?? entity.appliance ?? 'Repair service';
  }

  formatRequestId(id: string): string {
    return id.slice(-8).toUpperCase();
  }

  locationLabel(entity: AdminMapEntity): string {
    const locationText = [entity.address, entity.city, entity.state].filter(Boolean).join(', ');
    if (locationText) return locationText;
    return entity.location ? this.resolvedLocationLabel(entity.location) : 'Location unavailable';
  }

  customerLocationLabel(entity: AdminMapEntity): string {
    return entity.location
      ? this.resolvedLocationLabel(entity.location)
      : 'Customer location unavailable';
  }

  shopLocationLabel(entity: AdminMapEntity): string {
    const address = [entity.shopAddress, entity.shopCity, entity.shopState]
      .filter((part) => part?.trim())
      .join(', ');
    if (address) return address;
    if (entity.shopLocation) return this.resolvedLocationLabel(entity.shopLocation);
    return entity.shopName ? 'Shop location unavailable' : 'Shop unassigned';
  }

  private resolvedLocationLabel(location: { latitude: number; longitude: number }): string {
    return this.locationLabels()[this.locationKey(location)] ?? 'Finding location…';
  }

  private locationKey(location: { latitude: number; longitude: number }): string {
    return `${location.latitude},${location.longitude}`;
  }

  private resolveLocationLabels(entities: AdminMapEntity[]): void {
    const locations = new Map<string, { latitude: number; longitude: number }>();
    for (const entity of entities) {
      if (entity.type !== 'request') continue;
      if (entity.location) {
        locations.set(this.locationKey(entity.location), entity.location);
      }
      const shopAddress = [entity.shopAddress, entity.shopCity, entity.shopState]
        .filter((part) => part?.trim())
        .join(', ');
      if (entity.shopLocation && !shopAddress) {
        locations.set(this.locationKey(entity.shopLocation), entity.shopLocation);
      }
    }

    const pending = [...locations].filter(
      ([key]) =>
        (!this.locationLabels()[key] ||
          this.locationLabels()[key] === 'Location lookup unavailable') &&
        !this.pendingLocationLookups.has(key),
    );
    for (const [key] of pending) this.pendingLocationLookups.add(key);

    from(pending)
      .pipe(
        mergeMap(
          ([key, location]) =>
            this.adminService.getMapLocationLabel(location.latitude, location.longitude).pipe(
              map((label) => ({ key, label })),
              catchError(() => of({ key, label: 'Location lookup unavailable' })),
            ),
          3,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ key, label }) => {
          this.pendingLocationLookups.delete(key);
          this.locationLabels.update((current) => ({ ...current, [key]: label }));
        },
        complete: () => {
          if (!this.destroyRef.destroyed) this.renderMarkers();
        },
      });
  }

  routeDistance(): string {
    const distanceMeters = this.route()?.distanceMeters;
    return distanceMeters === undefined ? '' : `${(distanceMeters / 1000).toFixed(1)} km`;
  }

  routeDuration(): string {
    const durationSeconds = this.route()?.durationSeconds;
    if (durationSeconds === undefined) return '';
    const minutes = Math.round(durationSeconds / 60);
    return minutes < 1 ? 'Less than 1 min' : `${minutes} min`;
  }

  private loadData(reset: boolean, requestedPage = reset ? 1 : this.page() + 1): void {
    if (reset) {
      this.page.set(1);
      this.visibleLimit.set(20);
      this.loading.set(true);
      this.loadingMore.set(false);
      this.error.set('');
      this.loadMoreError.set('');
      this.entities.set([]);
      this.data.set(null);
      this.selectionSequence += 1;
      this.lastSelectedMarker = undefined;
      this.selectedEntity.set(null);
      this.selectedEntityId = null;
      this.loadMarkers();
      this.clearRoute();
    } else {
      this.loadingMore.set(true);
      this.loadMoreError.set('');
    }
    const sequence = ++this.requestSequence;
    this.adminService
      .getMapData({
        type: 'requests',
        page: requestedPage,
        limit: 20,
        search: this.searchText(),
        city: this.city(),
        state: this.state(),
        from: this.fromDate(),
        to: this.toDate(),
        status: this.status(),
      })
      .subscribe({
        next: (data) => {
          if (sequence !== this.requestSequence) return;
          this.data.set(data);
          let updatedEntities: AdminMapEntity[] = [];
          this.entities.update((current) => {
            const requests = data.entities.filter((entity) => entity.type === 'request');
            if (reset) {
              const selected =
                this.selectedEntityId === null
                  ? []
                  : current.filter((entity) => entity.id === this.selectedEntityId);
              updatedEntities = this.uniqueEntities([...requests, ...selected]);
              return updatedEntities;
            }
            updatedEntities = this.uniqueEntities([...current, ...requests]);
            return updatedEntities;
          });
          this.resolveLocationLabels(updatedEntities);
          this.page.set(requestedPage);
          if (reset) this.visibleLimit.set(Math.max(20, this.entities().length));
          else this.visibleLimit.update((limit) => limit + 20);
          this.loading.set(false);
          this.loadingMore.set(false);
        },
        error: (error: HttpErrorResponse) => {
          if (sequence !== this.requestSequence) return;
          if (reset) {
            this.error.set(error.error?.message || 'Map data could not be loaded.');
          } else {
            this.loadMoreError.set(error.error?.message || 'More requests could not be loaded.');
          }
          this.loading.set(false);
          this.loadingMore.set(false);
        },
      });
  }

  private loadMarkers(): void {
    const sequence = ++this.markerSequence;
    this.mapEntities.set([]);
    this.mapLoading.set(true);
    this.mapError.set('');
    this.renderMarkers();
    this.adminService
      .getMapMarkers({
        search: this.searchText(),
        city: this.city(),
        state: this.state(),
        from: this.fromDate(),
        to: this.toDate(),
        status: this.status(),
      })
      .subscribe({
        next: (markers) => {
          if (sequence !== this.markerSequence) return;
          const uniqueMarkers = new Map(markers.map((marker) => [marker.id, marker]));
          this.mapEntities.set([...uniqueMarkers.values()]);
          this.mapLoading.set(false);
          this.renderMarkers();
          this.fitAvailableLocations();
        },
        error: (error: HttpErrorResponse) => {
          if (sequence !== this.markerSequence) return;
          this.mapError.set(error.error?.message || 'Map markers could not be loaded.');
          this.mapLoading.set(false);
        },
      });
  }

  private uniqueEntities(entities: AdminMapEntity[]): AdminMapEntity[] {
    return [...new Map(entities.map((entity) => [entity.id, entity])).values()];
  }

  private selectMapMarker(marker: AdminMapMarker): void {
    this.lastSelectedMarker = marker;
    this.mapError.set('');
    if (this.markerDetailRequests.has(marker.id)) return;
    const sequence = ++this.selectionSequence;
    const existing = this.entities().find((entity) => entity.id === marker.id);
    if (existing) {
      this.focusEntity(existing);
      return;
    }

    const markerSequence = this.markerSequence;
    this.markerDetailRequests.add(marker.id);
    this.adminService.getMapRequest(marker.id).subscribe({
      next: (entity) => {
        this.markerDetailRequests.delete(marker.id);
        if (sequence !== this.selectionSequence || markerSequence !== this.markerSequence) return;
        if (!this.entities().some((loaded) => loaded.id === entity.id)) {
          const updatedEntities = this.uniqueEntities([...this.entities(), entity]);
          this.entities.set(updatedEntities);
          this.resolveLocationLabels(updatedEntities);
          this.visibleLimit.set(Math.max(this.visibleLimit(), this.entities().length));
        }
        this.focusEntity(entity);
      },
      error: (error: HttpErrorResponse) => {
        this.markerDetailRequests.delete(marker.id);
        if (sequence !== this.selectionSequence || markerSequence !== this.markerSequence) return;
        this.mapError.set(
          error.error?.message || 'Request details could not be loaded. Select Retry to try again.',
        );
      },
    });
  }

  private scrollToEntity(id: string): void {
    requestAnimationFrame(() => {
      const card = Array.from(
        this.mapShell?.nativeElement.ownerDocument.querySelectorAll<HTMLElement>(
          '.result-card[data-request-id]',
        ) ?? [],
      ).find((element) => element.dataset['requestId'] === id);
      card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  private filterText(value: FilterValue | undefined): string {
    return typeof value === 'string' ? value : '';
  }

  private filterDateRange(value: FilterValue | undefined): FilterRangeValue {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return {
      from: 'from' in value && typeof value.from === 'string' ? value.from : undefined,
      to: 'to' in value && typeof value.to === 'string' ? value.to : undefined,
    };
  }

  private initializeMap(): void {
    if (!this.mapElement || this.map) return;
    this.map = L.map(this.mapElement.nativeElement, {
      scrollWheelZoom: true,
      zoomControl: false,
    }).fitWorld();
    this.streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);
    this.markerLayer.addTo(this.map);
    this.routeLayer.addTo(this.map);
    this.map.on('moveend zoomend', this.renderMarkers);
    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(this.mapElement.nativeElement);
    this.renderMarkers();
    this.fitAvailableLocations();
  }

  private fitAvailableLocations(): void {
    if (!this.map) return;
    const locations = this.mapEntities()
      .filter((marker) => this.isValidLocation(marker.location))
      .map((marker) => [marker.location.latitude, marker.location.longitude] as L.LatLngExpression);
    if (!locations.length) {
      this.map.fitWorld();
    } else if (locations.length === 1) {
      this.map.setView(locations[0], 12);
    } else {
      this.map.fitBounds(L.latLngBounds(locations), { padding: [36, 36], maxZoom: 15 });
    }
  }

  private readonly renderMarkers = (): void => {
    if (!this.map) return;
    this.markerLayer.clearLayers();
    const projected: ProjectedMapEntity[] = this.mapEntities()
      .filter((marker) => this.isValidLocation(marker.location))
      .filter((marker) =>
        this.map!.getBounds().contains([marker.location.latitude, marker.location.longitude]),
      )
      .map((entity) => ({
        entity,
        ...this.map!.latLngToContainerPoint([entity.location.latitude, entity.location.longitude]),
      }))
      .filter(({ x, y }) => Number.isFinite(x) && Number.isFinite(y));
    const clusters: ProjectedMapCluster[] = [];
    const clustersByCell = new Map<string, ProjectedMapCluster[]>();
    const radius = 52;
    for (const point of projected) {
      const cellX = Math.floor(point.x / radius);
      const cellY = Math.floor(point.y / radius);
      let closest: ProjectedMapCluster | undefined;
      let closestDistance = radius * radius;
      for (let x = cellX - 1; x <= cellX + 1; x += 1) {
        for (let y = cellY - 1; y <= cellY + 1; y += 1) {
          for (const candidate of clustersByCell.get(`${x}:${y}`) ?? []) {
            const dx = candidate.anchorX - point.x;
            const dy = candidate.anchorY - point.y;
            const distance = dx * dx + dy * dy;
            if (distance <= closestDistance) {
              closest = candidate;
              closestDistance = distance;
            }
          }
        }
      }
      if (closest) {
        const count = closest.markers.length;
        closest.x = (closest.x * count + point.x) / (count + 1);
        closest.y = (closest.y * count + point.y) / (count + 1);
        closest.markers.push(point);
        continue;
      }
      const cluster: ProjectedMapCluster = {
        markers: [point],
        x: point.x,
        y: point.y,
        anchorX: point.x,
        anchorY: point.y,
      };
      clusters.push(cluster);
      const cell = clustersByCell.get(`${cellX}:${cellY}`) ?? [];
      cell.push(cluster);
      clustersByCell.set(`${cellX}:${cellY}`, cell);
    }
    for (const cluster of clusters) {
      const point = cluster.markers[0];
      if (cluster.markers.length > 1) {
        const marker = L.marker(this.map.containerPointToLatLng([cluster.x, cluster.y]), {
          icon: L.divIcon({
            className: '',
            html: `<span class="admin-map-cluster">${cluster.markers.length}</span>`,
            iconSize: [42, 42],
            iconAnchor: [21, 21],
          }),
        });
        marker.bindPopup(this.createClusterPopup(cluster.markers));
        this.markerLayer.addLayer(marker);
        continue;
      }
      const entity = point.entity;
      const marker = L.marker([entity.location.latitude, entity.location.longitude], {
        icon: L.divIcon({
          className: '',
          html: `<span class="admin-map-marker ${this.markerColor(entity)}${
            entity.id === this.selectedEntityId ? ' selected' : ''
          }">${this.markerGlyph(entity)}</span>`,
          iconSize: [36, 42],
          iconAnchor: [18, 38],
        }),
      });
      marker.bindPopup(this.createMarkerPopup(entity), { maxWidth: 300 });
      marker.on('click', () => this.selectMapMarker(entity));
      this.markerLayer.addLayer(marker);
      if (entity.id === this.selectedEntityId && this.openSelectedPopup) marker.openPopup();
    }
    if (this.openSelectedPopup) this.openSelectedPopup = false;
  };

  private createPopup(entity: AdminMapEntity): HTMLElement {
    const root = document.createElement('div');
    root.className = 'admin-map-popup';
    const heading = document.createElement('strong');
    heading.textContent =
      entity.type === 'request' ? (entity.appliance ?? entity.name) : entity.name;
    root.append(heading);
    const addLine = (label: string, value: string, valueClass?: string): void => {
      if (!value) return;
      const line = document.createElement('p');
      const caption = document.createElement('b');
      caption.textContent = `${label}: `;
      const content = document.createElement(valueClass ? 'strong' : 'span');
      if (valueClass) content.className = valueClass;
      content.textContent = value;
      line.append(caption, content);
      root.append(line);
    };
    if (entity.type === 'customer') {
      addLine('Email', entity.email);
      addLine('Phone', entity.phone);
      addLine('Location', this.locationLabel(entity));
      addLine('Requests', String(entity.repairCounts?.total ?? 0));
      addLine('Active', String(entity.repairCounts?.active ?? 0));
      addLine('Completed', String(entity.repairCounts?.completed ?? 0));
    } else if (entity.type === 'shop') {
      addLine('Owner', entity.ownerName ?? '');
      addLine('Phone', entity.phone);
      addLine('Email', entity.email);
      addLine('Address', this.locationLabel(entity));
      addLine('Approval', entity.approvalStatus ?? entity.status);
      addLine('Account', entity.accountStatus ?? 'Unknown');
      addLine('Total repairs', String(entity.repairCounts?.total ?? 0));
      addLine('Active repairs', String(entity.repairCounts?.active ?? 0));
      addLine('Completed repairs', String(entity.repairCounts?.completed ?? 0));
    } else {
      addLine('Request ID', this.formatRequestId(entity.id), 'request-reference');
      addLine('Customer', entity.customerName ?? '');
      addLine('Customer phone', entity.customerPhone ?? '');
      addLine('Customer email', entity.customerEmail ?? '');
      addLine('Repair shop', entity.shopName ?? 'Not assigned');
      addLine('Shop phone', entity.shopPhone ?? '');
      addLine('Shop email', entity.shopEmail ?? '');
      addLine('Shop location', this.shopLocationLabel(entity));
      addLine('Customer location', this.customerLocationLabel(entity));
      addLine('Issue', entity.description ?? '');
      addLine('Service type', entity.serviceType ?? '');
      addLine('Requested', entity.createdAt ? new Date(entity.createdAt).toLocaleDateString() : '');
      addLine(
        'Quotation',
        entity.quotationAmount === null || entity.quotationAmount === undefined
          ? ''
          : `${entity.quotationAmount} ${entity.quotationCurrency ?? ''}`.trim(),
      );
      addLine('Status', this.statusLabel(entity.status));
    }
    const actions = document.createElement('div');
    actions.className = 'admin-map-popup-actions';
    const detailsLink = document.createElement('a');
    detailsLink.href =
      entity.type === 'request'
        ? `/admin/repair-jobs/${encodeURIComponent(entity.id)}`
        : `/admin/users/${encodeURIComponent(entity.id)}`;
    detailsLink.textContent =
      entity.type === 'customer'
        ? 'View customer'
        : entity.type === 'shop'
          ? 'View shop'
          : 'View request';
    actions.append(detailsLink);
    if (entity.type === 'request') {
      const routeButton = document.createElement('button');
      routeButton.type = 'button';
      routeButton.textContent = 'See route';
      routeButton.disabled = !entity.location || !entity.shopLocation;
      routeButton.addEventListener('click', () => this.showRoute(entity));
      actions.append(routeButton);
    }
    root.append(actions);
    return root;
  }

  private createMarkerPopup(marker: AdminMapMarker): HTMLElement {
    const request = this.entities().find((entity) => entity.id === marker.id);
    if (request) return this.createPopup(request);
    const root = document.createElement('div');
    root.className = 'admin-map-popup';
    const heading = document.createElement('strong');
    heading.textContent = marker.name || 'Repair request';
    root.append(heading);
    const addLine = (label: string, value: string, valueClass?: string): void => {
      const line = document.createElement('p');
      const caption = document.createElement('b');
      caption.textContent = `${label}: `;
      const content = document.createElement(valueClass ? 'strong' : 'span');
      if (valueClass) content.className = valueClass;
      content.textContent = value;
      line.append(caption, content);
      root.append(line);
    };
    addLine('Request ID', this.formatRequestId(marker.id), 'request-reference');
    addLine('Status', this.statusLabel(marker.status));
    addLine('Location', 'Loading location…');
    addLine('Details', 'Loading request details…');
    return root;
  }

  private createClusterPopup(markers: ProjectedMapEntity[]): HTMLElement {
    const root = document.createElement('div');
    root.className = 'admin-map-popup';
    const heading = document.createElement('strong');
    heading.textContent = `${markers.length} repair requests in this area`;
    root.append(heading);
    const list = document.createElement('ul');
    for (const { entity } of markers.slice(0, 5)) {
      const item = document.createElement('li');
      const requestId = document.createElement('strong');
      requestId.className = 'request-reference';
      requestId.textContent = this.formatRequestId(entity.id);
      item.append(requestId, document.createTextNode(` · ${entity.name || 'Repair request'}`));
      list.append(item);
    }
    root.append(list);
    if (markers.length > 5) {
      const remaining = document.createElement('p');
      remaining.textContent = `and ${markers.length - 5} more`;
      root.append(remaining);
    }
    const zoomButton = document.createElement('button');
    zoomButton.type = 'button';
    zoomButton.textContent = 'Zoom to these requests';
    zoomButton.addEventListener('click', () => {
      this.map?.fitBounds(
        L.latLngBounds(
          markers.map(
            ({ entity }) =>
              [entity.location.latitude, entity.location.longitude] as L.LatLngExpression,
          ),
        ),
        { padding: [56, 56], maxZoom: 18 },
      );
    });
    root.append(zoomButton);
    return root;
  }

  private markerGlyph(entity: Pick<AdminMapEntity, 'type' | 'status' | 'name'>): string {
    if (entity.type === 'customer') return this.initials(entity.name);
    if (entity.type === 'shop') return 'S';
    if (entity.status === 'completed') return '✓';
    if (entity.status === 'disputed') return '!';
    if (entity.status === 'cancelled') return '×';
    if (this.markerColor(entity) === 'in-progress') return '↻';
    return '•';
  }

  private initials(value: string): string {
    const parts = value.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'C';
    return parts.length > 1
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }

  private isValidLocation(location: { latitude: number; longitude: number }): boolean {
    return (
      Number.isFinite(location.latitude) &&
      location.latitude >= -90 &&
      location.latitude <= 90 &&
      Number.isFinite(location.longitude) &&
      location.longitude >= -180 &&
      location.longitude <= 180
    );
  }

  private isValidRoute(route: AdminMapRoute): boolean {
    return (
      Number.isFinite(route.distanceMeters) &&
      route.distanceMeters >= 0 &&
      Number.isFinite(route.durationSeconds) &&
      route.durationSeconds >= 0 &&
      Array.isArray(route.path) &&
      route.path.length > 0 &&
      route.path.every((point) => this.isValidLocation(point))
    );
  }
}
