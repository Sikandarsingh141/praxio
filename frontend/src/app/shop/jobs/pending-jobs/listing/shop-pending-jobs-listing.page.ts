import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShopJobsListingPageBase } from '../../../../shared/components/job-page-base';
import { JobCardComponent } from '../../../../shared/components/job-card/job-card.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { JobFiltersComponent } from '../../../../shared/components/job-filters/job-filters.component';
import { JobPaginationComponent } from '../../../../shared/components/job-pagination/job-pagination.component';

@Component({
  selector: 'app-shop-pending-jobs-listing-page',
  standalone: true,
  imports: [CommonModule, RouterLink, JobCardComponent, EmptyStateComponent, JobFiltersComponent, JobPaginationComponent],
  templateUrl: './shop-pending-jobs-listing.page.html',
  styleUrl: './shop-pending-jobs-listing.page.scss',
})
export class ShopPendingJobsListingPage extends ShopJobsListingPageBase {
  protected override readonly category = 'pending' as const;
  readonly title = 'Pending Jobs';
  readonly description = 'Track requests waiting for a response or decision.';
  readonly detailRoute = '/shop/jobs/pending-jobs';
}

