import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShopJobsListingPageBase } from '../../../../shared/components/job-page-base';
import { JobCardComponent } from '../../../../shared/components/job-card/job-card.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { JobFiltersComponent } from '../../../../shared/components/job-filters/job-filters.component';
import { JobPaginationComponent } from '../../../../shared/components/job-pagination/job-pagination.component';

@Component({
  selector: 'app-shop-active-jobs-listing-page',
  standalone: true,
  imports: [CommonModule, RouterLink, JobCardComponent, EmptyStateComponent, JobFiltersComponent, JobPaginationComponent],
  templateUrl: './shop-active-jobs-listing.page.html',
  styleUrl: './shop-active-jobs-listing.page.scss',
})
export class ShopActiveJobsListingPage extends ShopJobsListingPageBase {
  protected override readonly category = 'active' as const;
  readonly title = 'Active Jobs';
  readonly description = 'Follow repairs currently in progress.';
  readonly detailRoute = '/shop/jobs/active-jobs';
}

