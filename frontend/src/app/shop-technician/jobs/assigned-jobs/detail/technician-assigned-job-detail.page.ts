import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TechnicianJobDetailPageBase } from '../../../../shared/components/job-page-base';
import { JobStatusBadgeComponent } from '../../../../shared/components/job-status-badge/job-status-badge.component';
import { JobAttachmentsComponent } from '../../../../shared/components/job-attachments/job-attachments.component';
import { JobTimelineComponent } from '../../../../shared/components/job-timeline/job-timeline.component';


@Component({
  selector: 'app-technician-assigned-job-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, JobStatusBadgeComponent, JobAttachmentsComponent, JobTimelineComponent],
  templateUrl: './technician-assigned-job-detail.page.html',
  styleUrl: './technician-assigned-job-detail.page.scss',
})
export class TechnicianAssignedJobDetailPage extends TechnicianJobDetailPageBase {
  readonly backRoute = '/technician/assigned-jobs';
  readonly backLabel = 'Assigned Jobs';
  readonly pageTitle = 'Assigned Job Details';
  legacyDetailRoute(id: string): string[] { return ['/technician/jobs', id]; }
}

