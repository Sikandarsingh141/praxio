import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  HostListener,
  ViewChild,
  signal,
} from '@angular/core';
import * as L from 'leaflet';
import { ShopSearchResult } from './customer-portal.models';

@Component({
  selector: 'app-shop-results-map',
  standalone: true,
  template: `
    <div #mapShell class="map-shell" [class.fullscreen]="fullscreenActive()">
      <div
        #mapElement
        class="shop-map"
        [attr.aria-label]="'Map showing ' + locatedShopCount + ' repair shops'"
      ></div>
      <div class="map-style-control" role="group" aria-label="Map style">
        <button
          type="button"
          [class.active]="mapStyle === 'street'"
          (click)="setMapStyle('street')"
        >
          Map
        </button>
        <button
          type="button"
          [class.active]="mapStyle === 'satellite'"
          (click)="setMapStyle('satellite')"
        >
          Satellite
        </button>
      </div>
      <button
        class="map-fullscreen-control"
        type="button"
        [attr.aria-label]="fullscreenActive() ? 'Exit full screen map' : 'Expand map to full screen'"
        [attr.aria-pressed]="fullscreenActive()"
        (click)="toggleFullscreen()"
      >
        @if (fullscreenActive()) {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 3v5H3M16 3v5h5M8 21v-5H3m13 5v-5h5" />
          </svg>
        } @else {
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
          </svg>
        }
      </button>
      <div class="map-zoom-control" aria-label="Map zoom controls">
        <button type="button" aria-label="Zoom in" (click)="zoomIn()">+</button>
        <button type="button" aria-label="Zoom out" (click)="zoomOut()">−</button>
      </div>
      @if (fullscreenError()) {
        <p class="map-control-error" role="status">{{ fullscreenError() }}</p>
      }
      <div class="map-legend" aria-label="Map legend">
        <span><i class="current-location-key"></i>Your location</span>
        <span><i class="repair-shop-key"></i>Repair shop</span>
        <span>{{ locatedShopCount }} located</span>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .map-shell {
      position: relative;
      z-index: 0;
      height: 100%;
      min-height: clamp(320px, 31vw, 440px);
    }

    .shop-map {
      width: 100%;
      height: 100%;
      min-height: clamp(320px, 31vw, 440px);
      border-radius: 0.9rem;
      background: #e8eee8;
    }

    .map-shell:fullscreen {
      width: 100vw;
      height: 100vh;
      height: 100dvh;
      min-height: 0;
      background: #e8eee8;
    }

    .map-shell:fullscreen .shop-map {
      width: 100%;
      height: 100%;
      min-height: 0;
      border-radius: 0;
    }

    .map-style-control,
    .map-fullscreen-control,
    .map-zoom-control,
    .map-legend {
      position: absolute;
      z-index: 500;
      display: flex;
      align-items: center;
      border: 1px solid #e1e6e3;
      border-radius: 0.65rem;
      background: #fff;
      box-shadow: 0 2px 8px rgb(20 40 28 / 14%);
    }

    .map-style-control {
      top: 0.7rem;
      left: 0.7rem;
      gap: 0.2rem;
      padding: 0.2rem;
    }

    .map-style-control button,
    .map-zoom-control button,
    .map-fullscreen-control {
      border: 0;
      background: transparent;
      color: #27392e;
      cursor: pointer;
      font: inherit;
      font-size: 0.75rem;
      font-weight: 650;
    }

    .map-fullscreen-control {
      top: 0.7rem;
      right: 0.7rem;
      width: 2.2rem;
      height: 2.2rem;
      justify-content: center;
      padding: 0.5rem;
    }

    .map-fullscreen-control svg {
      width: 1.15rem;
      height: 1.15rem;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 1.8;
    }

    .map-style-control button {
      min-height: 2rem;
      padding: 0.35rem 0.7rem;
      border-radius: 0.45rem;
    }

    .map-style-control button.active {
      background: #075d35;
      color: #fff;
    }

    .map-zoom-control {
      top: 3.25rem;
      right: 0.7rem;
      flex-direction: column;
      overflow: hidden;
    }

    .map-control-error {
      position: absolute;
      z-index: 500;
      right: 0.7rem;
      bottom: 0.7rem;
      max-width: min(22rem, calc(100% - 1.4rem));
      margin: 0;
      padding: 0.55rem 0.7rem;
      border: 1px solid #e8c5c2;
      border-radius: 0.55rem;
      background: #fff;
      color: #9d3e37;
      font-size: 0.72rem;
      box-shadow: 0 2px 8px rgb(20 40 28 / 14%);
    }

    .map-zoom-control button {
      width: 2.2rem;
      height: 2.15rem;
      font-size: 1.2rem;
      line-height: 1;
    }

    .map-zoom-control button + button {
      border-top: 1px solid #e7ebe8;
    }

    .map-legend {
      bottom: 0.7rem;
      left: 0.7rem;
      flex-wrap: wrap;
      gap: 0.8rem;
      padding: 0.5rem 0.7rem;
      color: #34443a;
      font-size: 0.65rem;
      font-weight: 600;
    }

    .map-legend span {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }

    .map-legend i {
      width: 0.62rem;
      height: 0.62rem;
      border-radius: 50%;
    }

    .current-location-key {
      background: #087c3b;
      box-shadow: 0 0 0 3px #d8f1dc;
    }

    .repair-shop-key {
      background: #315d4b;
    }

    :host ::ng-deep .shop-marker-cluster {
      display: grid;
      width: 46px;
      height: 46px;
      place-items: center;
      border: 3px solid #fff;
      border-radius: 50%;
      background: #087c3b;
      box-shadow: 0 2px 9px rgb(20 40 28 / 35%), 0 0 0 5px rgb(8 124 59 / 14%);
      color: #fff;
      font-size: 0.95rem;
      font-weight: 750;
    }

    :host ::ng-deep .shop-marker-cluster.focused {
      box-shadow: 0 0 0 8px rgb(8 124 59 / 24%), 0 2px 9px rgb(20 40 28 / 35%);
      transform: scale(1.12);
    }

    @media (max-width: 900px) {
      .map-shell,
      .shop-map {
        min-height: 360px;
      }
    }

    @media (max-width: 560px) {
      .map-shell,
      .shop-map {
        min-height: 300px;
      }
    }
  `,
})
export class ShopResultsMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() shops: ShopSearchResult[] = [];
  @Input() center: { latitude: number; longitude: number } | null = null;
  @ViewChild('mapShell') private mapShell?: ElementRef<HTMLDivElement>;
  @ViewChild('mapElement') private mapElement?: ElementRef<HTMLDivElement>;

  mapStyle: 'street' | 'satellite' = 'street';
  readonly fullscreenActive = signal(false);
  readonly fullscreenError = signal('');
  private map?: L.Map;
  private streetLayer?: L.TileLayer;
  private satelliteLayer?: L.TileLayer;
  private mapResizeObserver?: ResizeObserver;
  private locationMarkers = L.layerGroup();
  private shopMarkers = L.layerGroup();
  private focusedShopId: string | null = null;
  private openFocusedShopPopup = false;

  get locatedShopCount(): number {
    return this.shops.filter((shop) => this.hasValidLocation(shop)).length;
  }

  private readonly refreshShopMarkers = (): void => this.renderShopMarkers();

  ngAfterViewInit(): void {
    if (!this.mapElement) {
      return;
    }
    const startingPoint = this.center ?? { latitude: 20.5937, longitude: 78.9629 };
    this.map = L.map(this.mapElement.nativeElement, {
      scrollWheelZoom: true,
      zoomControl: false,
    }).setView([startingPoint.latitude, startingPoint.longitude], this.center ? 11 : 5);
    this.streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(this.map);
    this.locationMarkers.addTo(this.map);
    this.shopMarkers.addTo(this.map);
    this.map.on('zoomend moveend', this.refreshShopMarkers);
    this.mapResizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.mapResizeObserver.observe(this.mapElement.nativeElement);
    this.updateMarkers();
  }

  ngOnChanges(): void {
    if (!this.map) {
      return;
    }
    if (this.focusedShopId && !this.shops.some((shop) => shop.id === this.focusedShopId)) {
      this.focusedShopId = null;
      this.openFocusedShopPopup = false;
    }
    if (this.center) {
      this.map.setView([this.center.latitude, this.center.longitude], 12);
    }
    this.updateMarkers();
  }

  ngOnDestroy(): void {
    this.mapResizeObserver?.disconnect();
    this.map?.remove();
  }

  async toggleFullscreen(): Promise<void> {
    const shell = this.mapShell?.nativeElement;
    if (!shell) {
      return;
    }
    this.fullscreenError.set('');
    try {
      if (document.fullscreenElement === shell) {
        await document.exitFullscreen();
      } else {
        await shell.requestFullscreen();
      }
    } catch {
      this.fullscreenError.set('Full screen is unavailable in this browser or window.');
    }
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    const isActive = document.fullscreenElement === this.mapShell?.nativeElement;
    this.fullscreenActive.set(isActive);
    this.fullscreenError.set('');
    requestAnimationFrame(() => {
      this.map?.invalidateSize();
      this.renderShopMarkers();
    });
  }

  setMapStyle(style: 'street' | 'satellite'): void {
    this.mapStyle = style;
    if (!this.map) {
      return;
    }
    if (style === 'satellite') {
      this.streetLayer?.remove();
      this.satelliteLayer ??= L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri',
          maxZoom: 19,
        },
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

  focusShop(shopId: string): void {
    const shop = this.shops.find((candidate) => candidate.id === shopId);
    if (!this.map || !shop || !this.hasValidLocation(shop)) {
      return;
    }

    this.focusedShopId = shopId;
    this.openFocusedShopPopup = true;
    this.map.flyTo(
      [shop.location.latitude, shop.location.longitude],
      Math.max(15, this.map.getZoom()),
      { duration: 0.7 },
    );
    this.mapElement?.nativeElement.scrollIntoView?.({
      behavior: 'smooth',
      block: 'nearest',
    });
    this.renderShopMarkers();
  }

  private updateMarkers(): void {
    if (!this.map) {
      return;
    }
    this.locationMarkers.clearLayers();
    const bounds: L.LatLngExpression[] = [];
    if (this.center) {
      const current = L.circleMarker([this.center.latitude, this.center.longitude], {
        radius: 8,
        color: '#fff',
        weight: 3,
        fillColor: '#087c3b',
        fillOpacity: 1,
      }).bindPopup('Your selected location');
      this.locationMarkers.addLayer(current);
      bounds.push([this.center.latitude, this.center.longitude]);
    }
    this.shops.forEach((shop) => {
      if (!this.hasValidLocation(shop)) {
        return;
      }
      bounds.push([shop.location.latitude, shop.location.longitude]);
    });
    if (bounds.length > 1) {
      this.map.fitBounds(L.latLngBounds(bounds), { padding: [24, 24], maxZoom: 13 });
    } else if (bounds.length === 1) {
      this.map.setView(bounds[0], this.center ? 12 : 10);
    }
    this.renderShopMarkers();
  }

  private renderShopMarkers(): void {
    if (!this.map) {
      return;
    }
    this.shopMarkers.clearLayers();
    const visible = this.shops
      .filter((shop) => this.hasValidLocation(shop))
      .map((shop) => ({
        shop,
        point: this.map!.latLngToContainerPoint([
          shop.location!.latitude,
          shop.location!.longitude,
        ]),
      }))
      .filter(({ point }) => this.map!.getBounds().contains(this.map!.containerPointToLatLng(point)));
    const clusters = clusterProjectedShops(
      visible.map(({ shop, point }) => ({ shop, x: point.x, y: point.y })),
    );
    let focusedMarker: L.Marker | undefined;
    clusters.forEach((cluster) => {
      const location = this.map!.containerPointToLatLng([cluster.x, cluster.y]);
      const focusedShop = cluster.shops.find(
        (shop) => shop.id === this.focusedShopId,
      );
      const marker = L.marker(location, {
        icon: L.divIcon({
          className: '',
          html: `<span class="shop-marker-cluster${focusedShop ? ' focused' : ''}">${cluster.shops.length}</span>`,
          iconSize: [46, 46],
          iconAnchor: [23, 23],
        }),
      });
      if (focusedShop || cluster.shops.length === 1) {
        const shop = focusedShop ?? cluster.shops[0];
        marker.bindPopup(
          `<strong>${this.escapeHtml(shop.shopName)}</strong><br>${this.escapeHtml(shop.city)}`,
        );
        if (focusedShop && this.openFocusedShopPopup) {
          focusedMarker = marker;
        }
      } else {
        marker.bindPopup(`${cluster.shops.length} repair shops`);
      }
      this.shopMarkers.addLayer(marker);
    });
    if (focusedMarker) {
      focusedMarker.openPopup();
      this.openFocusedShopPopup = false;
    }
  }

  private hasValidLocation(
    shop: ShopSearchResult,
  ): shop is ShopSearchResult & {
    location: { latitude: number; longitude: number };
  } {
    const location = shop.location;
    return (
      location !== null &&
      Number.isFinite(location.latitude) &&
      location.latitude >= -90 &&
      location.latitude <= 90 &&
      Number.isFinite(location.longitude) &&
      location.longitude >= -180 &&
      location.longitude <= 180
    );
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return entities[character] ?? character;
    });
  }
}

