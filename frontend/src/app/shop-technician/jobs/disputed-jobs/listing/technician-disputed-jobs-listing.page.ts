import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { ShopJobsListingPageBase } from '../../../../shared/components/job-page-base';
import { JobCardComponent } from '../../../../shared/components/job-card/job-card.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { JobFiltersComponent } from '../../../../shared/components/job-filters/job-filters.component';
import { JobPaginationComponent } from '../../../../shared/components/job-pagination/job-pagination.component';
import { JobListItem } from '../../../../shared/models/job.models';

@Component({
  selector: 'app-technician-disputed-jobs-listing-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    JobCardComponent,
    EmptyStateComponent,
    JobFiltersComponent,
    JobPaginationComponent,
  ],
  templateUrl: './technician-disputed-jobs-listing.page.html',
  styleUrl: './technician-disputed-jobs-listing.page.scss',
})
export class TechnicianDisputedJobsListingPage extends ShopJobsListingPageBase {
  protected override readonly category = 'disputed' as const;
  readonly title = 'Disputes';
  readonly description = 'Review repair requests with an open dispute.';
  readonly detailRoute = '/technician/jobs/disputed-jobs';

  protected override loadItems(): Observable<JobListItem[]> {
    return this.jobs.disputedJobs('technician');
  }
}
