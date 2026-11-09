import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CustomerPortalService } from '../customer/customer-portal.service';
import {
  DisputeAttachment,
  DisputeCategory,
  DisputeListResult,
  DisputePriority,
  DisputeRole,
  DisputeStatus,
  RepairDispute,
} from './disputes.models';
import { DisputesService } from './disputes.service';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogConfig,
} from './confirmation-dialog.component';

type DisputeConfirmationAction = 'confirmResolution' | 'closeDispute';

const DISPUTE_CATEGORIES: Array<{ value: DisputeCategory; label: string }> = [
  { value: 'same_issue_exists', label: 'Same issue still exists' },
  { value: 'repair_quality', label: 'Repair quality' },
  { value: 'device_not_working', label: 'Device is not working properly' },
  { value: 'new_issue_discovered', label: 'New issue discovered' },
  { value: 'unauthorized_work', label: 'Unauthorized work' },
  { value: 'incorrect_charges', label: 'Incorrect charges' },
  { value: 'overcharge', label: 'Overcharge' },
  { value: 'incomplete_repair', label: 'Incomplete repair' },
  { value: 'item_not_returned', label: 'Item not returned' },
  { value: 'device_damaged', label: 'Device damaged' },
  { value: 'shop_unresponsive', label: 'Shop unresponsive' },
  { value: 'payment', label: 'Payment issue' },
  { value: 'collection', label: 'Collection issue' },
  { value: 'other', label: 'Other' },
];

@Component({
  selector: 'app-dispute-center',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ConfirmationDialogComponent],
  templateUrl: './dispute-center.component.html',
  styleUrl: './dispute-center.component.scss',
})
export class DisputeCenterComponent implements OnInit {
  readonly role = signal<DisputeRole>('customer');
  readonly mode = signal<'list' | 'detail' | 'create'>('list');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly confirmation = signal<ConfirmationDialogConfig | null>(null);
  readonly list = signal<DisputeListResult | null>(null);
  readonly dispute = signal<RepairDispute | null>(null);
  readonly repairSummary = signal<{
    appliance: string;
    brand?: string;
    model?: string;
    status?: string;
  } | null>(null);
  readonly categories = DISPUTE_CATEGORIES;
  readonly activeAttachmentUrls = new Map<string, string>();

  search = '';
  statusFilter: DisputeStatus | '' = '';
  priorityFilter: DisputePriority | '' = '';
  fromDate = '';
  toDate = '';
  sortOrder: 'newest' | 'oldest' | 'priority' = 'newest';
  category = 'repair_quality';
  description = '';
  customerComments = '';
  attachments: DisputeAttachment[] = [];
  conversationAttachments: DisputeAttachment[] = [];
  completionDocuments: DisputeAttachment[] = [];
  message = '';
  selectedPriority = 'normal';
  internalNote = '';
  rejectionReason = '';
  rejectionExplanation = '';
  reinspectionFindings = '';
  identifiedProblem = '';
  requiredRepairWork = '';
  partsRequired = '';
  labourCharges: number | null = null;
  otherCharges: number | null = null;
  estimatedCompletionTime = '';
  reinspectionMessage = '';
  chargeReason = '';
  chargeItems: Array<{ description: string; amount: number | null }> = [
    { description: '', amount: null },
  ];
  chargeMessage = '';
  progressNotes = '';
  reworkDescription = '';
  partsReplaced = '';
  testingResults = '';
  finalNotes = '';
  reworkTested = false;
  verificationNotes = '';
  unresolvedNotes = '';
  closeReason = '';

