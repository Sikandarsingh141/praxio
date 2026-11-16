import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { JobDetailPageBase } from '../../../../shared/components/job-page-base';
import { JobStatusBadgeComponent } from '../../../../shared/components/job-status-badge/job-status-badge.component';
import { JobAttachmentsComponent } from '../../../../shared/components/job-attachments/job-attachments.component';
import { JobTimelineComponent } from '../../../../shared/components/job-timeline/job-timeline.component';
import { JobTimelineEntry, JobAttachment } from '../../../../shared/models/job.models';
import { RepairDispute } from '../../../../shared/models/disputes.models';
import { DisputesService } from '../../../../shared/services/disputes.service';

@Component({
  selector: 'app-customer-disputed-job-detail-page',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, JobStatusBadgeComponent, JobAttachmentsComponent, JobTimelineComponent],
  templateUrl: './customer-disputed-job-detail.page.html',
  styleUrl: './customer-disputed-job-detail.page.scss',
})
export class CustomerDisputedJobDetailPage extends JobDetailPageBase<RepairDispute> {
  private readonly disputes = inject(DisputesService);
  readonly backRoute = '/customer/jobs/disputed-jobs';
  readonly backLabel = 'Disputed Jobs';
  readonly pageTitle = 'Disputed Job Details';
  readonly disputeRoute = '/customer/disputes';

  protected override loadRecord(id: string) { return this.disputes.get('customer', id); }
  timeline(dispute: RepairDispute): JobTimelineEntry[] {
    return dispute.statusHistory.map((event) => ({ title: event.to.replace(/_/g, ' '), description: event.reason, at: event.at }));
  }
  attachments(dispute: RepairDispute): JobAttachment[] {
    return dispute.attachments.map((file) => ({ name: file.name, mimeType: file.mimeType, data: file.data }));
  }
}

