import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  signal,
} from '@angular/core';
import * as L from 'leaflet';
import { ShopRepairRoute } from './shop-repair-requests.models';
import { ShopRepairRequestsService } from './shop-repair-requests.service';

type Coordinates = { latitude: number; longitude: number };

@Component({
  selector: 'app-shop-repair-route',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './shop-repair-route.component.html',
  styleUrl: './shop-repair-route.component.scss',
})
export class ShopRepairRouteComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input() requestId = '';
  @Input() shopLocation: Coordinates | null | undefined;
  @Input() customerLocation: Coordinates | null | undefined;
  private mapElement?: ElementRef<HTMLDivElement>;
  @ViewChild('mapElement')
  set mapElementRef(element: ElementRef<HTMLDivElement> | undefined) {
    this.mapElement = element;
    if (!element && this.map) {
      this.map.remove();
      this.map = undefined;
      this.routeLine = undefined;
    } else if (this.viewReady) {
      this.initializeMap();
    }
  }

  readonly directionsLoading = signal(false);
  readonly directionsError = signal('');
  readonly route = signal<ShopRepairRoute | null>(null);
  private map?: L.Map;
  private routeLine?: L.Polyline;
  private requestSequence = 0;
  private lastDirectionsKey: string | null = null;
  private viewReady = false;

  constructor(private readonly requestsService: ShopRepairRequestsService) {}

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.initializeMap();
    this.loadDirections();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const requestChanged =
      !!changes['requestId'] &&
      changes['requestId'].previousValue !== changes['requestId'].currentValue;
    const shopLocationChanged =
      !!changes['shopLocation'] &&
      !this.sameCoordinates(
        changes['shopLocation'].previousValue,
        changes['shopLocation'].currentValue,
      );
    const customerLocationChanged =
      !!changes['customerLocation'] &&
      !this.sameCoordinates(
        changes['customerLocation'].previousValue,
        changes['customerLocation'].currentValue,
      );
    if (requestChanged || shopLocationChanged || customerLocationChanged) {
      this.requestSequence += 1;
      this.directionsLoading.set(false);
      this.route.set(null);
      this.directionsError.set('');
      this.routeLine?.remove();
      this.initializeMap();
      this.loadDirections();
    }
  }

  private sameCoordinates(
    left: Coordinates | null | undefined,
    right: Coordinates | null | undefined,
  ): boolean {
    return (
      left === right ||
      (!!left &&
        !!right &&
        left.latitude === right.latitude &&
        left.longitude === right.longitude)
    );
  }

  ngOnDestroy(): void {
    this.requestSequence += 1;
    this.map?.remove();
  }

  hasRouteCoordinates(): boolean {
    return (
      this.isValidCoordinates(this.shopLocation) &&
      this.isValidCoordinates(this.customerLocation)
    );
  }

  googleDirectionsUrl(): string | null {
    const shop = this.shopLocation;
    const customer = this.customerLocation;
    if (!this.isValidCoordinates(shop) || !this.isValidCoordinates(customer)) return null;
    return (
      `https://www.google.com/maps/dir/?api=1&origin=${shop.latitude},${shop.longitude}` +
      `&destination=${customer.latitude},${customer.longitude}&travelmode=driving`
    );
  }

  private initializeMap(): void {
    if (this.map || !this.mapElement || !this.hasRouteCoordinates()) return;

    const shop = this.shopLocation!;
    const customer = this.customerLocation!;
    this.map = L.map(this.mapElement.nativeElement, {
      scrollWheelZoom: false,
      zoomControl: true,
    }).setView(
      [
        (shop.latitude + customer.latitude) / 2,
        (shop.longitude + customer.longitude) / 2,
      ],
      12,
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 5,
    }).addTo(this.map);
    L.circleMarker([shop.latitude, shop.longitude], {
      radius: 8,
      color: '#fff',
      weight: 3,
      fillColor: '#087c3b',
      fillOpacity: 1,
    })
      .bindTooltip('Your shop')
      .addTo(this.map);
    L.circleMarker([customer.latitude, customer.longitude], {
      radius: 8,
      color: '#fff',
      weight: 3,
      fillColor: '#d4473e',
      fillOpacity: 1,
    })
      .bindTooltip('Customer location')
      .addTo(this.map);
    requestAnimationFrame(() => this.map?.invalidateSize());
  }

  private loadDirections(): void {
    if (
      !this.viewReady ||
      !this.requestId ||
      !this.hasRouteCoordinates() ||
      this.directionsLoading()
    ) {
      return;
    }
    const key = JSON.stringify({
      requestId: this.requestId,
      shop: this.shopLocation,
      customer: this.customerLocation,
    });
    if (this.lastDirectionsKey === key) return;
    this.lastDirectionsKey = key;
    const sequence = ++this.requestSequence;
    this.directionsLoading.set(true);
    this.directionsError.set('');
    this.requestsService.getDirections(this.requestId).subscribe({
      next: (route) => {
        if (sequence !== this.requestSequence) return;
        if (!this.isValidRoute(route)) {
          this.directionsError.set('The directions service returned an invalid route.');
          this.directionsLoading.set(false);
          return;
        }
        this.route.set(route);
        this.drawRoute(route);
        this.directionsLoading.set(false);
      },
      error: (error: { error?: { message?: unknown } }) => {
        if (sequence !== this.requestSequence) return;
        const message = error.error?.message;
        this.directionsError.set(
          typeof message === 'string' && message !== 'An unexpected error occurred'
            ? message
            : 'Driving directions are temporarily unavailable. Use Get Directions in Google Maps instead.',
        );
        this.directionsLoading.set(false);
      },
    });
  }

  private drawRoute(route: ShopRepairRoute): void {
    if (!this.map) return;
    this.routeLine?.remove();
    this.routeLine = L.polyline(
      route.path.map((point) => [point.latitude, point.longitude]),
      { color: '#1769ff', opacity: 0.95, weight: 6 },
    ).addTo(this.map);
    this.map.fitBounds(this.routeLine.getBounds(), { padding: [28, 28] });
  }

  private isValidRoute(route: ShopRepairRoute): boolean {
    return (
      Number.isFinite(route.distanceMeters) &&
      route.distanceMeters >= 0 &&
      Number.isFinite(route.durationSeconds) &&
      route.durationSeconds >= 0 &&
      typeof route.description === 'string' &&
      Array.isArray(route.path) &&
      route.path.length > 0 &&
      route.path.every((point) => this.isValidCoordinates(point))
    );
  }

  private isValidCoordinates(
    location: Coordinates | null | undefined,
  ): location is Coordinates {
    return (
      !!location &&
      Number.isFinite(location.latitude) &&
      location.latitude >= -90 &&
      location.latitude <= 90 &&
      Number.isFinite(location.longitude) &&
      location.longitude >= -180 &&
      location.longitude <= 180
    );
  }
}