  private repairRequestId = '';
  private confirmationAction: DisputeConfirmationAction | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly disputes: DisputesService,
    private readonly customerPortal: CustomerPortalService,
  ) {}

  ngOnInit(): void {
    const segments = this.router.url.split('?')[0].split('/').filter(Boolean);
    const requestedRole = segments[0];
    this.role.set(
      requestedRole === 'admin' || requestedRole === 'shop' ? requestedRole : 'customer',
    );
    this.route.paramMap.subscribe((params) => {
      this.error.set('');
      this.notice.set('');
      this.dispute.set(null);
      this.repairRequestId = params.get('repairRequestId') ?? '';
      const id = params.get('id');
      if (this.repairRequestId) {
        this.mode.set('create');
        this.loadRepairSummary();
      } else if (id) {
        this.mode.set('detail');
        this.loadDetail(id);
      } else {
        this.mode.set('list');
        this.loadList();
      }
    });
    this.route.queryParamMap.subscribe((params) => {
      const description = params.get('description');
      if (description && this.mode() === 'create') {
        this.description = description;
      }
    });
  }

  page = 1;

  applyFilters(): void {
    this.page = 1;
    this.loadList();
  }

  changePage(delta: number): void {
    const pages = this.list()?.pagination.totalPages ?? 1;
    this.page = Math.min(pages, Math.max(1, this.page + delta));
    this.loadList();
  }

  loadList(): void {
    if (this.fromDate && this.toDate && this.fromDate > this.toDate) {
      this.error.set('The start date must not be later than the end date.');
      this.loading.set(false);
      return;
    }
    this.error.set('');
    this.loading.set(true);
    this.disputes
      .list(this.role(), {
        search: this.search.trim() || undefined,
        status: this.statusFilter,
        category: this.categoryFilter,
        priority: this.priorityFilter,
        from: this.fromDate,
        to: this.toDate,
        sort: this.sortOrder,
        page: this.page,
        limit: 25,
      })
      .subscribe({
        next: (result) => {
          this.list.set(result);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => this.fail(error, 'Disputes could not be loaded.'),
      });
  }

  loadDetail(id: string): void {
    this.loading.set(true);
    this.disputes.get(this.role(), id).subscribe({
      next: (dispute) => {
        this.dispute.set(dispute);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => this.fail(error, 'Dispute details could not be loaded.'),
    });
  }

  loadRepairSummary(): void {
    this.loading.set(true);
    this.customerPortal.getRepairJob(this.repairRequestId).subscribe({
      next: (request) => {
        this.repairSummary.set({
          appliance: request.appliance,
          brand: request.brand,
          model: request.model,
          status: request.repairJob?.status,
        });
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => this.fail(error, 'Repair details could not be loaded.'),
    });
  }

  createDispute(): void {
    if (!this.description.trim()) {
      this.error.set('Describe the problem found after receiving the repaired device.');
      return;
    }
    this.run(
      this.disputes.create(this.repairRequestId, {
        category: this.category,
        description: this.description.trim(),
        attachments: this.attachments,
        customerComments: this.customerComments.trim() || undefined,
      }),
      'Dispute submitted.',
      (dispute) => void this.router.navigate(['/customer/disputes', dispute._id]),
    );
  }

  sendMessage(): void {
    const dispute = this.dispute();
    if (!dispute || !this.message.trim()) return;
    this.run(
      this.disputes.sendMessage(this.role(), dispute._id, {
        message: this.message.trim(),
        attachments: this.conversationAttachments,
      }),
      'Message sent.',
      (updated) => {
        this.message = '';
        this.conversationAttachments = [];
        this.dispute.set(updated);
      },
    );
  }

  addInternalNote(): void {
    const dispute = this.dispute();
    if (!dispute || !this.internalNote.trim()) return;
    this.run(
      this.disputes.addInternalNote(dispute._id, this.internalNote.trim()),
      'Private note saved.',
      (updated) => {
        this.internalNote = '';
        this.dispute.set(updated);
      },
    );
  }

  acceptDispute(): void {
    const dispute = this.dispute();
    if (!dispute) return;
    this.run(this.disputes.accept(dispute._id), 'Dispute accepted.', (updated) =>
      this.dispute.set(updated),
    );
  }

  rejectDispute(): void {
    const dispute = this.dispute();
    if (!dispute || !this.rejectionReason.trim() || !this.rejectionExplanation.trim()) {
      this.error.set('Provide a rejection reason and explanation.');
      return;
    }
    this.run(
      this.disputes.reject(dispute._id, {
        reason: this.rejectionReason.trim(),
        explanation: this.rejectionExplanation.trim(),
        attachments: this.conversationAttachments,
      }),
      'Dispute response sent to the customer.',
      (updated) => {
        this.rejectionReason = '';
        this.rejectionExplanation = '';
        this.conversationAttachments = [];
        this.dispute.set(updated);
      },
    );
  }

  startReinspection(): void {
    const dispute = this.dispute();
    if (!dispute) return;
    this.run(this.disputes.startReinspection(dispute._id), 'Reinspection started.', (updated) =>
      this.dispute.set(updated),
    );
  }

  submitReinspection(): void {
    const dispute = this.dispute();
    if (
      !dispute ||
      !this.reinspectionFindings.trim() ||
      !this.identifiedProblem.trim() ||
      !this.requiredRepairWork.trim()
    ) {
      this.error.set('Complete the findings, problem identified, and required repair work.');
      return;
    }
    this.run(
      this.disputes.submitReinspection(dispute._id, {
        findings: this.reinspectionFindings.trim(),
        identifiedProblem: this.identifiedProblem.trim(),
        requiredRepairWork: this.requiredRepairWork.trim(),
        partsRequired: this.partsRequired.trim() || undefined,
        labourCharges: this.labourCharges ?? undefined,
        otherCharges: this.otherCharges ?? undefined,
        estimatedCompletionTime: this.estimatedCompletionTime.trim() || undefined,
        message: this.reinspectionMessage.trim() || undefined,
        attachments: this.conversationAttachments,
      }),
      'Reinspection findings submitted.',
      (updated) => {
        this.conversationAttachments = [];
        this.dispute.set(updated);
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

  requestCharges(): void {
    const dispute = this.dispute();
    const items = this.chargeItems.map((item) => ({
      description: item.description.trim(),
      amount: item.amount,
    }));
    if (
      !dispute ||
      !this.chargeReason.trim() ||
      items.some((item) => !item.description || item.amount === null || item.amount < 0)
    ) {
      this.error.set('Enter a reason and a description and amount for each charge item.');
      return;
    }
    this.run(
      this.disputes.requestAdditionalCharges(dispute._id, {
        reason: this.chargeReason.trim(),
        items: items.map((item) => ({
          description: item.description,
          amount: item.amount as number,
        })),
        message: this.chargeMessage.trim() || undefined,
      }),
      'Additional charges sent to the customer for approval.',
      (updated) => this.dispute.set(updated),
    );
  }

  decideCharges(chargeId: string, decision: 'accept' | 'decline'): void {
    const dispute = this.dispute();
    if (!dispute) return;
    this.run(
      this.disputes.decideAdditionalCharges(
        dispute._id,
        chargeId,
        decision,
        decision === 'decline' ? this.message.trim() : undefined,
      ),
      decision === 'accept' ? 'Additional charges approved.' : 'Additional charges declined.',
      (updated) => {
        this.message = '';
        this.dispute.set(updated);
      },
    );
  }

  startRework(): void {
    const dispute = this.dispute();
    if (!dispute) return;
    this.run(this.disputes.startRework(dispute._id), 'Rework started.', (updated) =>
      this.dispute.set(updated),
    );
  }

  addReworkProgress(): void {
    const dispute = this.dispute();
    if (!dispute || !this.progressNotes.trim()) {
      this.error.set('Enter a progress update.');
      return;
    }
    this.run(
      this.disputes.addProgress(dispute._id, {
        notes: this.progressNotes.trim(),
        attachments: this.conversationAttachments,
      }),
      'Progress update added.',
      (updated) => {
        this.progressNotes = '';
        this.conversationAttachments = [];
        this.dispute.set(updated);
      },
    );
  }

  completeRework(): void {
    const dispute = this.dispute();
    if (!dispute || !this.reworkDescription.trim() || !this.testingResults.trim()) {
      this.error.set('Enter the work performed and device testing results.');
      return;
    }
    if (!this.reworkTested) {
      this.error.set('Confirm that the device has been tested before completion.');
      return;
    }
    this.run(
      this.disputes.completeRework(dispute._id, {
        workPerformed: this.reworkDescription.trim(),
        partsReplaced: this.partsReplaced.trim() || undefined,
        testingResults: this.testingResults.trim(),
        finalNotes: this.finalNotes.trim() || undefined,
        tested: this.reworkTested,
        attachments: this.completionDocuments,
      }),
      'Rework marked complete. The customer has been asked to verify the repair.',
      (updated) => this.dispute.set(updated),
    );
  }

  confirmResolution(): void {
    const dispute = this.dispute();
    if (!dispute || !this.verificationNotes.trim()) {
      this.error.set('Confirm the repair and add a short note before continuing.');
      return;
    }
    this.confirmationAction = 'confirmResolution';
    this.confirmation.set({
      title: 'Confirm repair resolution?',
      message: 'Confirm that the repaired device is working and the issue is resolved?',
      confirmLabel: 'Confirm resolution',
      cancelLabel: 'Cancel',
    });
  }

  closeConfirmation(): void {
    this.confirmationAction = null;
    this.confirmation.set(null);
  }

  confirmPendingAction(): void {
    const action = this.confirmationAction;
    this.closeConfirmation();
    if (action === 'confirmResolution') {
      this.submitResolutionConfirmation();
    } else if (action === 'closeDispute') {
      this.submitDisputeClosure();
    }
  }

  private submitResolutionConfirmation(): void {
    const dispute = this.dispute();
    if (!dispute || !this.verificationNotes.trim()) return;
    this.run(
      this.disputes.confirmResolution(dispute._id, { message: this.verificationNotes.trim() }),
      'Thank you. The shop can now close the dispute.',
      (updated) => this.dispute.set(updated),
    );
  }

  reportUnresolved(): void {
    const dispute = this.dispute();
    if (!dispute || !this.unresolvedNotes.trim()) {
      this.error.set('Describe what is still not working.');
      return;
    }
    this.run(
      this.disputes.reportUnresolved(dispute._id, {
        notes: this.unresolvedNotes.trim(),
        attachments: this.conversationAttachments,
      }),
      'The shop has been notified that the issue remains.',
      (updated) => {
        this.unresolvedNotes = '';
        this.conversationAttachments = [];
        this.dispute.set(updated);
      },
    );
  }

  closeDispute(): void {
    const dispute = this.dispute();
    if (!dispute || !this.closeReason.trim()) {
      this.error.set('Enter a final closure note.');
      return;
    }
    this.confirmationAction = 'closeDispute';
    this.confirmation.set({
      title: 'Close dispute?',
      message: 'The customer has confirmed the repair is resolved. Close this dispute?',
      confirmLabel: 'Close dispute',
      cancelLabel: 'Cancel',
      destructive: true,
    });
  }

  private submitDisputeClosure(): void {
    const dispute = this.dispute();
    if (!dispute || !this.closeReason.trim()) return;
    this.run(
      this.disputes.close(dispute._id, this.closeReason.trim()),
      'Dispute closed.',
      (updated) => this.dispute.set(updated),
    );
  }

  async onFilesSelected(event: Event): Promise<void> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.files?.length) return;
    const files = Array.from(input.files);
    if (files.length + this.attachments.length > 2) {
      this.error.set('Attach up to two files, each no larger than 500 KB.');
      input.value = '';
      return;
    }
    try {
      const attachments = await Promise.all(files.map((file) => this.readAttachment(file)));
      this.attachments = [...this.attachments, ...attachments];
      this.error.set('');
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'The selected files could not be read.',
      );
    } finally {
      input.value = '';
    }
  }

  async onCompletionFilesSelected(event: Event): Promise<void> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.files?.length) return;
    const files = Array.from(input.files);
    if (files.length + this.completionDocuments.length > 2) {
      this.error.set('Attach up to two completion evidence files, each no larger than 500 KB.');
      input.value = '';
      return;
    }
    try {
      const documents = await Promise.all(files.map((file) => this.readAttachment(file)));
      this.completionDocuments = [...this.completionDocuments, ...documents];
      this.error.set('');
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'The selected files could not be read.',
      );
    } finally {
      input.value = '';
    }
  }

  async onConversationFilesSelected(event: Event): Promise<void> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.files?.length) return;
    const files = Array.from(input.files);
    if (files.length + this.conversationAttachments.length > 2) {
      this.error.set('Attach up to two message files, each no larger than 500 KB.');
      input.value = '';
      return;
    }
    try {
      const attachments = await Promise.all(files.map((file) => this.readAttachment(file)));
      this.conversationAttachments = [...this.conversationAttachments, ...attachments];
      this.error.set('');
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'The selected files could not be read.',
      );
    } finally {
      input.value = '';
    }
  }

  removeAttachment(index: number): void {
    this.attachments = this.attachments.filter((_, itemIndex) => itemIndex !== index);
  }

  removeCompletionDocument(index: number): void {
    this.completionDocuments = this.completionDocuments.filter(
      (_, itemIndex) => itemIndex !== index,
    );
  }

  removeConversationAttachment(index: number): void {
    this.conversationAttachments = this.conversationAttachments.filter(
      (_, itemIndex) => itemIndex !== index,
    );
  }

  attachmentUrl(attachment: DisputeAttachment): string {
    return `data:${attachment.mimeType};base64,${attachment.data}`;
  }

  repairStatus(repair: NonNullable<RepairDispute['repair']>): string {
    return String(repair.repairJob?.['status'] || repair.status);
  }

  get isRepairEligible(): boolean {
    return ['picked_up', 'completed'].includes(this.repairSummary()?.status ?? '');
  }

  get categoryFilter(): DisputeCategory | '' {
    return this.selectedCategory;
  }
  set categoryFilter(value: DisputeCategory | '') {
    this.selectedCategory = value;
  }

  private selectedCategory: DisputeCategory | '' = '';

  get canSendMessage(): boolean {
    return this.dispute()?.status !== 'CLOSED';
  }

  get latestCharge() {
    return this.dispute()?.additionalCharges?.at(-1);
  }

  get latestReinspection() {
    return this.dispute()?.reinspections?.at(-1);
  }

  get latestCompletion() {
    return this.dispute()?.reworkCompletions?.at(-1);
  }

  get latestVerification() {
    return this.dispute()?.verificationHistory?.at(-1);
  }

  private readAttachment(file: File): Promise<DisputeAttachment> {
    const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
    if (!acceptedTypes.includes(file.type as (typeof acceptedTypes)[number])) {
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

  private run(
    request: import('rxjs').Observable<RepairDispute>,
    successMessage: string,
    onSuccess: (dispute: RepairDispute) => void,
  ): void {
    this.saving.set(true);
    this.error.set('');
    this.notice.set('');
    request.subscribe({
      next: (dispute) => {
        this.saving.set(false);
        this.notice.set(successMessage);
        onSuccess(dispute);
      },
      error: (error: HttpErrorResponse) =>
        this.fail(error, 'The requested dispute action could not be completed.'),
    });
  }

  private fail(error: HttpErrorResponse, fallback: string): void {
    this.error.set(error.error?.message || fallback);
    this.loading.set(false);
    this.saving.set(false);
  }
}
