import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerJobsListingPageBase } from '../../../../shared/components/job-page-base';
import { JobCardComponent } from '../../../../shared/components/job-card/job-card.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { JobFiltersComponent } from '../../../../shared/components/job-filters/job-filters.component';
import { JobPaginationComponent } from '../../../../shared/components/job-pagination/job-pagination.component';

@Component({
  selector: 'app-customer-disputed-jobs-listing-page',
  standalone: true,
  imports: [CommonModule, RouterLink, JobCardComponent, EmptyStateComponent, JobFiltersComponent, JobPaginationComponent],
  templateUrl: './customer-disputed-jobs-listing.page.html',
  styleUrl: './customer-disputed-jobs-listing.page.scss',
})
export class CustomerDisputedJobsListingPage extends CustomerJobsListingPageBase {
  protected override readonly category = 'disputed' as const;
  readonly title = 'Disputed Jobs';
  readonly description = 'Review repair jobs with an open dispute.';
  readonly detailRoute = '/customer/jobs/disputed-jobs';
}

