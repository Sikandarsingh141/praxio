import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ShopJobsListingPageBase } from '../../../../shared/components/job-page-base';
import { AdminPageHeaderComponent } from '../../../../shared/components/page-header/admin-page-header.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { CommonFilterComponent } from '../../../../shared/components/filters/common-filter.component';
import { JobPaginationComponent } from '../../../../shared/components/job-pagination/job-pagination.component';
import { ShopJobsTableComponent } from '../../components/shop-jobs-table.component';

@Component({
  selector: 'app-shop-active-jobs-listing-page',
  standalone: true,
  imports: [CommonModule, AdminPageHeaderComponent, CommonFilterComponent, ShopJobsTableComponent, EmptyStateComponent, JobPaginationComponent],
  templateUrl: './shop-active-jobs-listing.page.html',
  styleUrl: './shop-active-jobs-listing.page.scss',
})
export class ShopActiveJobsListingPage extends ShopJobsListingPageBase {
  protected override readonly category = 'active' as const;
  readonly title = 'Active Jobs';
  readonly description = 'Follow repairs currently in progress.';
  readonly detailRoute = '/shop/jobs/active-jobs';
}

