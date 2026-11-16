import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerJobDetailPageBase } from '../../../../shared/components/job-page-base';
import { JobStatusBadgeComponent } from '../../../../shared/components/job-status-badge/job-status-badge.component';
import { JobAttachmentsComponent } from '../../../../shared/components/job-attachments/job-attachments.component';
import { JobTimelineComponent } from '../../../../shared/components/job-timeline/job-timeline.component';
import { CustomerRepairWorkflowComponent } from '../../../repair-requests/components/customer-repair-workflow.component';

@Component({
  selector: 'app-customer-pending-job-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, JobStatusBadgeComponent, JobAttachmentsComponent, JobTimelineComponent, CustomerRepairWorkflowComponent],
  templateUrl: './customer-pending-job-detail.page.html',
  styleUrl: './customer-pending-job-detail.page.scss',
})
export class CustomerPendingJobDetailPage extends CustomerJobDetailPageBase {
  readonly backRoute = '/customer/jobs/pending-jobs';
  readonly backLabel = 'Pending Jobs';
  readonly pageTitle = 'Pending Job Details';
  legacyDetailRoute(id: string): string[] { return ['/customer/repair-requests', id]; }
}

