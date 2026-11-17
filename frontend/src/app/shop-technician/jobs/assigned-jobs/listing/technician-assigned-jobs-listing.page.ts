import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { TechnicianJobsListingPageBase } from '../../../../shared/components/job-page-base';
import { AdminPageHeaderComponent } from '../../../../shared/components/page-header/admin-page-header.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import {
  CommonFilterComponent,
  FilterConfig,
  FilterValues,
} from '../../../../shared/components/filters/common-filter.component';
import { JobPaginationComponent } from '../../../../shared/components/job-pagination/job-pagination.component';
import { JobListItem } from '../../../../shared/models/job.models';
import { ShopJobsTableComponent } from '../../../../shop/jobs/components/shop-jobs-table.component';

@Component({
  selector: 'app-technician-assigned-jobs-listing-page',
  standalone: true,
  imports: [CommonModule, AdminPageHeaderComponent, CommonFilterComponent, ShopJobsTableComponent, EmptyStateComponent, JobPaginationComponent],
  templateUrl: './technician-assigned-jobs-listing.page.html',
  styleUrl: './technician-assigned-jobs-listing.page.scss',
})
export class TechnicianAssignedJobsListingPage extends TechnicianJobsListingPageBase {
  protected override readonly category = 'assigned' as const;
  readonly title = 'Assigned Requests';
  readonly description = 'Repair requests assigned to you. Review the details and continue the repair workflow.';
  readonly detailRoute = '/technician/assigned-jobs';
  readonly deviceFilter = signal('');
  readonly deviceOptions = computed(() => [...new Set(this.items().map((item) => item.title))].sort());
  readonly awaitingInspectionCount = computed(
    () => this.items().filter((item) => ['confirmed', 'inspection_pending'].includes(item.status)).length,
  );
  readonly readyToRepairCount = computed(
    () => this.items().filter((item) => item.status === 'inspection_approved').length,
  );
  readonly hasActiveFilters = computed(
    () => Boolean(this.search() || this.deviceFilter() || Object.values(this.appliedFilters()).some((value) => {
      if (typeof value === 'string') return Boolean(value);
      if (value && typeof value === 'object') return Object.values(value).some(Boolean);
      return false;
    })),
  );

  override get filterConfig(): FilterConfig {
    const config = super.filterConfig;
    return {
      ...config,
      fields: [
        ...config.fields,
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
  }

  protected override matchesPageFilters(item: JobListItem): boolean {
    if (!super.matchesPageFilters(item)) return false;
    if (this.deviceFilter() && item.title !== this.deviceFilter()) return false;

    const filters: FilterValues = this.appliedFilters();
    const serviceType = filters['serviceType'];
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

  setDeviceFilter(value: string): void {
    this.deviceFilter.set(value);
    this.page.set(1);
  }
}

