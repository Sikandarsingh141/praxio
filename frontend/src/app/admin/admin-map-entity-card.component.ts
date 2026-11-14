import { DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AdminMapEntity } from './admin.service';

@Component({
  selector: 'app-admin-map-entity-card',
  standalone: true,
  imports: [DatePipe],
  template: `
    <button
      [class.selected]="selected"
      [class]="'result-card ' + markerColor"
      [attr.data-request-id]="entity.id"
      type="button"
      (click)="select.emit()"
    >
      @if (entity.type === 'request') {
        <span class="result-marker" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path
              d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0L21 6.1a6 6 0 0 1-7.9 7.9l-7.9 7.9a2 2 0 0 1-2.8-2.8l7.9-7.9a6 6 0 0 1 7.9-7.9z"
            />
          </svg>
        </span>
      } @else {
        <span class="result-avatar" aria-hidden="true">
          @if (avatarUrl) {
            <img [src]="avatarUrl" alt="" />
          } @else {
            <span>{{ initials }}</span>
          }
        </span>
      }

      <span class="result-copy">
        <span class="result-heading">
          <span class="result-title">
            {{ entity.type === 'request' ? entity.appliance || 'Repair request' : entity.name }}
          </span>
          @if (entity.type === 'request') {
            <span class="result-status" [attr.data-status]="markerColor">
              <span aria-hidden="true">{{ statusIcon }}</span>
              {{ statusLabel }}
            </span>
          } @else if (entity.type === 'shop') {
            <span class="result-verification" [attr.data-status]="entity.approvalStatus">
              {{ approvalLabel }}
            </span>
          }
        </span>

        @if (entity.type === 'request') {
          <span class="result-subtitle">
            <span
              >Request ID:
              <strong class="request-reference">{{ requestId }}</strong>
              · {{ entity.customerName }}</span
            >
          </span>
          <span class="result-route" aria-label="Customer to shop location">
            <span
              class="route-endpoint customer-endpoint"
              [attr.aria-label]="'Customer location: ' + customerLocationLabel"
              [attr.title]="'Customer: ' + customerLocationLabel"
            >
              <svg class="route-pin" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 22s8-4.9 8-12A8 8 0 1 0 4 10c0 7.1 8 12 8 12Z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              <span>{{ customerLocationLabel }}</span>
            </span>
            <span class="route-direction" aria-hidden="true">→</span>
            <span
              class="route-endpoint shop-endpoint"
              [attr.aria-label]="'Shop location: ' + shopLocationLabel"
              [attr.title]="'Shop: ' + shopLocationLabel"
            >
              <svg class="route-pin" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 22s8-4.9 8-12A8 8 0 1 0 4 10c0 7.1 8 12 8 12Z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              <span>{{ shopLocationLabel }}</span>
            </span>
          </span>
          <span class="result-meta">
            <span class="result-chip">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3.5 11 12 4l8.5 7v8a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" />
                <path d="M9 20v-6h6v6" />
              </svg>
              {{ serviceTypeLabel }}
            </span>
            <span class="result-chip">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3.5" y="5" width="17" height="16" rx="2" />
                <path d="M7.5 3v4m9-4v4M3.5 10h17" />
              </svg>
              {{ entity.createdAt | date: 'mediumDate' }}
            </span>
          </span>
        } @else if (entity.type === 'customer') {
          <span class="result-subtitle">{{ entity.email }}</span>
          <span class="result-subtitle">{{ entity.phone }}</span>
          <span class="result-meta">
            <span class="result-chip">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 19V5m0 0h9l-1.5 3L13 11H4" />
                <path d="M8 19v-4h5v4" />
              </svg>
              Requests {{ entity.repairCounts?.total ?? 0 }}
            </span>
            <span class="result-chip result-location" [attr.title]="locationLabel">
              {{ locationLabel }}
            </span>
          </span>
        } @else {
          <span class="result-subtitle result-location" [attr.title]="locationLabel">
            {{ locationLabel }}
          </span>
          <span class="result-meta">
            <span class="result-rating" [class.muted]="entity.rating == null">
              <span aria-hidden="true">★</span>
              {{ ratingText }}
            </span>
            <span class="result-chip" [attr.title]="servicesTitle">
              {{ servicesSummary }}
            </span>
            <span class="result-chip">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 19V5m0 0h9l-1.5 3L13 11H4" />
                <path d="M8 19v-4h5v4" />
              </svg>
              Requests {{ entity.repairCounts?.total ?? 0 }}
            </span>
          </span>
        }
      </span>
      <span class="result-arrow" aria-hidden="true">›</span>
    </button>
  `,
})
export class AdminMapEntityCardComponent {
  @Input({ required: true }) entity!: AdminMapEntity;
  @Input() selected = false;
  @Input() markerColor = '';
  @Input() requestId = '';
  @Input() statusLabel = '';
  @Input() statusIcon = '';
  @Input() serviceTypeLabel = '';
  @Input() customerLocationLabel = '';
  @Input() shopLocationLabel = '';
  @Input() locationLabel = '';
  @Output() select = new EventEmitter<void>();

  get avatarUrl(): string {
    return this.entity.type === 'shop'
      ? (this.entity.shopImageUrl ?? this.entity.profileImageUrl ?? '')
      : (this.entity.profileImageUrl ?? '');
  }

  get initials(): string {
    const parts = this.entity.name.split(/\s+/).filter(Boolean);
    return (
      parts
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || '?'
    );
  }

  get approvalLabel(): string {
    const status = this.entity.approvalStatus ?? this.entity.status;
    return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  get ratingText(): string {
    if (this.entity.rating == null) return 'No reviews';
    return `${this.entity.rating.toFixed(1)} (${this.entity.reviewCount ?? 0})`;
  }

  get servicesTitle(): string {
    return (this.entity.services ?? []).filter(Boolean).join(', ');
  }

  get servicesSummary(): string {
    const services = (this.entity.services ?? []).filter(Boolean);
    if (!services.length) return 'No services listed';
    const visible = services.slice(0, 2).join(', ');
    return services.length > 2 ? `${visible} +${services.length - 2}` : visible;
  }
}
