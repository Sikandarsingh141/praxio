import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShopJobsListingPageBase } from '../../../../shared/components/job-page-base';
import { AdminPageHeaderComponent } from '../../../../shared/components/page-header/admin-page-header.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { CommonFilterComponent } from '../../../../shared/components/filters/common-filter.component';
import { JobPaginationComponent } from '../../../../shared/components/job-pagination/job-pagination.component';
import { JobListItem } from '../../../../shared/models/job.models';
import { ShopJobsTableComponent } from '../../components/shop-jobs-table.component';

@Component({
  selector: 'app-shop-assigned-jobs-listing-page',
  standalone: true,
  imports: [CommonModule, RouterLink, AdminPageHeaderComponent, CommonFilterComponent, ShopJobsTableComponent, EmptyStateComponent, JobPaginationComponent],
  templateUrl: './shop-assigned-jobs-listing.page.html',
  styleUrl: './shop-assigned-jobs-listing.page.scss',
})
export class ShopAssignedJobsListingPage extends ShopJobsListingPageBase {
  protected override readonly category = 'assigned' as const;
  readonly title = 'Assigned Jobs';
  readonly description = 'Repair requests assigned to a technician or to you. Track progress and manage assignments.';
  readonly detailRoute = '/shop/jobs/assigned-jobs';
  readonly assigneeFilter = signal('');
  readonly deviceFilter = signal('');
  readonly assignedToMeCount = computed(
    () => this.items().filter((item) => item.assignedToOwner).length,
  );
  readonly assignedToTechniciansCount = computed(
    () => this.items().filter((item) => !item.assignedToOwner && !!item.assignedToId).length,
  );
  readonly assigneeOptions = computed(() => {
    const options = new Map<string, string>();
    for (const item of this.items()) {
      if (!item.assignedToId) continue;
      options.set(
        item.assignedToId,
        item.assignedToOwner ? 'You (Shop Owner)' : item.assignedToName || 'Technician',
      );
    }
    return [...options].map(([value, label]) => ({ value, label }));
  });
  readonly deviceOptions = computed(() => [...new Set(this.items().map((item) => item.title))].sort());

  protected override matchesPageFilters(item: JobListItem): boolean {
    if (!super.matchesPageFilters(item)) return false;
    const assignee = this.assigneeFilter();
    const device = this.deviceFilter();
    return (!assignee || item.assignedToId === assignee) && (!device || item.title === device);
  }

  setAssigneeFilter(value: string): void {
    this.assigneeFilter.set(value);
    this.page.set(1);
  }

  setDeviceFilter(value: string): void {
    this.deviceFilter.set(value);
    this.page.set(1);
  }
}

