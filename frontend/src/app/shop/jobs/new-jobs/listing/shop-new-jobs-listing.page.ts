import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ShopJobsListingPageBase } from '../../../../shared/components/job-page-base';
import { AdminPageHeaderComponent } from '../../../../shared/components/page-header/admin-page-header.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { JobPaginationComponent } from '../../../../shared/components/job-pagination/job-pagination.component';
import { CommonFilterComponent } from '../../../../shared/components/filters/common-filter.component';
import { ShopJobsTableComponent } from '../../components/shop-jobs-table.component';

@Component({
  selector: 'app-shop-new-jobs-listing-page',
  standalone: true,
  imports: [
    CommonModule,
    AdminPageHeaderComponent,
    EmptyStateComponent,
    JobPaginationComponent,
    CommonFilterComponent,
    ShopJobsTableComponent,
  ],
  templateUrl: './shop-new-jobs-listing.page.html',
  styleUrl: './shop-new-jobs-listing.page.scss',
})
export class ShopNewJobsListingPage extends ShopJobsListingPageBase {
  protected override readonly category = 'new' as const;
  readonly title = 'New Jobs';
  readonly description = 'Review newly submitted repair requests.';
  readonly detailRoute = '/shop/jobs/new-jobs';
}

