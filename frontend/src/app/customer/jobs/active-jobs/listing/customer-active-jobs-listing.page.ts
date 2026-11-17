import { CommonModule } from '@angular/common';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminPageHeaderComponent } from '../../../../shared/components/page-header/admin-page-header.component';
import { CustomerJobsListingPageBase } from '../../../../shared/components/job-page-base';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { JobPaginationComponent } from '../../../../shared/components/job-pagination/job-pagination.component';
import {
  CommonFilterComponent,
  FilterConfig,
  FilterValues,
} from '../../../../shared/components/filters/common-filter.component';
import { JobListItem } from '../../../../shared/models/job.models';

@Component({
  selector: 'app-customer-active-jobs-listing-page',
  standalone: true,
  imports: [
    AdminPageHeaderComponent,
    CommonModule,
    OverlayModule,
    RouterLink,
    EmptyStateComponent,
    JobPaginationComponent,
    CommonFilterComponent,
  ],
  templateUrl: './customer-active-jobs-listing.page.html',
  styleUrl: './customer-active-jobs-listing.page.scss',
})
export class CustomerActiveJobsListingPage extends CustomerJobsListingPageBase {
  protected override readonly category = 'active' as const;
  readonly title = 'Active Repairs';
  readonly description = 'Follow repairs currently in progress.';
  readonly detailRoute = '/customer/jobs/active-jobs';
  readonly appliedFilters = signal<FilterValues>({});
  readonly failedImages = signal<Set<string>>(new Set<string>());
  readonly openActionsJobId = signal<string | null>(null);
  readonly actionMenuPositions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
  ];

  readonly filterConfig: FilterConfig = {
    title: 'Active repair filters',
    fields: [
      { key: 'appliance', label: 'Appliance or device', type: 'text' },
      { key: 'brand', label: 'Brand', type: 'text' },
      {
        key: 'serviceType',
        label: 'Service type',
        type: 'select',
        placeholder: 'Any service type',
        options: [
          { label: 'Shop visit', value: 'shop_visit' },
          { label: 'Home service', value: 'home_service' },
        ],
      },
      { key: 'requestDate', label: 'Request date', type: 'date-range' },
    ],
  };

  toggleActions(jobId: string): void {
    this.openActionsJobId.update((current) => (current === jobId ? null : jobId));
  }

  closeActions(): void {
    this.openActionsJobId.set(null);
  }

  hasValidImage(job: JobListItem): boolean {
    if (!job.imageData || typeof job.imageData !== 'string') return false;
    if (this.failedImages().has(job.id)) return false;
    return job.imageData.trim().length > 20;
  }

  getDeviceImageSrc(job: JobListItem): string {
    const data = job.imageData?.trim() || '';
    if (
      data.startsWith('data:') ||
      data.startsWith('http://') ||
      data.startsWith('https://') ||
      data.startsWith('/')
    ) {
      return data;
    }
    return `data:${job.imageMimeType || 'image/jpeg'};base64,${data}`;
  }

  onImageError(jobId: string): void {
    const updated = new Set(this.failedImages());
    updated.add(jobId);
    this.failedImages.set(updated);
  }

  formatBrandModel(job: JobListItem): string {
    const brand = job.brand?.trim() || '';
    const model = job.model?.trim() || '';
    if (brand && model) return `${brand} - ${model}`;
    if (brand) return brand;
    if (model) return model;
    return 'Brand not specified';
  }

  formatStatus(status: string): string {
    return status
      .replace(/_/g, ' ')
      .replace(/^\w/, (firstLetter) => firstLetter.toUpperCase());
  }

  applyFilters(filters: FilterValues): void {
    this.appliedFilters.set(filters);
    this.page.set(1);
  }

  protected override matchesPageFilters(item: JobListItem): boolean {
    const filters = this.appliedFilters();
    const appliance = filters['appliance'];
    const brand = filters['brand'];
    const serviceType = filters['serviceType'];
    if (
      typeof appliance === 'string' &&
      appliance.trim() &&
      !item.title.toLocaleLowerCase().includes(appliance.trim().toLocaleLowerCase())
    ) {
      return false;
    }
    if (
      typeof brand === 'string' &&
      brand.trim() &&
      !(item.brand ?? '').toLocaleLowerCase().includes(brand.trim().toLocaleLowerCase())
    ) {
      return false;
    }
    if (typeof serviceType === 'string' && serviceType && item.serviceType !== serviceType) {
      return false;
    }

    const requestDate = filters['requestDate'];
    if (requestDate && typeof requestDate === 'object' && 'from' in requestDate) {
      const requestDay = item.createdAt.slice(0, 10);
      if (
        (requestDate.from && requestDay < requestDate.from) ||
        (requestDate.to && requestDay > requestDate.to)
      ) {
        return false;
      }
    }
    return true;
  }
}
