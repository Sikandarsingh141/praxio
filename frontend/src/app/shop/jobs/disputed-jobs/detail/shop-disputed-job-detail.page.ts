import { CommonModule, DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize, switchMap, tap } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import type { ShopProfile } from '../../../../core/auth/auth.models';
import { JobDetailPageBase } from '../../../../shared/components/job-page-base';
import { JobAttachmentsComponent } from '../../../../shared/components/job-attachments/job-attachments.component';
import type { MapCoordinates } from '../../../../shared/components/maps/location-map.component';
import { ShopRepairRouteComponent } from '../../../repair-job-details/components/shop-repair-route.component';
import type { JobAttachment } from '../../../../shared/models/job.models';
import {
  DisputeAttachment,
  DisputeStatus,
  RepairDispute,
} from '../../../../shared/models/disputes.models';
import type { RepairRoute } from '../../../../shared/models/repair-route.models';
import { DisputesService } from '../../../../shared/services/disputes.service';
import {
  disputeCategoryLabel,
  disputeStatusLabel,
} from '../../../../shared/utils/dispute-labels';
import type { ShopRepairRequest } from '../../../repair-requests/shop-repair-requests.models';
import { ShopRepairRequestsService } from '../../../repair-requests/shop-repair-requests.service';
import type {
  Technician,
  TechnicianRepairDetails,
} from '../../../technicians/technicians.models';
import { TechniciansService } from '../../../technicians/technicians.service';

type ShopDisputeAttachmentTarget =
  | 'conversation'
  | 'rejection'
  | 'reinspection'
  | 'progress'
  | 'completion';

