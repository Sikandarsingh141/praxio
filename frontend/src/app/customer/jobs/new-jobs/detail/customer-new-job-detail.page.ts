import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerJobDetailPageBase } from '../../../../shared/components/job-page-base';
import { JobStatusBadgeComponent } from '../../../../shared/components/job-status-badge/job-status-badge.component';
import { JobAttachmentsComponent } from '../../../../shared/components/job-attachments/job-attachments.component';
import { JobTimelineComponent } from '../../../../shared/components/job-timeline/job-timeline.component';
import { CustomerRepairWorkflowComponent } from '../../../repair-requests/components/customer-repair-workflow.component';

@Component({
  selector: 'app-customer-new-job-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, JobStatusBadgeComponent, JobAttachmentsComponent, JobTimelineComponent, CustomerRepairWorkflowComponent],
  templateUrl: './customer-new-job-detail.page.html',
  styleUrl: './customer-new-job-detail.page.scss',
})
export class CustomerNewJobDetailPage extends CustomerJobDetailPageBase {
  readonly backRoute = '/customer/jobs/new-jobs';
  readonly backLabel = 'New Jobs';
  readonly pageTitle = 'New Job Details';
  legacyDetailRoute(id: string): string[] { return ['/customer/repair-requests', id]; }
}

