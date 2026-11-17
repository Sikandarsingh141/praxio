import { CommonModule, DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize, tap } from 'rxjs';
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
import type { ShopRepairRequest } from '../../../repair-requests/shop-repair-requests.models';
import { ShopRepairRequestsService } from '../../../repair-requests/shop-repair-requests.service';

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
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly repairRequest = signal<ShopRepairRequest | null>(null);
  readonly shopLocation = signal<MapCoordinates | null>(null);
  readonly shopLocationLoading = signal(false);
  readonly shopLocationError = signal('');
  readonly customerCoordinates = signal<MapCoordinates | null>(null);
  readonly mapLoading = signal(false);
  readonly mapError = signal('');
  readonly saving = signal(false);
  readonly actionError = signal('');
  readonly actionNotice = signal('');
  readonly directionsLoader = (requestId: string): Observable<RepairRoute> =>
    this.repairRequests.getDirections(requestId);
  readonly backRoute = '/shop/jobs/disputed-jobs';
  readonly backLabel = 'Issue Resolution';
  readonly pageTitle = 'Issue Resolution Details';
  readonly disputeRoute = '/shop/disputes';
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
    return this.disputes.get('shop', id).pipe(
      tap((dispute) => this.loadCustomerLocation(dispute.repairRequestId)),
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
    const customer = this.repairRequest()?.customer;
    const name =
      customer?.displayName ||
      [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') ||
      dispute.parties?.customer?.name;
    return name?.trim() || 'Customer';
  }

  customerEmail(dispute: RepairDispute): string {
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

  statusHistoryTitle(
    event: RepairDispute['statusHistory'][number],
    index: number,
  ): string {
    return index === 0 && (event.from === 'NONE' || event.to === 'OPEN')
      ? 'Case opened'
      : this.formatStatus(event.to);
  }

  canSendMessage(dispute: RepairDispute): boolean {
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
      },
    );
  }

  acceptDispute(dispute: RepairDispute): void {
    this.runShopAction(
      this.disputes.accept(dispute._id),
      'Dispute accepted.',
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
      },
    );
  }

  canReviewCustomerResponse(dispute: RepairDispute): boolean {
    return (
      dispute.status === 'AWAITING_SHOP_RESPONSE' &&
      dispute.resolution.state === 'proposed'
    );
  }

  decideResolution(dispute: RepairDispute, decision: 'accept' | 'reject'): void {
    if (!this.canReviewCustomerResponse(dispute)) return;
    const reason = this.resolutionDecisionReason.trim();
    if (decision === 'reject' && !reason) {
      this.actionError.set('Explain why you are rejecting the proposed resolution.');
      return;
    }
    this.runShopAction(
      this.disputes.decideResolution('shop', dispute._id, {
        decision,
        reason: reason || undefined,
      }),
      decision === 'accept' ? 'Resolution accepted.' : 'Resolution rejected.',
      () => {
        this.resolutionDecisionReason = '';
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

