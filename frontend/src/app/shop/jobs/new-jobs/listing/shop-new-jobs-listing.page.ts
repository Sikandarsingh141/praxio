import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { ShopJobsListingPageBase } from '../../../../shared/components/job-page-base';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { JobPaginationComponent } from '../../../../shared/components/job-pagination/job-pagination.component';
import {
  CommonFilterComponent,
  FilterConfig,
  FilterValues,
} from '../../../../shared/components/filters/common-filter.component';
import { JobListItem } from '../../../../shared/models/job.models';

@Component({
  selector: 'app-shop-new-jobs-listing-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    EmptyStateComponent,
    JobPaginationComponent,
    CommonFilterComponent,
  ],
  templateUrl: './shop-new-jobs-listing.page.html',
  styleUrl: './shop-new-jobs-listing.page.scss',
})
export class ShopNewJobsListingPage extends ShopJobsListingPageBase {
  private readonly auth = inject(AuthService);
  protected override readonly category = 'new' as const;
  readonly title = 'New Jobs';
  readonly description = 'Review newly submitted repair requests.';
  readonly detailRoute = '/shop/jobs/new-jobs';
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
    if (
      typeof serviceType === 'string' &&
      serviceType &&
      item.serviceType !== serviceType
    ) {
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

  customerInitials(name?: string): string {
    const initials = (name ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toLocaleUpperCase())
      .join('');
    return initials || 'CU';
  }

  get shopDisplayName(): string {
    return this.auth.shopName() || 'Your shop';
  }
}

