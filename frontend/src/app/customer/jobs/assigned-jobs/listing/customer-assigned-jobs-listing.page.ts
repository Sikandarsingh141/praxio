import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerJobsListingPageBase } from '../../../../shared/components/job-page-base';
import { JobCardComponent } from '../../../../shared/components/job-card/job-card.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { JobFiltersComponent } from '../../../../shared/components/job-filters/job-filters.component';
import { JobPaginationComponent } from '../../../../shared/components/job-pagination/job-pagination.component';

@Component({
  selector: 'app-customer-assigned-jobs-listing-page',
  standalone: true,
  imports: [CommonModule, RouterLink, JobCardComponent, EmptyStateComponent, JobFiltersComponent, JobPaginationComponent],
  templateUrl: './customer-assigned-jobs-listing.page.html',
  styleUrl: './customer-assigned-jobs-listing.page.scss',
})
export class CustomerAssignedJobsListingPage extends CustomerJobsListingPageBase {
  protected override readonly category = 'assigned' as const;
  readonly title = 'Assigned Jobs';
  readonly description = 'View repair work that has been assigned.';
  readonly detailRoute = '/customer/jobs/assigned-jobs';
}

