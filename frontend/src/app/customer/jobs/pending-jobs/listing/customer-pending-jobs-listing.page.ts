import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerJobsListingPageBase } from '../../../../shared/components/job-page-base';
import { JobCardComponent } from '../../../../shared/components/job-card/job-card.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { JobFiltersComponent } from '../../../../shared/components/job-filters/job-filters.component';
import { JobPaginationComponent } from '../../../../shared/components/job-pagination/job-pagination.component';

@Component({
  selector: 'app-customer-pending-jobs-listing-page',
  standalone: true,
  imports: [CommonModule, RouterLink, JobCardComponent, EmptyStateComponent, JobFiltersComponent, JobPaginationComponent],
  templateUrl: './customer-pending-jobs-listing.page.html',
  styleUrl: './customer-pending-jobs-listing.page.scss',
})
export class CustomerPendingJobsListingPage extends CustomerJobsListingPageBase {
  protected override readonly category = 'pending' as const;
  readonly title = 'Pending Jobs';
  readonly description = 'Track requests waiting for a response or decision.';
  readonly detailRoute = '/customer/jobs/pending-jobs';
}

