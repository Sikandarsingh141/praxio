import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerJobDetailPageBase } from '../../../../shared/components/job-page-base';
import { JobStatusBadgeComponent } from '../../../../shared/components/job-status-badge/job-status-badge.component';
import { JobAttachmentsComponent } from '../../../../shared/components/job-attachments/job-attachments.component';
import { JobTimelineComponent } from '../../../../shared/components/job-timeline/job-timeline.component';
import { CustomerRepairWorkflowComponent } from '../../../repair-requests/components/customer-repair-workflow.component';

@Component({
  selector: 'app-customer-active-job-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, JobStatusBadgeComponent, JobAttachmentsComponent, JobTimelineComponent, CustomerRepairWorkflowComponent],
  templateUrl: './customer-active-job-detail.page.html',
  styleUrl: './customer-active-job-detail.page.scss',
})
export class CustomerActiveJobDetailPage extends CustomerJobDetailPageBase {
  readonly backRoute = '/customer/jobs/active-jobs';
  readonly backLabel = 'Active Jobs';
  readonly pageTitle = 'Active Job Details';
  legacyDetailRoute(id: string): string[] { return ['/customer/repair-requests', id]; }
}