@Component({
  selector: 'app-shop-disputed-job-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    RouterLink,
    JobAttachmentsComponent,
    ShopRepairRouteComponent,
  ],
  templateUrl: './shop-disputed-job-detail.page.html',
  styleUrl: './shop-disputed-job-detail.page.scss',
})
export class ShopDisputedJobDetailPage
  extends JobDetailPageBase<RepairDispute>
  implements OnInit
{
  private readonly disputes = inject(DisputesService);
  private readonly repairRequests = inject(ShopRepairRequestsService);
  private readonly technicians = inject(TechniciansService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  readonly isTechnician = this.route.snapshot.data['accountType'] === 'technician';
  protected readonly repairRequest = signal<ShopRepairRequest | null>(null);
  readonly technicianJob = signal<TechnicianRepairDetails | null>(null);
  readonly shopLocation = signal<MapCoordinates | null>(null);
  readonly shopLocationLoading = signal(false);
  readonly shopLocationError = signal('');
  readonly customerCoordinates = signal<MapCoordinates | null>(null);
  readonly mapLoading = signal(false);
  readonly mapError = signal('');
  readonly saving = signal(false);
  readonly categoryLabel = disputeCategoryLabel;
  readonly actionError = signal('');
  readonly actionNotice = signal('');
  readonly proposeResolutionModalOpen = signal(false);
  readonly reviewDisputeModalOpen = signal(false);
  readonly acceptDisputeModalOpen = signal(false);
  readonly rejectDisputeModalOpen = signal(false);
  readonly acceptResolutionModalOpen = signal(false);
  readonly rejectResolutionModalOpen = signal(false);
  readonly reinspectionModalOpen = signal(false);
  readonly additionalChargesModalOpen = signal(false);
  readonly reworkProgressModalOpen = signal(false);
  readonly completeReworkModalOpen = signal(false);
  readonly assignmentModalOpen = signal(false);
  readonly statusActionModalOpen = signal(false);
  readonly assignmentLoading = signal(false);
  readonly assignmentSubmitting = signal(false);
  readonly assignmentError = signal('');
  readonly assignmentTechnicians = signal<Technician[]>([]);
  readonly selectedTechnicianId = signal('');
  readonly assignmentSearch = signal('');
  readonly assignmentNote = signal('');
  readonly assignmentReason = signal('');
  readonly directionsLoader = (requestId: string): Observable<RepairRoute> =>
    this.isTechnician
      ? this.technicians.myJobDirections(requestId)
      : this.repairRequests.getDirections(requestId);
  readonly backRoute = this.isTechnician
    ? '/technician/jobs/disputed-jobs'
    : '/shop/jobs/disputed-jobs';
  readonly backLabel = 'Disputes';
  readonly pageTitle = 'Dispute Details';
  message = '';
  conversationAttachments: DisputeAttachment[] = [];
  rejectionReason = '';
  rejectionExplanation = '';
  rejectionAttachments: DisputeAttachment[] = [];
  resolutionDecisionReason = '';
  reinspectionFindings = '';
  requiredRepairWork = '';
  estimatedCompletionTime = '';
  chargeReason = '';
  chargeMessage = '';
  chargeItems: Array<{ description: string; amount: number | null }> = [
    { description: '', amount: null },
  ];
  progressNotes = '';
  reworkDescription = '';
  partsReplaced = '';
  testingResults = '';
  finalNotes = '';
  reworkTested = false;
  reinspectionAttachments: DisputeAttachment[] = [];
  progressAttachments: DisputeAttachment[] = [];
  completionDocuments: DisputeAttachment[] = [];
  shopResponseExplanation = '';
  shopResponseMessage = '';
  shopProposedResolution = '';
  resolutionType = 'repair_again';
  resolutionDescription = '';
  resolutionNotes = '';
  closeReason = '';
  reopenReason = '';
  statusAction: 'close' | 'reopen' = 'close';
  resolutionAmount: number | null = null;
  readonly resolutionResponsibleParty = 'shop';
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

  override ngOnInit(): void {
    super.ngOnInit();
    if (this.isTechnician) return;
    this.shopLocationLoading.set(true);
    this.authService
      .getMyShopProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile: ShopProfile) => {
          this.shopLocation.set(profile.location ?? null);
          this.shopLocationLoading.set(false);
        },
        error: (error: unknown) => {
          this.shopLocationError.set(
            this.jobs.errorMessage(error, 'The repair shop location could not be loaded.'),
          );
          this.shopLocationLoading.set(false);
        },
      });
  }

  protected override loadRecord(id: string): Observable<RepairDispute> {
    return this.disputes.get(this.isTechnician ? 'technician' : 'shop', id).pipe(
      tap((dispute) => this.loadRepairContext(dispute.repairRequestId)),
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

  customerName(dispute: RepairDispute): string {
    if (this.isTechnician) {
      const job = this.technicianJob();
      return (
        job?.customerInfo?.name?.trim() ||
        job?.customer?.trim() ||
        dispute.parties?.customer?.name?.trim() ||
        'Customer'
      );
    }
    const customer = this.repairRequest()?.customer;
    const name =
      customer?.displayName ||
      [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') ||
      dispute.parties?.customer?.name;
    return name?.trim() || 'Customer';
  }

  customerEmail(dispute: RepairDispute): string {
    if (this.isTechnician) {
      return this.technicianJob()?.customerInfo?.email || 'Not provided';
    }
    return (
      this.repairRequest()?.customer.email ||
      dispute.parties?.customer?.email ||
      'Not provided'
    );
  }

  initials(name: string): string {
    return (
      name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0].toUpperCase())
        .join('') || 'C'
    );
  }

  formatStatus(status: string): string {
    return disputeStatusLabel(status);
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

  statusHistoryTitle(
    event: RepairDispute['statusHistory'][number],
    index: number,
  ): string {
    if (index === 0 && (event.from === 'NONE' || event.to === 'OPEN')) {
      return 'Dispute Raised';
    }

    return event.to?.trim() ? this.formatStatus(event.to) : 'Status updated';
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

  canSendMessage(dispute: RepairDispute): boolean {
    if (this.isTechnician) return false;
    return dispute.status !== 'CLOSED' && dispute.status !== 'RESOLVED';
  }

  hasRouteCoordinates(): boolean {
    return (
      this.isValidCoordinates(this.shopLocation()) &&
      this.isValidCoordinates(this.customerCoordinates())
    );
  }

  routeAvailabilityMessage(): string {
    if (this.shopLocationLoading() || this.mapLoading()) {
      return 'Loading location details...';
    }
    return (
      this.shopLocationError() ||
      this.mapError() ||
      'Location details are not available yet.'
    );
  }

  sendMessage(dispute: RepairDispute): void {
    if (!this.message.trim()) {
      this.actionError.set('Enter a message before sending.');
      return;
    }
    this.runShopAction(
      this.disputes.sendMessage('shop', dispute._id, {
        message: this.message.trim(),
        attachments: this.conversationAttachments,
      }),
      'Message sent.',
      () => {
        this.message = '';
        this.conversationAttachments = [];
      },
    );
  }

  openProposeResolutionModal(): void {
    this.proposeResolutionModalOpen.set(true);
    this.actionError.set('');
  }

  closeProposeResolutionModal(): void {
    this.proposeResolutionModalOpen.set(false);
    this.actionError.set('');
  }

  openReviewDisputeModal(): void {
    this.reviewDisputeModalOpen.set(true);
    this.actionError.set('');
  }

  closeReviewDisputeModal(): void {
    this.reviewDisputeModalOpen.set(false);
    this.actionError.set('');
  }

  openAcceptDisputeModal(): void {
    this.acceptDisputeModalOpen.set(true);
    this.actionError.set('');
  }

  closeAcceptDisputeModal(): void {
    this.acceptDisputeModalOpen.set(false);
    this.actionError.set('');
  }

  openRejectDisputeModal(): void {
    this.rejectDisputeModalOpen.set(true);
    this.actionError.set('');
  }

  closeRejectDisputeModal(): void {
    this.rejectDisputeModalOpen.set(false);
    this.actionError.set('');
  }

  openAcceptResolutionModal(dispute: RepairDispute): void {
    if (!this.canReviewCustomerResponse(dispute)) return;
    this.acceptResolutionModalOpen.set(true);
    this.actionError.set('');
  }

  closeAcceptResolutionModal(): void {
    this.acceptResolutionModalOpen.set(false);
    this.actionError.set('');
  }

  openRejectResolutionModal(dispute: RepairDispute): void {
    if (!this.canReviewCustomerResponse(dispute)) return;
    this.rejectResolutionModalOpen.set(true);
    this.actionError.set('');
  }

  closeRejectResolutionModal(): void {
    this.rejectResolutionModalOpen.set(false);
    this.actionError.set('');
  }

  openReinspectionModal(): void {
    this.reinspectionModalOpen.set(true);
    this.actionError.set('');
  }

  closeReinspectionModal(): void {
    this.reinspectionModalOpen.set(false);
    this.actionError.set('');
  }

  openAdditionalChargesModal(): void {
    this.additionalChargesModalOpen.set(true);
    this.actionError.set('');
  }

  closeAdditionalChargesModal(): void {
    this.additionalChargesModalOpen.set(false);
    this.actionError.set('');
  }

  openReworkProgressModal(): void {
    this.reworkProgressModalOpen.set(true);
    this.actionError.set('');
  }

  closeReworkProgressModal(): void {
    this.reworkProgressModalOpen.set(false);
    this.actionError.set('');
  }

  openCompleteReworkModal(): void {
    this.completeReworkModalOpen.set(true);
    this.actionError.set('');
  }

  closeCompleteReworkModal(): void {
    this.completeReworkModalOpen.set(false);
    this.actionError.set('');
  }

  openAssignment(): void {
    const current = this.repairRequest()?.technicianAssignment?.current;
    this.selectedTechnicianId.set(current?.isOwner ? '' : current?.technicianId ?? '');
    this.assignmentSearch.set('');
    this.assignmentNote.set('');
    this.assignmentReason.set('');
    this.assignmentError.set('');
    this.assignmentTechnicians.set([]);
    this.assignmentModalOpen.set(true);
    this.assignmentLoading.set(true);
    this.technicians
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.assignmentTechnicians.set(result.technicians);
          this.assignmentLoading.set(false);
        },
        error: (error: unknown) => {
          this.assignmentError.set(
            this.jobs.errorMessage(error, 'Technician list could not be loaded.'),
          );
          this.assignmentLoading.set(false);
        },
      });
  }

  closeAssignment(): void {
    this.assignmentModalOpen.set(false);
    this.assignmentError.set('');
  }

  hasCurrentAssignment(): boolean {
    return Boolean(this.repairRequest()?.technicianAssignment?.current);
  }

  filteredAssignmentTechnicians(): Technician[] {
    const query = this.assignmentSearch().trim().toLocaleLowerCase();
    return this.assignmentTechnicians().filter((technician) =>
      [technician.name, technician.employeeId, technician.skills.join(' '), technician.specialization]
        .join(' ')
        .toLocaleLowerCase()
        .includes(query),
    );
  }

  isSelectedTechnicianBusy(): boolean {
    const selectedId = this.selectedTechnicianId();
    return this.assignmentTechnicians().some(
      (technician) => technician.id === selectedId && technician.availability === 'busy',
    );
  }

  submitAssignment(): void {
    const requestId = this.repairRequest()?._id ?? this.record()?.repairRequestId;
    if (!requestId) return;
    const current = this.repairRequest()?.technicianAssignment?.current;
    const selected = this.selectedTechnicianId();
    if (
      current &&
      (current.technicianId === selected || (current.isOwner && selected === ''))
    ) {
      this.assignmentError.set('Select a different technician.');
      return;
    }
    if (current && !this.assignmentReason().trim()) {
      this.assignmentError.set('Enter a reason to reassign this repair.');
      return;
    }
    this.assignmentSubmitting.set(true);
    this.assignmentError.set('');
    this.technicians
      .assign(requestId, {
        ...(selected ? { technicianId: selected } : {}),
        note: this.assignmentNote().trim(),
        ...(current ? { reason: this.assignmentReason().trim() } : {}),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.assignmentSubmitting.set(false);
          this.assignmentModalOpen.set(false);
          this.actionNotice.set(
            result.warning
              ? `Technician assigned. Warning: ${result.warning}`
              : 'Technician assignment updated.',
          );
          this.loadCustomerLocation(requestId);
        },
        error: (error: unknown) => {
          this.assignmentError.set(
            this.jobs.errorMessage(error, 'Technician could not be assigned.'),
          );
          this.assignmentSubmitting.set(false);
        },
      });
  }

  proposeResolution(dispute: RepairDispute): void {
    if (!this.resolutionDescription.trim() || !this.resolutionNotes.trim()) {
      this.actionError.set('Describe the proposed resolution and include supporting notes.');
      return;
    }
    if (
      ['partial_refund', 'full_refund'].includes(this.resolutionType) &&
      (this.resolutionAmount === null || this.resolutionAmount < 0)
    ) {
      this.actionError.set('Enter the proposed refund amount.');
      return;
    }
    this.runShopAction(
      this.disputes.proposeResolution('shop', dispute._id, {
        type: this.resolutionType,
        description: this.resolutionDescription.trim(),
        amount: this.resolutionAmount ?? undefined,
        responsibleParty: this.resolutionResponsibleParty,
        notes: this.resolutionNotes.trim(),
      }),
      'Resolution proposal submitted.',
      () => {
        this.resolutionDescription = '';
        this.resolutionNotes = '';
        this.resolutionAmount = null;
        this.closeProposeResolutionModal();
      },
    );
  }

  acceptDispute(dispute: RepairDispute): void {
    this.runShopAction(
      this.disputes.accept(dispute._id),
      'Dispute accepted.',
      () => this.closeAcceptDisputeModal(),
    );
  }

  submitShopResponse(dispute: RepairDispute): void {
    if (!this.shopResponseExplanation.trim() || !this.shopResponseMessage.trim()) {
      this.actionError.set('Provide an explanation and message for the customer.');
      return;
    }
    this.runShopAction(
      this.disputes.respondAsShop(dispute._id, {
        explanation: this.shopResponseExplanation.trim(),
        message: this.shopResponseMessage.trim(),
        proposedResolution: this.shopProposedResolution.trim() || undefined,
      }),
      'Response sent to the customer.',
      () => {
        this.shopResponseExplanation = '';
        this.shopResponseMessage = '';
        this.shopProposedResolution = '';
        this.closeReviewDisputeModal();
      },
    );
  }

  rejectDispute(dispute: RepairDispute): void {
    if (!this.rejectionReason.trim() || !this.rejectionExplanation.trim()) {
      this.actionError.set('Provide a rejection reason and explanation.');
      return;
    }
    this.runShopAction(
      this.disputes.reject(dispute._id, {
        reason: this.rejectionReason.trim(),
        explanation: this.rejectionExplanation.trim(),
        attachments: this.rejectionAttachments,
      }),
      'Dispute response sent to the customer.',
      () => {
        this.rejectionReason = '';
        this.rejectionExplanation = '';
        this.rejectionAttachments = [];
        this.closeRejectDisputeModal();
      },
    );
  }

  canProposeResolution(dispute: RepairDispute): boolean {
    return (
      dispute.status !== 'CLOSED' &&
      dispute.status !== 'RESOLVED' &&
      dispute.resolution.state !== 'proposed'
    );
  }

  canReviewDispute(dispute: RepairDispute): boolean {
    return dispute.status === 'OPEN';
  }

  canReviewCustomerResponse(dispute: RepairDispute): boolean {
    return (
      dispute.status === 'AWAITING_SHOP_RESPONSE' &&
      dispute.resolution.state === 'proposed'
    );
  }

  hasDistinctResolutionNotes(dispute: RepairDispute): boolean {
    const notes = dispute.resolution.notes?.trim();
    if (!notes) return false;

    const description = dispute.resolution.description?.trim();
    if (!description) return true;

    const normalize = (value: string) => value.replace(/\s+/g, ' ').toLocaleLowerCase();
    return normalize(notes) !== normalize(description);
  }

  decideResolution(dispute: RepairDispute, decision: 'accept' | 'reject'): void {
    if (!this.canReviewCustomerResponse(dispute) || this.saving()) return;
    const reason = this.resolutionDecisionReason.trim();
    if (decision === 'reject' && !reason) {
      this.actionError.set('Explain why you are rejecting the proposed resolution.');
      return;
    }
    this.runShopAction(
      this.disputes.decideResolution('shop', dispute._id, {
        decision,
        reason: decision === 'reject' ? reason : undefined,
      }),
      decision === 'accept' ? 'Resolution accepted.' : 'Resolution rejected.',
      () => {
        this.resolutionDecisionReason = '';
        this.acceptResolutionModalOpen.set(false);
        this.rejectResolutionModalOpen.set(false);
      },
    );
  }

  canCloseDispute(dispute: RepairDispute): boolean {
    return dispute.status === 'CUSTOMER_CONFIRMED' || dispute.status === 'RESOLVED';
  }

  openStatusActionModal(dispute: RepairDispute): void {
    const canClose = this.canCloseDispute(dispute);
    const canReopen = this.canReopenDispute(dispute);
    if (this.isTechnician || (!canClose && !canReopen)) return;
    this.statusAction = canClose ? 'close' : 'reopen';
    this.closeReason = '';
    this.reopenReason = '';
    this.actionError.set('');
    this.statusActionModalOpen.set(true);
  }

  closeStatusActionModal(): void {
    this.statusActionModalOpen.set(false);
    this.actionError.set('');
  }

  submitStatusAction(dispute: RepairDispute): void {
    if (this.statusAction === 'close') {
      this.closeDispute(dispute);
    } else {
      this.reopenDispute(dispute);
    }
  }

  closeDispute(dispute: RepairDispute): void {
    if (this.isTechnician || !this.canCloseDispute(dispute) || this.saving()) return;
    const reason = this.closeReason.trim();
    if (!reason) {
      this.actionError.set('Enter a final closure note.');
      return;
    }
    this.runShopAction(
      this.disputes
        .close(dispute._id, reason)
        .pipe(switchMap(() => this.disputes.get('shop', dispute._id))),
      'Dispute closed.',
      () => {
        this.closeReason = '';
        this.closeStatusActionModal();
      },
    );
  }

  canReopenDispute(dispute: RepairDispute): boolean {
    return dispute.status === 'RESOLVED' || dispute.status === 'CLOSED';
  }

  reopenDispute(dispute: RepairDispute): void {
    if (this.isTechnician || !this.canReopenDispute(dispute) || this.saving()) return;
    const reason = this.reopenReason.trim();
    if (!reason) {
      this.actionError.set('Explain why this dispute should be reopened.');
      return;
    }
    this.runShopAction(
      this.disputes
        .reopen('shop', dispute._id, reason)
        .pipe(switchMap(() => this.disputes.get('shop', dispute._id))),
      'Dispute reopened for further review.',
      () => {
        this.reopenReason = '';
        this.closeStatusActionModal();
      },
    );
  }

  canStartReinspection(dispute: RepairDispute): boolean {
    return ['UNDER_REVIEW', 'ACCEPTED', 'REOPENED'].includes(dispute.status);
  }

  startReinspection(dispute: RepairDispute): void {
    if (!this.canStartReinspection(dispute)) return;
    this.runShopAction(
      this.disputes.startReinspection(dispute._id),
      'Reinspection started.',
    );
  }

  canSubmitReinspection(dispute: RepairDispute): boolean {
    return (
      dispute.status === 'REINSPECTION_IN_PROGRESS' ||
      dispute.status === 'AWAITING_SHOP_RESPONSE'
    );
  }

  submitReinspection(dispute: RepairDispute): void {
    if (!this.canSubmitReinspection(dispute)) return;
    if (!this.reinspectionFindings.trim() || !this.requiredRepairWork.trim()) {
      this.actionError.set('Complete the inspection findings and required repair work.');
      return;
    }
    this.runShopAction(
      this.disputes.submitReinspection(dispute._id, {
        findings: this.reinspectionFindings.trim(),
        requiredRepairWork: this.requiredRepairWork.trim(),
        estimatedCompletionTime: this.estimatedCompletionTime.trim() || undefined,
        attachments: this.reinspectionAttachments,
      }),
      'Reinspection findings submitted.',
      () => {
        this.reinspectionFindings = '';
        this.requiredRepairWork = '';
        this.estimatedCompletionTime = '';
        this.reinspectionAttachments = [];
        this.closeReinspectionModal();
      },
    );
  }

  addChargeLine(): void {
    if (this.chargeItems.length < 20) {
      this.chargeItems.push({ description: '', amount: null });
    }
  }

  removeChargeLine(index: number): void {
    if (this.chargeItems.length > 1) {
      this.chargeItems = this.chargeItems.filter((_, itemIndex) => itemIndex !== index);
    }
  }

  requestCharges(dispute: RepairDispute): void {
    if (!this.canSubmitReinspection(dispute)) return;
    const items = this.chargeItems.map((item) => ({
      description: item.description.trim(),
      amount: item.amount,
    }));
    if (
      !this.chargeReason.trim() ||
      items.some((item) => !item.description || item.amount === null || item.amount < 0)
    ) {
      this.actionError.set('Enter a reason and a description and amount for each charge item.');
      return;
    }
    const validItems = items.filter(
      (item): item is { description: string; amount: number } => item.amount !== null,
    );
    this.runShopAction(
      this.disputes.requestAdditionalCharges(dispute._id, {
        reason: this.chargeReason.trim(),
        items: validItems,
        message: this.chargeMessage.trim() || undefined,
      }),
      'Additional charges sent to the customer for approval.',
      () => {
        this.chargeReason = '';
        this.chargeMessage = '';
        this.chargeItems = [{ description: '', amount: null }];
        this.closeAdditionalChargesModal();
      },
    );
  }

  canStartRework(dispute: RepairDispute): boolean {
    const latestCharge = dispute.additionalCharges.at(-1);
    const newWorkflow =
      (dispute.status === 'AWAITING_CUSTOMER_RESPONSE' ||
        dispute.status === 'REOPENED') &&
      (!latestCharge || latestCharge.status === 'accepted');
    return (
      dispute.status === 'REINSPECTION_IN_PROGRESS' ||
      (dispute.status === 'AWAITING_CUSTOMER_APPROVAL' &&
        latestCharge?.status === 'accepted') ||
      newWorkflow
    );
  }

  startRework(dispute: RepairDispute): void {
    if (!this.canStartRework(dispute)) return;
    this.runShopAction(
      this.disputes.startRework(dispute._id),
      'Rework started.',
    );
  }

  canUpdateRework(dispute: RepairDispute): boolean {
    return (
      dispute.status === 'REPAIR_IN_PROGRESS' ||
      dispute.status === 'AWAITING_SHOP_RESPONSE'
    );
  }

  addReworkProgress(dispute: RepairDispute): void {
    if (!this.canUpdateRework(dispute)) return;
    if (!this.progressNotes.trim()) {
      this.actionError.set('Enter a progress update.');
      return;
    }
    this.runShopAction(
      this.disputes.addProgress(dispute._id, {
        notes: this.progressNotes.trim(),
        attachments: this.progressAttachments,
      }),
      'Progress update added.',
      () => {
        this.progressNotes = '';
        this.progressAttachments = [];
        this.closeReworkProgressModal();
      },
    );
  }

  completeRework(dispute: RepairDispute): void {
    if (!this.canUpdateRework(dispute)) return;
    if (!this.reworkDescription.trim() || !this.testingResults.trim()) {
      this.actionError.set('Enter the work performed and device testing results.');
      return;
    }
    if (!this.reworkTested) {
      this.actionError.set('Confirm that the device has been tested before completion.');
      return;
    }
    this.runShopAction(
      this.disputes.completeRework(dispute._id, {
        workPerformed: this.reworkDescription.trim(),
        partsReplaced: this.partsReplaced.trim() || undefined,
        testingResults: this.testingResults.trim(),
        finalNotes: this.finalNotes.trim() || undefined,
        tested: this.reworkTested,
        attachments: this.completionDocuments,
      }),
      'Rework marked complete. The customer has been asked to verify the repair.',
      () => {
        this.reworkDescription = '';
        this.partsReplaced = '';
        this.testingResults = '';
        this.finalNotes = '';
        this.reworkTested = false;
        this.completionDocuments = [];
        this.closeCompleteReworkModal();
      },
    );
  }

  async onConversationFilesSelected(event: Event): Promise<void> {
    await this.addAttachments(event, 'conversation');
  }

  async onRejectionFilesSelected(event: Event): Promise<void> {
    await this.addAttachments(event, 'rejection');
  }

  async onReinspectionFilesSelected(event: Event): Promise<void> {
    await this.addAttachments(event, 'reinspection');
  }

  async onProgressFilesSelected(event: Event): Promise<void> {
    await this.addAttachments(event, 'progress');
  }

  async onCompletionFilesSelected(event: Event): Promise<void> {
    await this.addAttachments(event, 'completion');
  }

  removeConversationAttachment(index: number): void {
    this.conversationAttachments = this.conversationAttachments.filter(
      (_, itemIndex) => itemIndex !== index,
    );
  }

  removeRejectionAttachment(index: number): void {
    this.rejectionAttachments = this.rejectionAttachments.filter(
      (_, itemIndex) => itemIndex !== index,
    );
  }

  removeReinspectionAttachment(index: number): void {
    this.reinspectionAttachments = this.reinspectionAttachments.filter(
      (_, itemIndex) => itemIndex !== index,
    );
  }

  removeProgressAttachment(index: number): void {
    this.progressAttachments = this.progressAttachments.filter(
      (_, itemIndex) => itemIndex !== index,
    );
  }

  removeCompletionDocument(index: number): void {
    this.completionDocuments = this.completionDocuments.filter(
      (_, itemIndex) => itemIndex !== index,
    );
  }

  private runShopAction(
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
            this.jobs.errorMessage(error, 'The requested dispute action could not be completed.'),
          );
        },
      });
  }

  private async addAttachments(
    event: Event,
    target: ShopDisputeAttachmentTarget,
  ): Promise<void> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.files?.length) return;
    const currentFiles = this.attachmentsFor(target);
    const files = Array.from(input.files);
    if (files.length + currentFiles.length > 2) {
      this.actionError.set('Attach up to two files, each no larger than 500 KB.');
      input.value = '';
      return;
    }
    try {
      const attachments = await Promise.all(files.map((file) => this.readAttachment(file)));
      this.setAttachments(target, [...currentFiles, ...attachments]);
      this.actionError.set('');
    } catch (error: unknown) {
      this.actionError.set(
        error instanceof Error ? error.message : 'The selected files could not be read.',
      );
    } finally {
      input.value = '';
    }
  }

  private attachmentsFor(target: ShopDisputeAttachmentTarget): DisputeAttachment[] {
    switch (target) {
      case 'conversation':
        return this.conversationAttachments;
      case 'rejection':
        return this.rejectionAttachments;
      case 'reinspection':
        return this.reinspectionAttachments;
      case 'progress':
        return this.progressAttachments;
      case 'completion':
        return this.completionDocuments;
    }
  }

  private setAttachments(
    target: ShopDisputeAttachmentTarget,
    attachments: DisputeAttachment[],
  ): void {
    switch (target) {
      case 'conversation':
        this.conversationAttachments = attachments;
        break;
      case 'rejection':
        this.rejectionAttachments = attachments;
        break;
      case 'reinspection':
        this.reinspectionAttachments = attachments;
        break;
      case 'progress':
        this.progressAttachments = attachments;
        break;
      case 'completion':
        this.completionDocuments = attachments;
        break;
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
      return Promise.reject(new Error('Evidence must be a JPEG, PNG, WebP image, or PDF.'));
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

  private isValidCoordinates(
    location: MapCoordinates | null | undefined,
  ): location is MapCoordinates {
    return (
      !!location &&
      Number.isFinite(location.latitude) &&
      location.latitude >= -90 &&
      location.latitude <= 90 &&
      Number.isFinite(location.longitude) &&
      location.longitude >= -180 &&
      location.longitude <= 180
    );
  }

  private loadRepairContext(requestId: string): void {
    if (this.isTechnician) {
      this.loadTechnicianRepairContext(requestId);
      return;
    }
    this.loadCustomerLocation(requestId);
  }

  private loadTechnicianRepairContext(requestId: string): void {
    this.technicianJob.set(null);
    this.repairRequest.set(null);
    this.customerCoordinates.set(null);
    this.shopLocation.set(null);
    this.mapError.set('');
    this.shopLocationError.set('');
    this.mapLoading.set(true);
    this.shopLocationLoading.set(true);
    this.technicians
      .myJobDetails(requestId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (job) => {
          this.technicianJob.set(job);
          this.customerCoordinates.set(job.customerInfo?.location ?? job.location ?? null);
          this.shopLocation.set(job.shop?.location ?? null);
          this.mapLoading.set(false);
          this.shopLocationLoading.set(false);
        },
        error: (error: unknown) => {
          const message = this.jobs.errorMessage(
            error,
            'Repair details could not be loaded.',
          );
          this.mapError.set(message);
          this.shopLocationError.set(message);
          this.mapLoading.set(false);
          this.shopLocationLoading.set(false);
        },
      });
  }

  private loadCustomerLocation(requestId: string): void {
    this.repairRequest.set(null);
    this.customerCoordinates.set(null);
    this.mapError.set('');
    this.mapLoading.set(true);

    this.repairRequests
      .get(requestId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (request) => {
          this.repairRequest.set(request);
          this.customerCoordinates.set(
            request.customer.location ??
              (request.customerLatitude !== undefined && request.customerLongitude !== undefined
                ? {
                    latitude: request.customerLatitude,
                    longitude: request.customerLongitude,
                  }
                : null),
          );
          this.mapLoading.set(false);
        },
        error: (error: unknown) => {
          this.mapError.set(
            this.jobs.errorMessage(error, 'Customer map location could not be loaded.'),
          );
          this.mapLoading.set(false);
        },
      });
  }
}

