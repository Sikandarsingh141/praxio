import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerJobsListingPageBase } from '../../../../shared/components/job-page-base';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { JobPaginationComponent } from '../../../../shared/components/job-pagination/job-pagination.component';
import {
  CommonFilterComponent,
  FilterConfig,
  FilterValues,
} from '../../../../shared/components/filters/common-filter.component';
import { JobStatusBadgeComponent } from '../../../../shared/components/job-status-badge/job-status-badge.component';
import { JobListItem } from '../../../../shared/models/job.models';

@Component({
  selector: 'app-customer-new-jobs-listing-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    EmptyStateComponent,
    JobPaginationComponent,
    CommonFilterComponent,
    JobStatusBadgeComponent,
  ],
  templateUrl: './customer-new-jobs-listing.page.html',
  styleUrl: './customer-new-jobs-listing.page.scss',
})
export class CustomerNewJobsListingPage extends CustomerJobsListingPageBase {
  protected override readonly category = 'new' as const;
  readonly title = 'New Jobs';
  readonly description = 'Review newly submitted repair requests.';
  readonly detailRoute = '/customer/jobs/new-jobs';
  readonly appliedFilters = signal<FilterValues>({});
  readonly filterConfig: FilterConfig = {
    title: 'New job filters',
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

