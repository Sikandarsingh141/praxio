import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { CommonModule } from '@angular/common';
import { Component, Input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { JobListItem } from '../../../shared/models/job.models';
import { profileImageSource } from '../../../shared/utils/appliance-thumbnail.util';
import { TableScrollIndicatorsDirective } from '../../../shared/directives/table-scroll-indicators.directive';

@Component({
  selector: 'app-shop-jobs-table',
  standalone: true,
  imports: [CommonModule, OverlayModule, RouterLink, TableScrollIndicatorsDirective],
  templateUrl: './shop-jobs-table.component.html',
  styleUrl: './shop-jobs-table.component.scss',
})
export class ShopJobsTableComponent {
  @Input({ required: true }) jobs: JobListItem[] = [];
  @Input({ required: true }) detailRoute = '';
  @Input() title = 'Shop requests';
  @Input() showQuotationStatus = false;
  @Input() showAssignmentDetails = false;
  @Input() dateLabel = 'Request Date';
  @Input() showAssignedDate = false;

  private readonly unavailableImages = new Set<string>();
  private readonly unavailableCustomerImages = new Set<string>();
  readonly openActionsJobId = signal<string | null>(null);
  readonly actionMenuPositions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
  ];

  toggleActions(jobId: string): void {
    this.openActionsJobId.update((current) => (current === jobId ? null : jobId));
  }

  closeActions(): void {
    this.openActionsJobId.set(null);
  }

  formatStatus(status: string): string {
    if (status === 'customer_accepted') return 'Confirmed by customer';
    return status
      .replace(/_/g, ' ')
      .replace(/^\w/, (firstLetter) => firstLetter.toUpperCase());
  }

  jobDate(job: JobListItem): string {
    return this.showAssignedDate && job.assignedAt ? job.assignedAt : job.createdAt;
  }

  customerInitials(name?: string): string {
    const initials = (name ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toLocaleUpperCase())
      .join('');
    return initials || 'CU';
  }

  customerPhotoSource(job: JobListItem): string | null {
    if (this.unavailableCustomerImages.has(job.id)) return null;
    return profileImageSource(job.customerProfileImageUrl);
  }

  markCustomerImageUnavailable(jobId: string): void {
    this.unavailableCustomerImages.add(jobId);
  }

  assigneeInitials(name?: string): string {
    const initials = (name ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toLocaleUpperCase())
      .join('');
    return initials || 'T';
  }

  imageSource(job: JobListItem): string | null {
    const data = job.imageData?.trim();
    if (!data) return null;
    if (
      data.startsWith('data:') ||
      /^https?:\/\//i.test(data) ||
      data.startsWith('/') ||
      data.startsWith('blob:')
    ) {
      return data;
    }
    return `data:${job.imageMimeType || 'image/jpeg'};base64,${data}`;
  }

  imageUnavailable(jobId: string): boolean {
    return this.unavailableImages.has(jobId);
  }

  markImageUnavailable(jobId: string): void {
    this.unavailableImages.add(jobId);
  }
}
