import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShopJobsListingPageBase } from '../../../../shared/components/job-page-base';
import { JobCardComponent } from '../../../../shared/components/job-card/job-card.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { JobFiltersComponent } from '../../../../shared/components/job-filters/job-filters.component';
import { JobPaginationComponent } from '../../../../shared/components/job-pagination/job-pagination.component';

@Component({
  selector: 'app-shop-assigned-jobs-listing-page',
  standalone: true,
  imports: [CommonModule, RouterLink, JobCardComponent, EmptyStateComponent, JobFiltersComponent, JobPaginationComponent],
  templateUrl: './shop-assigned-jobs-listing.page.html',
  styleUrl: './shop-assigned-jobs-listing.page.scss',
})
export class ShopAssignedJobsListingPage extends ShopJobsListingPageBase {
  protected override readonly category = 'assigned' as const;
  readonly title = 'Assigned Jobs';
  readonly description = 'View repair work that has been assigned.';
  readonly detailRoute = '/shop/jobs/assigned-jobs';
}

