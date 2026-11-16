import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ShopJobsListingPageBase } from '../../../../shared/components/job-page-base';
import { AdminPageHeaderComponent } from '../../../../shared/components/page-header/admin-page-header.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { CommonFilterComponent } from '../../../../shared/components/filters/common-filter.component';
import { JobPaginationComponent } from '../../../../shared/components/job-pagination/job-pagination.component';
import { ShopJobsTableComponent } from '../../components/shop-jobs-table.component';

@Component({
  selector: 'app-shop-completed-jobs-listing-page',
  standalone: true,
  imports: [CommonModule, AdminPageHeaderComponent, CommonFilterComponent, ShopJobsTableComponent, EmptyStateComponent, JobPaginationComponent],
  templateUrl: './shop-completed-jobs-listing.page.html',
  styleUrl: './shop-completed-jobs-listing.page.scss',
})
export class ShopCompletedJobsListingPage extends ShopJobsListingPageBase {
  protected override readonly category = 'completed' as const;
  readonly title = 'Completed Jobs';
  readonly description = 'Review finished repair jobs and their history.';
  readonly detailRoute = '/shop/jobs/completed-jobs';
}

