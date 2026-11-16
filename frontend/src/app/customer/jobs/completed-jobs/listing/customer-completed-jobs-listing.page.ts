import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerJobsListingPageBase } from '../../../../shared/components/job-page-base';
import { JobCardComponent } from '../../../../shared/components/job-card/job-card.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { JobFiltersComponent } from '../../../../shared/components/job-filters/job-filters.component';
import { JobPaginationComponent } from '../../../../shared/components/job-pagination/job-pagination.component';

@Component({
  selector: 'app-customer-completed-jobs-listing-page',
  standalone: true,
  imports: [CommonModule, RouterLink, JobCardComponent, EmptyStateComponent, JobFiltersComponent, JobPaginationComponent],
  templateUrl: './customer-completed-jobs-listing.page.html',
  styleUrl: './customer-completed-jobs-listing.page.scss',
})
export class CustomerCompletedJobsListingPage extends CustomerJobsListingPageBase {
  protected override readonly category = 'completed' as const;
  readonly title = 'Completed Jobs';
  readonly description = 'Review finished repair jobs and their history.';
  readonly detailRoute = '/customer/jobs/completed-jobs';
}

