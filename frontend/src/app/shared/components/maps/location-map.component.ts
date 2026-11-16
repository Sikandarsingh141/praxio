import { Component, Input } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

export interface MapCoordinates {
  latitude: number;
  longitude: number;
}

@Component({
  selector: 'app-location-map',
  standalone: true,
  template: `
    <section class="location-map-card" [class.compact]="compact" [attr.aria-label]="title">
      <header class="location-heading">
        @if (compact) {
          <span class="location-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
          </span>
        }
        <div>
          <h2>{{ title }}</h2>
          @if (compact && !isValidLocation()) {
            <p class="no-location">No valid map coordinates are saved.</p>
          }
        </div>
      </header>
      @if (isValidLocation()) {
        <iframe
          class="location-map"
          [src]="mapEmbedUrl()"
          [title]="title"
          loading="lazy"
          referrerpolicy="no-referrer"
        ></iframe>
        <!-- <p class="coordinates">
          Latitude: {{ location?.latitude }} · Longitude: {{ location?.longitude }}
        </p> -->
        <a class="map-link" [href]="googleMapsUrl()" target="_blank" rel="noopener noreferrer">
          Open in Google Maps
        </a>
      } @else {
        @if (!compact) {
          <p class="no-location">No valid map coordinates are saved.</p>
        }
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .location-map-card {
      margin: 1rem 0;
      padding: clamp(1.1rem, 3vw, 1.7rem);
      border: 1px solid #dfe7df;
      border-radius: 1rem;
      background: #fff;
    }

    .location-heading {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    h2 {
      margin: 0 0 0.9rem;
      color: #23313b;
      font-size: 1.1rem;
    }

    .location-icon {
      display: grid;
      width: 2.5rem;
      height: 2.5rem;
      flex: 0 0 auto;
      place-items: center;
      border-radius: 0.65rem;
      background: #d9f6df;
      color: #078132;
    }

    .location-icon svg {
      width: 1.4rem;
      height: 1.4rem;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 1.8;
    }

    .location-map-card.compact {
      display: grid;
      gap: 0.75rem;
      min-height: 4.5rem;
      align-content: center;
      margin: 0.75rem 0;
      padding: 0.8rem 1rem;
      border-radius: 0.9rem;
      box-shadow: 0 2px 8px rgb(20 40 28 / 5%);
    }

    .compact .location-heading h2 {
      margin: 0;
      color: #18221d;
      font-size: 0.95rem;
    }

    .compact .no-location {
      margin: 0.2rem 0 0;
      font-size: 0.76rem;
    }

    .compact .location-map {
      height: 7.5rem;
    }

    .compact .coordinates {
      margin: 0;
      font-size: 0.7rem;
    }

    .compact .map-link {
      justify-self: start;
      min-height: 2rem;
      padding: 0.4rem 0.65rem;
      background: #fff;
      color: #176b34;
      outline: 1px solid #b7d8bf;
    }

    .location-map {
      display: block;
      width: 100%;
      height: 300px;
      border: 0;
      border-radius: 0.7rem;
      background: #eef2f3;
    }

    .coordinates,
    .no-location {
      margin: 0.75rem 0;
      color: #64746a;
      font-size: 0.8rem;
    }

    .map-link {
      display: inline-flex;
      min-height: 2.4rem;
      align-items: center;
      padding: 0.5rem 0.8rem;
      border-radius: 0.6rem;
      background: #344f68;
      color: #fff;
      font-size: 0.75rem;
      font-weight: 650;
      text-decoration: none;
    }

    .map-link:hover {
      background: #273f55;
    }
  `,
})
export class LocationMapComponent {
  @Input() location: MapCoordinates | null | undefined;
  @Input() title = 'Map location';
  @Input() compact = false;

  constructor(private readonly sanitizer: DomSanitizer) {}

  isValidLocation(): boolean {
    const location = this.location;
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

  mapEmbedUrl(): SafeResourceUrl | null {
    if (!this.isValidLocation() || !this.location) {
      return null;
    }

    const { latitude, longitude } = this.location;
    const offset = 0.01;
    const bounds = [
      Math.max(-180, longitude - offset),
      Math.max(-90, latitude - offset),
      Math.min(180, longitude + offset),
      Math.min(90, latitude + offset),
    ].join(',');
    const url =
      `https://www.openstreetmap.org/export/embed.html?bbox=${bounds}` +
      `&layer=mapnik&marker=${latitude},${longitude}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  googleMapsUrl(): string | null {
    if (!this.isValidLocation() || !this.location) {
      return null;
    }

    return `https://www.google.com/maps/search/?api=1&query=${this.location.latitude},${this.location.longitude}`;
  }
}
