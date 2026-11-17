import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { TechnicianJobsListingPageBase } from '../../../../shared/components/job-page-base';
import { AdminPageHeaderComponent } from '../../../../shared/components/page-header/admin-page-header.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { CommonFilterComponent } from '../../../../shared/components/filters/common-filter.component';
import { JobPaginationComponent } from '../../../../shared/components/job-pagination/job-pagination.component';
import { ShopJobsTableComponent } from '../../../../shop/jobs/components/shop-jobs-table.component';

@Component({
  selector: 'app-technician-active-jobs-listing-page',
  standalone: true,
  imports: [CommonModule, AdminPageHeaderComponent, CommonFilterComponent, ShopJobsTableComponent, EmptyStateComponent, JobPaginationComponent],
  templateUrl: './technician-active-jobs-listing.page.html',
  styleUrl: './technician-active-jobs-listing.page.scss',
})
export class TechnicianActiveJobsListingPage extends TechnicianJobsListingPageBase {
  protected override readonly category = 'active' as const;
  readonly title = 'Active Repairs';
  readonly description = 'Follow repair work currently in progress and review its status.';
  readonly detailRoute = '/technician/active-jobs';
}

