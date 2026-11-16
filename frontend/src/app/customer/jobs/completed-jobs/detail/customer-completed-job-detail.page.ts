import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerJobDetailPageBase } from '../../../../shared/components/job-page-base';
import { JobStatusBadgeComponent } from '../../../../shared/components/job-status-badge/job-status-badge.component';
import { JobAttachmentsComponent } from '../../../../shared/components/job-attachments/job-attachments.component';
import { JobTimelineComponent } from '../../../../shared/components/job-timeline/job-timeline.component';


@Component({
  selector: 'app-customer-completed-job-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, JobStatusBadgeComponent, JobAttachmentsComponent, JobTimelineComponent],
  templateUrl: './customer-completed-job-detail.page.html',
  styleUrl: './customer-completed-job-detail.page.scss',
})
export class CustomerCompletedJobDetailPage extends CustomerJobDetailPageBase {
  readonly backRoute = '/customer/jobs/completed-jobs';
  readonly backLabel = 'Completed Jobs';
  readonly pageTitle = 'Completed Job Details';
  legacyDetailRoute(id: string): string[] { return ['/customer/repair-requests', id]; }
}