export interface ProjectedShop {
  shop: ShopSearchResult;
  x: number;
  y: number;
}

export interface ShopMarkerCluster {
  shops: ShopSearchResult[];
  x: number;
  y: number;
}

export function clusterProjectedShops(
  points: ProjectedShop[],
  radius = 56,
): ShopMarkerCluster[] {
  const clusters: Array<ShopMarkerCluster & { anchorX: number; anchorY: number }> = [];
  const clustersByCell = new Map<string, typeof clusters>();

  points.forEach((point) => {
    const cellX = Math.floor(point.x / radius);
    const cellY = Math.floor(point.y / radius);
    let closest: (typeof clusters)[number] | undefined;
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
      const count = closest.shops.length;
      closest.x = (closest.x * count + point.x) / (count + 1);
      closest.y = (closest.y * count + point.y) / (count + 1);
      closest.shops.push(point.shop);
      return;
    }

    const cluster = {
      shops: [point.shop],
      x: point.x,
      y: point.y,
      anchorX: point.x,
      anchorY: point.y,
    };
    clusters.push(cluster);
    const key = `${cellX}:${cellY}`;
    const cellClusters = clustersByCell.get(key) ?? [];
    cellClusters.push(cluster);
    clustersByCell.set(key, cellClusters);
  });

  return clusters.map(({ shops, x, y }) => ({ shops, x, y }));
}
