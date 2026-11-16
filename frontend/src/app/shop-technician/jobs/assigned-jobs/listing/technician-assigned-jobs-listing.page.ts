import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TechnicianJobsListingPageBase } from '../../../../shared/components/job-page-base';
import { JobCardComponent } from '../../../../shared/components/job-card/job-card.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { JobFiltersComponent } from '../../../../shared/components/job-filters/job-filters.component';
import { JobPaginationComponent } from '../../../../shared/components/job-pagination/job-pagination.component';

@Component({
  selector: 'app-technician-assigned-jobs-listing-page',
  standalone: true,
  imports: [CommonModule, RouterLink, JobCardComponent, EmptyStateComponent, JobFiltersComponent, JobPaginationComponent],
  templateUrl: './technician-assigned-jobs-listing.page.html',
  styleUrl: './technician-assigned-jobs-listing.page.scss',
})
export class TechnicianAssignedJobsListingPage extends TechnicianJobsListingPageBase {
  protected override readonly category = 'assigned' as const;
  readonly title = 'Assigned Jobs';
  readonly description = 'View repair work that has been assigned.';
  readonly detailRoute = '/technician/assigned-jobs';
}

