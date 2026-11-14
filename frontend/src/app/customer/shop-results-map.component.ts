import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  HostListener,
  Output,
  ViewChild,
  signal,
} from '@angular/core';
import * as L from 'leaflet';
import { ShopSearchResult } from './customer-portal.models';
import { formatShopAddress } from '../shared/format-shop-address';

const MARKER_SPREAD_RADIUS_PX = 24;

type LocatedShop = ShopSearchResult & {
  location: { latitude: number; longitude: number };
};
type VisibleShop = { shop: LocatedShop; point: L.Point };

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
        [attr.aria-label]="
          fullscreenActive() ? 'Exit full screen map' : 'Expand map to full screen'
        "
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
      background: #2563eb;
    }

    :host ::ng-deep .shop-marker-dot {
      display: block;
      width: 15px;
      height: 15px;
      border: 3px solid #fff;
      border-radius: 50%;
      background: #2563eb;
      box-shadow: 0 1px 5px rgb(20 40 28 / 45%);
    }

    :host ::ng-deep .shop-marker-dot.focused {
      box-shadow:
        0 0 0 6px rgb(37 99 235 / 22%),
        0 1px 5px rgb(20 40 28 / 45%);
    }

    :host ::ng-deep .leaflet-control-scale-line {
      border-color: #526357;
      background: rgb(255 255 255 / 90%);
      color: #26372c;
      font-size: 0.65rem;
    }

    :host ::ng-deep .shop-map-popup {
      width: min(340px, calc(100vw - 5rem));
      color: #26372c;
      font-family: inherit;
    }

    :host ::ng-deep .shop-map-popup-heading {
      display: flex;
      align-items: flex-start;
      gap: 0.65rem;
    }

    :host ::ng-deep .shop-map-popup-photo {
      width: 5rem;
      height: 4.25rem;
      flex: 0 0 auto;
      border-radius: 0.6rem;
      background: #edf4ef;
      object-fit: cover;
    }

    :host ::ng-deep .shop-map-popup-photo-placeholder {
      display: grid;
      width: 5rem;
      height: 4.25rem;
      flex: 0 0 auto;
      place-items: center;
      border-radius: 0.6rem;
      background: #edf4ef;
      color: #52705c;
      font-size: 1.6rem;
      font-weight: 750;
    }

    :host ::ng-deep .shop-map-popup-title {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      margin: 0 0 0.2rem;
      color: #17271d;
      font-size: 0.88rem;
      line-height: 1.25;
    }

    :host ::ng-deep .shop-map-popup-verified {
      display: inline-grid;
      width: 1rem;
      height: 1rem;
      flex: 0 0 auto;
      place-items: center;
      border-radius: 50%;
      background: #078137;
      color: #fff;
      font-size: 0.68rem;
    }

    :host ::ng-deep .shop-map-popup-category,
    :host ::ng-deep .shop-map-popup-address {
      margin: 0.2rem 0 0;
      color: #647169;
      font-size: 0.7rem;
      line-height: 1.4;
    }

    :host ::ng-deep .shop-map-popup-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem 0.8rem;
      margin-top: 0.55rem;
      color: #34443a;
      font-size: 0.7rem;
      font-weight: 650;
    }

    :host ::ng-deep .shop-map-popup-rating {
      color: #e6a400;
    }

    :host ::ng-deep .shop-map-popup-rating span {
      color: #34443a;
      font-weight: 500;
    }

    :host ::ng-deep .shop-map-popup-services {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
      margin-top: 0.6rem;
    }

    :host ::ng-deep .shop-map-popup-service {
      padding: 0.25rem 0.45rem;
      border-radius: 99px;
      background: #eaf5ed;
      color: #315d4b;
      font-size: 0.62rem;
      font-weight: 650;
    }

    :host ::ng-deep .shop-map-popup-actions {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.35rem;
      margin-top: 0.7rem;
    }

    :host ::ng-deep .shop-map-popup-action {
      display: inline-flex;
      min-height: 2rem;
      align-items: center;
      justify-content: center;
      padding: 0.35rem 0.4rem;
      border: 1px solid #cfe0d2;
      border-radius: 0.5rem;
      background: #fff;
      color: #315d4b;
      cursor: pointer;
      font: inherit;
      font-size: 0.64rem;
      font-weight: 700;
      text-align: center;
      text-decoration: none;
    }

    :host ::ng-deep .shop-map-popup-action.primary {
      border-color: #087c3b;
      background: #087c3b;
      color: #fff;
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
  @Output() readonly requestRepair = new EventEmitter<ShopSearchResult>();
  @Output() readonly viewDetails = new EventEmitter<string>();
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
    L.control.scale({ position: 'bottomright', metric: true, imperial: false }).addTo(this.map);
    this.shopMarkers.addTo(this.map);
    this.locationMarkers.addTo(this.map);
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
      }).bindPopup('Your location');
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
      this.map.fitBounds(L.latLngBounds(bounds), { padding: [24, 24], maxZoom: 15 });
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
      .filter(({ shop }) =>
        this.map!.getBounds().contains([shop.location!.latitude, shop.location!.longitude]),
      );
    let focusedMarker: L.Marker | undefined;

    this.groupVisibleShops(visible).forEach((group) => {
      const focusedIndex = group.findIndex(({ shop }) => shop.id === this.focusedShopId);
      const offsets =
        group.length === 1
          ? [L.point(0, 0)]
          : this.spreadOffsets(focusedIndex >= 0 ? group.length - 1 : group.length);
      let offsetIndex = 0;
      group.forEach(({ shop, point }, index) => {
        const offset = focusedIndex === index ? L.point(0, 0) : offsets[offsetIndex++];
        const location: L.LatLngExpression =
          offset.x === 0 && offset.y === 0
            ? [shop.location.latitude, shop.location.longitude]
            : this.map!.containerPointToLatLng(point.add(offset));
        const marker = this.createShopMarker(shop, location);
        if (shop.id === this.focusedShopId && this.openFocusedShopPopup) focusedMarker = marker;
        this.shopMarkers.addLayer(marker);
      });
    });

    if (focusedMarker) {
      focusedMarker.openPopup();
      this.openFocusedShopPopup = false;
    }
  }

  private groupVisibleShops(visible: VisibleShop[]): VisibleShop[][] {
    const remaining = [...visible];
    const groups: VisibleShop[][] = [];
    while (remaining.length > 0) {
      const seed = remaining.shift()!;
      const group = [seed];
      for (let index = remaining.length - 1; index >= 0; index -= 1) {
        if (remaining[index].point.distanceTo(seed.point) < MARKER_SPREAD_RADIUS_PX) {
          group.push(remaining.splice(index, 1)[0]);
        }
      }
      groups.push(group);
    }
    return groups;
  }

  private spreadOffsets(count: number): L.Point[] {
    if (count <= 0) {
      return [];
    }
    const offsets: L.Point[] = [];
    let remaining = count;
    let ring = 0;
    while (remaining > 0) {
      const radius = 18 + ring * 20;
      const capacity = Math.max(1, Math.floor((2 * Math.PI * radius) / 22));
      const slots = Math.min(remaining, capacity);
      const startAngle = ring % 2 === 0 ? 0 : Math.PI / slots;
      for (let slot = 0; slot < slots; slot += 1) {
        const angle = startAngle + (slot * 2 * Math.PI) / slots;
        offsets.push(L.point(Math.cos(angle) * radius, Math.sin(angle) * radius));
      }
      remaining -= slots;
      ring += 1;
    }
    return offsets;
  }

  private createShopMarker(shop: LocatedShop, location: L.LatLngExpression): L.Marker {
    const focusedShop = shop.id === this.focusedShopId;
    const marker = L.marker(location, {
      riseOnHover: true,
      riseOffset: 250,
      icon: L.divIcon({
        className: 'shop-map-marker-icon',
        html: `<span class="shop-marker-dot${focusedShop ? ' focused' : ''}"></span>`,
        iconSize: [21, 21],
        iconAnchor: [10.5, 10.5],
      }),
    });
    marker.bindPopup(this.shopPopupContent(shop), { autoPan: true, maxWidth: 360 });
    marker.on('popupopen', (event) => {
      const popupElement = event.popup.getElement();
      const button = popupElement?.querySelector<HTMLButtonElement>('[data-request-shop]');
      if (button) {
        button.onclick = () => {
          this.map?.closePopup();
          this.requestRepair.emit(shop);
        };
      }
      const detailsLink = popupElement?.querySelector<HTMLAnchorElement>('[data-shop-details]');
      if (detailsLink) {
        detailsLink.onclick = (clickEvent) => {
          clickEvent.preventDefault();
          this.viewDetails.emit(shop.id);
        };
      }
    });
    return marker;
  }

  private shopPopupContent(shop: ShopSearchResult): string {
    const photo = this.safePhotoUrl(shop.logoUrl);
    const photoMarkup = photo
      ? `<img class="shop-map-popup-photo" src="${this.escapeHtml(photo)}" alt="${this.escapeHtml(shop.shopName)} shop photo">`
      : `<span class="shop-map-popup-photo-placeholder" aria-hidden="true">${this.escapeHtml(shop.shopName.slice(0, 1).toLocaleUpperCase() || 'S')}</span>`;
    const rating =
      shop.rating === null
        ? 'No reviews yet'
        : `<span class="shop-map-popup-rating">★ <span>${shop.rating.toFixed(1)} (${shop.reviewCount} ${shop.reviewCount === 1 ? 'review' : 'reviews'})</span></span>`;
    const address = formatShopAddress(shop) || 'Address unavailable';
    const distance =
      shop.distanceKm === null ? 'Distance unavailable' : `${shop.distanceKm.toFixed(1)} km`;
    const services = shop.services
      .slice(0, 6)
      .map((service) => `<span class="shop-map-popup-service">${this.escapeHtml(service)}</span>`)
      .join('');
    const destination = `${shop.location!.latitude},${shop.location!.longitude}`;

    return `
        <div class="shop-map-popup">
          <div class="shop-map-popup-heading">
            ${photoMarkup}
            <div>
              <h2 class="shop-map-popup-title">
                ${this.escapeHtml(shop.shopName)}
                <span class="shop-map-popup-verified" role="img" aria-label="Verified shop">✓</span>
              </h2>
              <p class="shop-map-popup-category">${this.escapeHtml(shop.businessType)}</p>
              <div class="shop-map-popup-meta">
                <span>${rating}</span>
                <span aria-label="Distance from your location">${this.escapeHtml(distance)}</span>
              </div>
            </div>
          </div>
          <p class="shop-map-popup-address">${this.escapeHtml(address)}</p>
          ${services ? `<div class="shop-map-popup-services" aria-label="Available repair services">${services}</div>` : ''}
          <div class="shop-map-popup-actions">
            <a class="shop-map-popup-action primary" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}" target="_blank" rel="noopener noreferrer">Get Directions</a>
            <a class="shop-map-popup-action" href="/customer/shops/${encodeURIComponent(shop.id)}" data-shop-details>View Details</a>
            <button class="shop-map-popup-action" type="button" data-request-shop>Request a Repair</button>
          </div>
        </div>
      `;
  }

  private safePhotoUrl(value: string | null): string | null {
    if (!value) return null;
    if (/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) {
      return value;
    }
    try {
      const url = new URL(value, document.baseURI);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch {
      return null;
    }
  }

  private hasValidLocation(shop: ShopSearchResult): shop is ShopSearchResult & {
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
