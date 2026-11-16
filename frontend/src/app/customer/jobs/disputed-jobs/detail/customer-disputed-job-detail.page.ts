import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { JobDetailPageBase } from '../../../../shared/components/job-page-base';
import { JobAttachmentsComponent } from '../../../../shared/components/job-attachments/job-attachments.component';
import { JobTimelineComponent } from '../../../../shared/components/job-timeline/job-timeline.component';
import { JobTimelineEntry, JobAttachment } from '../../../../shared/models/job.models';
import {
  DisputeAttachment,
  DisputeStatus,
  RepairDispute,
} from '../../../../shared/models/disputes.models';
import { DisputesService } from '../../../../shared/services/disputes.service';

@Component({
  selector: 'app-customer-disputed-job-detail-page',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, JobAttachmentsComponent, JobTimelineComponent],
  templateUrl: './customer-disputed-job-detail.page.html',
  styleUrl: './customer-disputed-job-detail.page.scss',
})
export class CustomerDisputedJobDetailPage extends JobDetailPageBase<RepairDispute> {
  private readonly disputes = inject(DisputesService);
  readonly backRoute = '/customer/jobs/disputed-jobs';
  readonly backLabel = 'Disputed Jobs';
  readonly pageTitle = 'Disputed Job Details';
  readonly progressSteps = [
    'Dispute submitted',
    'Under review',
    'Resolution',
    'Resolved / closed',
  ];
  private readonly reviewStatuses: DisputeStatus[] = [
    'UNDER_REVIEW',
    'ACCEPTED',
    'AWAITING_SHOP_RESPONSE',
    'AWAITING_CUSTOMER_RESPONSE',
    'REINSPECTION_IN_PROGRESS',
  ];
  private readonly resolutionStatuses: DisputeStatus[] = [
    'RESOLUTION_PROPOSED',
    'AWAITING_CUSTOMER_APPROVAL',
    'REPAIR_IN_PROGRESS',
    'CUSTOMER_VERIFICATION_PENDING',
  ];
  private readonly completeStatuses: DisputeStatus[] = [
    'CLOSED',
    'RESOLVED',
    'REJECTED',
    'CUSTOMER_CONFIRMED',
  ];

  protected override loadRecord(id: string) { return this.disputes.get('customer', id); }

  timeline(dispute: RepairDispute): JobTimelineEntry[] {
    return dispute.statusHistory.map((event) => ({
      title: this.formatStatus(event.to),
      description: event.reason,
      at: event.at,
    }));
  }

  attachments(files: DisputeAttachment[]): JobAttachment[] {
    return files.map((file) => ({
      name: file.name,
      mimeType: file.mimeType,
      data: file.data,
    }));
  }

  repairPhotos(dispute: RepairDispute): JobAttachment[] {
    return (dispute.repair?.photos ?? []).map((photo, index) => ({
      name: `${dispute.repair?.appliance || 'Repair'} photo ${index + 1}`,
      mimeType: photo.mimeType,
      data: this.photoSource(photo),
    }));
  }

  photoSource(photo: NonNullable<RepairDispute['repair']>['photos'][number]): string {
    const data = photo.data.trim();
    if (
      data.startsWith('data:') ||
      /^https?:\/\//i.test(data) ||
      data.startsWith('/') ||
      data.startsWith('blob:')
    ) {
      return data;
    }
    return `data:${photo.mimeType || 'image/jpeg'};base64,${data}`;
  }

  customerMessages(dispute: RepairDispute): RepairDispute['messages'] {
    return dispute.messages.filter((message) => !message.internal);
  }

  initials(name?: string, email?: string): string {
    const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
    if (words.length) {
      return words.slice(0, 2).map((word) => word[0].toUpperCase()).join('');
    }
    return email?.trim().charAt(0).toUpperCase() || 'C';
  }

  formatStatus(status: string): string {
    return status
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  currentProgressStep(dispute: RepairDispute): number {
    if (this.isDisputeComplete(dispute)) return 4;
    if (
      this.resolutionStatuses.includes(dispute.status) ||
      dispute.resolution.state === 'proposed'
    ) {
      return 3;
    }
    return this.reviewStatuses.includes(dispute.status) ? 2 : 1;
  }

  isDisputeComplete(dispute: RepairDispute): boolean {
    return (
      this.completeStatuses.includes(dispute.status) ||
      dispute.resolution.state === 'final'
    );
  }

  progressDate(dispute: RepairDispute, index: number): string | undefined {
    const historyDate = (statuses: DisputeStatus[]): string | undefined =>
      dispute.statusHistory.find((event) => statuses.includes(event.to))?.at;
    switch (index) {
      case 0:
        return dispute.createdAt;
      case 1:
        return historyDate(this.reviewStatuses);
      case 2:
        return dispute.resolution.proposedAt ?? historyDate(this.resolutionStatuses);
      case 3:
        return (
          dispute.resolution.resolvedAt ??
          dispute.resolution.closedAt ??
          dispute.disputeClosedAt ??
          (this.isDisputeComplete(dispute)
            ? dispute.statusHistory[dispute.statusHistory.length - 1]?.at
            : undefined)
        );
      default:
        return undefined;
    }
  }

  hasResolution(dispute: RepairDispute): boolean {
    const resolution = dispute.resolution;
    return !!(
      resolution.state ||
      resolution.type ||
      resolution.description ||
      resolution.amount !== undefined ||
      resolution.responsibleParty ||
      resolution.notes ||
      resolution.decision ||
      resolution.decisionExplanation ||
      resolution.completionNotes ||
      resolution.customerRejectionReason ||
      resolution.shopRejectionReason ||
      resolution.refundTransactionId ||
      resolution.resolvedAt ||
      resolution.closedAt ||
      resolution.documents.length ||
      resolution.completionDocuments.length
    );
  }
}

