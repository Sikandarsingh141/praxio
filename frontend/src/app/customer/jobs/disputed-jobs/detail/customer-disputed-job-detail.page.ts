import { CommonModule, DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize, switchMap } from 'rxjs';
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
import {
  disputeCategoryLabel,
  disputeStatusLabel,
} from '../../../../shared/utils/dispute-labels';

@Component({
  selector: 'app-customer-disputed-job-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    RouterLink,
    JobAttachmentsComponent,
    JobTimelineComponent,
  ],
  templateUrl: './customer-disputed-job-detail.page.html',
  styleUrl: './customer-disputed-job-detail.page.scss',
})
export class CustomerDisputedJobDetailPage extends JobDetailPageBase<RepairDispute> {
  private readonly disputes = inject(DisputesService);
  private readonly destroyRef = inject(DestroyRef);
  readonly backRoute = '/customer/jobs/disputed-jobs';
  readonly backLabel = 'Disputes';
  readonly pageTitle = 'Dispute Details';
  readonly saving = signal(false);
  readonly categoryLabel = disputeCategoryLabel;
  readonly actionError = signal('');
  readonly actionNotice = signal('');
  readonly reopenDisputeModalOpen = signal(false);
  readonly reviewResolutionModalOpen = signal(false);
  readonly reinspectionSubmissionModalOpen = signal(false);
  readonly inspectionTestModalOpen = signal(false);
  message = '';
  conversationAttachments: DisputeAttachment[] = [];
  responseAttachments: DisputeAttachment[] = [];
  reinspectionReply = '';
  resolutionDecisionReason = '';
  chargeDecisionReason = '';
  verificationNotes = '';
  unresolvedNotes = '';
  reopenReason = '';
  inspectionChoice: 'resolved' | 'unresolved' | null = null;
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
    return dispute.statusHistory.map((event) => {
      const attachmentCount = this.historyAttachmentCount(dispute, event);
      return {
        title: this.formatStatus(event.to),
        description: event.reason,
        at: event.at,
        actorName: event.actorName,
        actorRole: event.actorRole,
        ...(attachmentCount > 0 ? { attachmentCount } : {}),
      };
    });
  }

  historyAttachmentCount(
    dispute: RepairDispute,
    event: RepairDispute['statusHistory'][number],
  ): number {
    return dispute.messages.reduce(
      (count, message) =>
        message.authorRole === event.actorRole && message.createdAt === event.at
          ? count + message.attachments.length
          : count,
      0,
    );
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

  canSendMessage(dispute: RepairDispute): boolean {
    return dispute.status !== 'CLOSED' && dispute.status !== 'RESOLVED';
  }

  canDecideAdditionalCharge(
    dispute: RepairDispute,
    charge: RepairDispute['additionalCharges'][number],
  ): boolean {
    return (
      (dispute.status === 'AWAITING_CUSTOMER_APPROVAL' ||
        dispute.status === 'AWAITING_CUSTOMER_RESPONSE') &&
      charge.status === 'pending' &&
      !!charge._id
    );
  }

  canReviewCompletedRework(dispute: RepairDispute): boolean {
    return (
      (dispute.status === 'CUSTOMER_VERIFICATION_PENDING' ||
        dispute.status === 'AWAITING_CUSTOMER_RESPONSE') &&
      dispute.reworkCompletions.length > 0
    );
  }

  showUnresolvedResponse(dispute: RepairDispute): boolean {
    if (dispute.status === 'REJECTED') return true;
    if (dispute.status !== 'AWAITING_CUSTOMER_RESPONSE') return false;
    if (this.pendingReinspectionResponse(dispute)) return false;
    return !(
      dispute.resolution.state === 'proposed' ||
      dispute.additionalCharges.some(
        (charge) => charge.status === 'pending' && !!charge._id,
      ) ||
      this.canReviewCompletedRework(dispute) ||
      dispute.additionalCharges.at(-1)?.status === 'accepted'
    );
  }

  pendingReinspectionResponse(
    dispute: RepairDispute,
  ): RepairDispute['reinspections'][number] | null {
    if (
      dispute.status !== 'AWAITING_CUSTOMER_RESPONSE' ||
      dispute.resolution.state === 'proposed' ||
      this.canReviewCompletedRework(dispute)
    ) {
      return null;
    }
    const latestStatus = dispute.statusHistory.at(-1);
    const latestInspection = dispute.reinspections.at(-1);
    if (
      !latestInspection ||
      latestStatus?.to !== 'AWAITING_CUSTOMER_RESPONSE' ||
      latestStatus.reason !== 'The shop submitted reinspection findings.'
    ) {
      return null;
    }
    const latestCharge = dispute.additionalCharges.at(-1);
    if (
      latestCharge &&
      Date.parse(latestCharge.requestedAt) >= Date.parse(latestInspection.submittedAt)
    ) {
      return null;
    }
    return latestInspection;
  }

  sendMessage(dispute: RepairDispute): void {
    const message = this.message.trim();
    if (!this.canSendMessage(dispute) || this.saving()) return;
    if (!message) {
      this.actionError.set('Enter a message before sending.');
      return;
    }

    this.runCustomerAction(
      this.disputes.sendMessage('customer', dispute._id, {
        message,
        attachments: this.conversationAttachments,
      }),
      'Message sent.',
      () => {
        this.message = '';
        this.conversationAttachments = [];
      },
    );
  }

  async onConversationFilesSelected(event: Event): Promise<void> {
    await this.addAttachments(event, 'conversation');
  }

  async onResponseFilesSelected(event: Event): Promise<void> {
    await this.addAttachments(event, 'response');
  }

  removeConversationAttachment(index: number): void {
    this.conversationAttachments = this.conversationAttachments.filter(
      (_, itemIndex) => itemIndex !== index,
    );
  }

  removeResponseAttachment(index: number): void {
    this.responseAttachments = this.responseAttachments.filter(
      (_, itemIndex) => itemIndex !== index,
    );
  }

  openReviewResolutionModal(): void {
    this.reviewResolutionModalOpen.set(true);
    this.actionError.set('');
  }

  closeReviewResolutionModal(): void {
    this.reviewResolutionModalOpen.set(false);
    this.actionError.set('');
  }

  openReinspectionSubmissionModal(): void {
    this.reinspectionSubmissionModalOpen.set(true);
    this.actionError.set('');
  }

  closeReinspectionSubmissionModal(): void {
    this.reinspectionSubmissionModalOpen.set(false);
    this.actionError.set('');
  }

  openInspectionTestModal(): void {
    this.inspectionTestModalOpen.set(true);
    this.inspectionChoice = null;
    this.actionError.set('');
  }

  closeInspectionTestModal(): void {
    this.inspectionTestModalOpen.set(false);
    this.inspectionChoice = null;
    this.actionError.set('');
  }

  decideResolution(dispute: RepairDispute, decision: 'accept' | 'reject'): void {
    if (
      dispute.status !== 'AWAITING_CUSTOMER_RESPONSE' ||
      dispute.resolution.state !== 'proposed' ||
      this.saving()
    ) {
      return;
    }
    const reason = this.resolutionDecisionReason.trim();
    if (decision === 'reject' && !reason) {
      this.actionError.set('Explain why you are rejecting the proposed resolution.');
      return;
    }
    this.runCustomerAction(
      this.disputes.decideResolution('customer', dispute._id, {
        decision,
        reason: reason || undefined,
      }),
      decision === 'accept' ? 'Resolution accepted.' : 'Resolution rejected.',
      () => {
        this.resolutionDecisionReason = '';
        this.closeReviewResolutionModal();
      },
    );
  }

  sendReinspectionReply(dispute: RepairDispute): void {
    if (!this.pendingReinspectionResponse(dispute) || this.saving()) return;
    const message = this.reinspectionReply.trim();
    if (!message) {
      this.actionError.set('Enter a response to the shop.');
      return;
    }
    this.runCustomerAction(
      this.disputes.sendMessage('customer', dispute._id, {
        message,
        attachments: [],
      }),
      'Response sent to the shop.',
      () => {
        this.reinspectionReply = '';
        this.closeReinspectionSubmissionModal();
      },
    );
  }

  decideAdditionalCharges(
    dispute: RepairDispute,
    chargeId: string,
    decision: 'accept' | 'decline',
  ): void {
    const charge = dispute.additionalCharges.find((item) => item._id === chargeId);
    if (!charge || !this.canDecideAdditionalCharge(dispute, charge) || this.saving()) return;
    this.runCustomerAction(
      this.disputes.decideAdditionalCharges(
        dispute._id,
        chargeId,
        decision,
        decision === 'decline' ? this.chargeDecisionReason.trim() || undefined : undefined,
      ),
      decision === 'accept' ? 'Additional charges approved.' : 'Additional charges declined.',
      () => {
        this.chargeDecisionReason = '';
      },
    );
  }

  confirmResolution(dispute: RepairDispute): void {
    if (!this.canReviewCompletedRework(dispute) || this.saving()) return;
    const message = this.verificationNotes.trim();
    if (!message) {
      this.actionError.set('Add a short note confirming the repair before continuing.');
      return;
    }
    this.runCustomerAction(
      this.disputes.confirmResolution(dispute._id, { message }),
      'Thank you. This dispute is now resolved.',
      () => {
        this.verificationNotes = '';
        this.closeInspectionTestModal();
      },
    );
  }

  reportUnresolved(dispute: RepairDispute): void {
    if (!this.canReportUnresolved(dispute) || this.saving()) return;
    const notes = this.unresolvedNotes.trim();
    if (!notes) {
      this.actionError.set('Describe what is still not working.');
      return;
    }
    this.runCustomerAction(
      this.disputes.reportUnresolved(dispute._id, {
        notes,
        attachments: this.responseAttachments,
      }),
      'The shop has been notified that the issue remains.',
      () => {
        this.unresolvedNotes = '';
        this.responseAttachments = [];
        this.closeReinspectionSubmissionModal();
        this.closeInspectionTestModal();
      },
    );
  }

  canReopen(dispute: RepairDispute): boolean {
    return dispute.status === 'RESOLVED' || dispute.status === 'CLOSED';
  }

  openReopenDisputeModal(dispute: RepairDispute): void {
    if (!this.canReopen(dispute) || this.saving()) return;
    this.reopenReason = '';
    this.actionError.set('');
    this.reopenDisputeModalOpen.set(true);
  }

  closeReopenDisputeModal(): void {
    this.reopenDisputeModalOpen.set(false);
    this.actionError.set('');
  }

  reopenDispute(dispute: RepairDispute): void {
    if (!this.canReopen(dispute) || this.saving()) return;
    const reason = this.reopenReason.trim();
    if (!reason) {
      this.actionError.set('Explain why this dispute should be reopened.');
      return;
    }
    this.runCustomerAction(
      this.disputes
        .reopen('customer', dispute._id, reason)
        .pipe(switchMap(() => this.disputes.get('customer', dispute._id))),
      'Dispute reopened for further review.',
      () => {
        this.reopenReason = '';
        this.closeReopenDisputeModal();
      },
    );
  }

  private canReportUnresolved(dispute: RepairDispute): boolean {
    return (
      dispute.status === 'AWAITING_CUSTOMER_RESPONSE' ||
      dispute.status === 'CUSTOMER_VERIFICATION_PENDING' ||
      dispute.status === 'CUSTOMER_CONFIRMED' ||
      dispute.status === 'REJECTED'
    );
  }

  private runCustomerAction(
    request: Observable<RepairDispute>,
    successMessage: string,
    onSuccess: () => void = () => undefined,
  ): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.actionError.set('');
    this.actionNotice.set('');
    request
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: (updatedDispute) => {
          this.record.set(updatedDispute);
          this.actionNotice.set(successMessage);
          onSuccess();
        },
        error: (error: unknown) => {
          this.actionError.set(
            this.jobs.errorMessage(error, 'The requested dispute response could not be sent.'),
          );
        },
      });
  }

  private async addAttachments(event: Event, target: 'conversation' | 'response'): Promise<void> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.files?.length) return;
    const files = Array.from(input.files);
    const existing = target === 'conversation' ? this.conversationAttachments : this.responseAttachments;
    if (files.length + existing.length > 2) {
      this.actionError.set('Attach up to two files, each no larger than 500 KB.');
      input.value = '';
      return;
    }

    try {
      const attachments = await Promise.all(files.map((file) => this.readAttachment(file)));
      if (target === 'conversation') {
        this.conversationAttachments = [...this.conversationAttachments, ...attachments];
      } else {
        this.responseAttachments = [...this.responseAttachments, ...attachments];
      }
      this.actionError.set('');
    } catch (error: unknown) {
      this.actionError.set(
        error instanceof Error ? error.message : 'The selected files could not be read.',
      );
    } finally {
      input.value = '';
    }
  }

  initials(name?: string, email?: string): string {
    const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
    if (words.length) {
      return words.slice(0, 2).map((word) => word[0].toUpperCase()).join('');
    }
    return email?.trim().charAt(0).toUpperCase() || 'C';
  }

  formatStatus(status?: string): string {
    return status ? disputeStatusLabel(status) : 'Not available';
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

  private readAttachment(file: File): Promise<DisputeAttachment> {
    const acceptedTypes: DisputeAttachment['mimeType'][] = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];
    if (!acceptedTypes.includes(file.type as DisputeAttachment['mimeType'])) {
      return Promise.reject(new Error('Message files must be JPEG, PNG, WebP images, or PDFs.'));
    }
    if (file.size > 500 * 1024) {
      return Promise.reject(new Error(`${file.name} exceeds the 500 KB limit.`));
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          reject(new Error(`${file.name} could not be read.`));
          return;
        }
        resolve({
          name: file.name,
          mimeType: file.type as DisputeAttachment['mimeType'],
          data: reader.result,
        });
      };
      reader.onerror = () => reject(new Error(`${file.name} could not be read.`));
      reader.readAsDataURL(file);
    });
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

