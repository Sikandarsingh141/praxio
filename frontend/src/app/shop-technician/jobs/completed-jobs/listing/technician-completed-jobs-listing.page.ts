import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { TechnicianJobsListingPageBase } from '../../../../shared/components/job-page-base';
import { AdminPageHeaderComponent } from '../../../../shared/components/page-header/admin-page-header.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { CommonFilterComponent } from '../../../../shared/components/filters/common-filter.component';
import { JobPaginationComponent } from '../../../../shared/components/job-pagination/job-pagination.component';
import { ShopJobsTableComponent } from '../../../../shop/jobs/components/shop-jobs-table.component';

@Component({
  selector: 'app-technician-completed-jobs-listing-page',
  standalone: true,
  imports: [CommonModule, AdminPageHeaderComponent, CommonFilterComponent, ShopJobsTableComponent, EmptyStateComponent, JobPaginationComponent],
  templateUrl: './technician-completed-jobs-listing.page.html',
  styleUrl: './technician-completed-jobs-listing.page.scss',
})
export class TechnicianCompletedJobsListingPage extends TechnicianJobsListingPageBase {
  protected override readonly category = 'completed' as const;
  readonly title = 'Completed Repairs';
  readonly description = 'Review finished repairs, their outcomes, and job history.';
  readonly detailRoute = '/technician/completed-jobs';
}

