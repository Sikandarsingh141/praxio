import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AdditionalChargeRequestInput,
  InspectionReportInput,
  RepairEstimatePartInput,
  RepairInspectionReport,
  RepairWorkflowImageInput,
} from '../../../shared/models/repair-workflow.models';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogConfig,
} from '../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { canStartRepair } from '../../../shared/utils/repair-authorization.util';
import { ShopRepairRequest } from '../../repair-requests/shop-repair-requests.models';
import { ShopRepairRequestsService } from '../../repair-requests/shop-repair-requests.service';
import { ToastService } from '../../../core/toast/toast.service';

type PartField = 'name' | 'quantity' | 'unitPrice';

const PROBLEM_CATEGORIES = [
  'Hardware Issue',
  'Software Issue',
  'Physical Damage',
  'Electrical Issue',
  'Battery / Power Issue',
  'Display / Screen Issue',
  'Connectivity / Network Issue',
  'Performance Issue',
  'Water / Liquid Damage',
  'Component Failure',
  'Other',
] as const;

type ProblemCategory = (typeof PROBLEM_CATEGORIES)[number];

@Component({
  selector: 'app-shop-repair-workflow',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationDialogComponent],
  templateUrl: './shop-repair-workflow.component.html',
  styleUrl: './shop-repair-workflow.component.scss',
})
export class ShopRepairWorkflowComponent implements OnChanges {
  @Input({ required: true }) request!: ShopRepairRequest;
  @Input() inspectionSubmissionInSidebar = false;
  @Input() startRepairInSidebar = false;
  @Output() readonly requestUpdated = new EventEmitter<ShopRepairRequest>();
  @Output() readonly inspectionStarted = new EventEmitter<void>();

  readonly submitting = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly confirmation = signal<ConfirmationDialogConfig | null>(null);
  readonly inspectionModalOpen = signal(false);
  readonly inspectionParts = signal<RepairEstimatePartInput[]>([
    { name: '', quantity: 1, unitPrice: 0 },
  ]);
  readonly additionalParts = signal<RepairEstimatePartInput[]>([
    { name: '', quantity: 1, unitPrice: 0 },
  ]);
  readonly inspectionImages = signal<File[]>([]);
  readonly additionalImages = signal<File[]>([]);
  readonly inspectionImagesError = signal('');
  readonly additionalImagesError = signal('');
  readonly inspectionFormOpen = signal(false);
  readonly additionalFormOpen = signal(false);
  readonly additionalDraftId = signal<string | undefined>(undefined);
  readonly problemCategories = PROBLEM_CATEGORIES;
  readonly problemCategory = signal<ProblemCategory | ''>('');
  readonly problemOther = signal('');
  readonly identifiedProblem = signal('');
  readonly findings = signal('');
  readonly requiredRepairWork = signal('');
  readonly inspectionLabour = signal(0);
  readonly inspectionCharge = signal(0);
  readonly inspectionOtherCharges = signal(0);
  readonly inspectionTime = signal<number | null>(null);
  readonly inspectionTimeUnit = signal<'hours' | 'days'>('days');
  readonly inspectionWarranty = signal('');
  readonly inspectionMessage = signal('');
  readonly additionalIssue = signal('');
  readonly additionalReason = signal('');
  readonly additionalDescription = signal('');
  readonly additionalLabour = signal(0);
  readonly additionalOtherCharges = signal(0);
  readonly additionalTime = signal<number | null>(null);
  readonly additionalTimeUnit = signal<'hours' | 'days'>('days');
  readonly additionalMessage = signal('');
  readonly blocksRepair = signal(false);
  readonly inspectionPartsTotal = computed(() => this.partsTotal(this.inspectionParts()));
  readonly inspectionTotal = computed(
    () =>
      this.inspectionPartsTotal() +
      this.amount(this.inspectionLabour()) +
      this.amount(this.inspectionCharge()) +
      this.amount(this.inspectionOtherCharges()),
  );
  readonly additionalPartsTotal = computed(() => this.partsTotal(this.additionalParts()));
  readonly additionalTotal = computed(
    () =>
      this.additionalPartsTotal() +
      this.amount(this.additionalLabour()) +
      this.amount(this.additionalOtherCharges()),
  );

  constructor(
    private readonly requests: ShopRepairRequestsService,
    private readonly toastService: ToastService,
  ) {}

  inspectionPartsForDisplay(
    parts: RepairInspectionReport['parts'],
  ): RepairInspectionReport['parts'] {
    return Array.isArray(parts) ? parts : [];
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['request']) return;

    this.inspectionModalOpen.set(false);
    const inspection = this.job?.inspection;
    if (inspection && ['in_progress', 'draft'].includes(inspection.status)) {
      const storedProblem = inspection.identifiedProblem?.trim() || '';
      const otherPrefix = 'Other:';
      const otherProblem = storedProblem.startsWith(otherPrefix)
        ? storedProblem.slice(otherPrefix.length).trim()
        : '';
      const matchedCategory = PROBLEM_CATEGORIES.find(
        (category) => category === storedProblem,
      );
      const legacyProblem =
        storedProblem.length > 0 &&
        !matchedCategory &&
        !storedProblem.startsWith(otherPrefix);
      const useOther =
        otherProblem.length > 0 || legacyProblem || storedProblem === otherPrefix;
      this.identifiedProblem.set(storedProblem);
      this.problemCategory.set(useOther ? 'Other' : matchedCategory ?? '');
      this.problemOther.set(
        useOther ? otherProblem || (legacyProblem ? storedProblem : '') : '',
      );
      this.findings.set(inspection.findings ?? '');
      this.requiredRepairWork.set(inspection.requiredRepairWork ?? '');
      const inspectionParts = inspection.parts ?? [];
      this.inspectionParts.set(
        inspectionParts.length
          ? inspectionParts.map(({ name, quantity, unitPrice }) => ({
              name,
              quantity,
              unitPrice,
            }))
          : [{ name: '', quantity: 1, unitPrice: 0 }],
      );
      this.inspectionLabour.set(inspection.labourCharge);
      this.inspectionCharge.set(inspection.inspectionCharges);
      this.inspectionOtherCharges.set(inspection.otherCharges);
      this.inspectionTime.set(inspection.estimatedTimeValue ?? null);
      this.inspectionTimeUnit.set(inspection.estimatedTimeUnit ?? 'days');
      this.inspectionWarranty.set(inspection.warranty ?? '');
      this.inspectionMessage.set(inspection.message ?? '');
    } else {
      this.identifiedProblem.set('');
      this.problemCategory.set('');
      this.problemOther.set('');
    }

    const draft = this.job?.additionalChargeRequests?.find((charge) => charge.status === 'draft');
    if (!draft) {
      this.resetAdditionalForm();
      return;
    }

    this.additionalDraftId.set(draft._id);
    this.additionalIssue.set(draft.issue ?? '');
    this.additionalReason.set(draft.reason ?? '');
    this.additionalDescription.set(draft.repairDescription ?? '');
    const draftParts = draft.parts ?? [];
    this.additionalParts.set(
      draftParts.length
        ? draftParts.map(({ name, quantity, unitPrice }) => ({ name, quantity, unitPrice }))
        : [{ name: '', quantity: 1, unitPrice: 0 }],
    );
    this.additionalLabour.set(draft.labourCharge);
    this.additionalOtherCharges.set(draft.otherCharges);
    this.blocksRepair.set(draft.blocksRepair);
    this.additionalTime.set(draft.estimatedTimeValue ?? null);
    this.additionalTimeUnit.set(draft.estimatedTimeUnit ?? 'days');
    this.additionalMessage.set(draft.message ?? '');
    this.additionalFormOpen.set(true);
  }

  get job() {
    return this.request.repairJob;
  }

  get acceptedQuotation() {
    return this.request.quotations.find((quotation) => quotation.status === 'accepted');
  }

  get approvedTotal(): number {
    return (this.job?.approvedRepairAmount ?? 0) + (this.job?.approvedAdditionalCharges ?? 0);
  }

  get pendingAdditionalTotal(): number {
    return (this.job?.additionalChargeRequests ?? [])
      .filter((charge) => charge.status === 'pending')
      .reduce((total, charge) => total + charge.amount, 0);
  }

  get rejectedAdditionalTotal(): number {
    return (this.job?.additionalChargeRequests ?? [])
      .filter((charge) => charge.status === 'rejected')
      .reduce((total, charge) => total + charge.amount, 0);
  }

  get canStartRepair(): boolean {
    return canStartRepair(this.job, this.acceptedQuotation?.status);
  }

  openInspectionModal(): void {
    this.error.set('');
    this.inspectionModalOpen.set(true);
  }

  closeInspectionModal(): void {
    this.inspectionModalOpen.set(false);
  }

  startInspection(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.error.set('');
    this.requests.startInspection(this.request._id).subscribe({
      next: () => {
        this.inspectionStarted.emit();
        this.reloadRequest('Inspection started.');
      },
      error: (error: HttpErrorResponse) => this.fail(error, 'Inspection could not be started.'),
    });
  }

  updatePart(
    list: 'inspection' | 'additional',
    index: number,
    field: PartField,
    value: string | number,
  ): void {
    const target = list === 'inspection' ? this.inspectionParts : this.additionalParts;
    target.update((parts) =>
      parts.map((part, partIndex) =>
        partIndex === index
          ? {
              ...part,
              [field]: field === 'name' ? String(value) : Math.max(0, Number(value) || 0),
            }
          : part,
      ),
    );
  }

  addPart(list: 'inspection' | 'additional'): void {
    const target = list === 'inspection' ? this.inspectionParts : this.additionalParts;
    target.update((parts) => [...parts, { name: '', quantity: 1, unitPrice: 0 }]);
  }

  removePart(list: 'inspection' | 'additional', index: number): void {
    const target = list === 'inspection' ? this.inspectionParts : this.additionalParts;
    target.update((parts) =>
      parts.length > 1 ? parts.filter((_, partIndex) => partIndex !== index) : parts,
    );
  }

  chooseImages(event: Event, type: 'inspection' | 'additional'): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    const error = type === 'inspection' ? this.inspectionImagesError : this.additionalImagesError;
    const target = type === 'inspection' ? this.inspectionImages : this.additionalImages;
    error.set('');
    if (files.length > 8 || files.some((file) => !/^image\/(jpeg|png|webp)$/.test(file.type))) {
      error.set('Choose up to 8 JPG, PNG, or WebP images.');
      input.value = '';
      return;
    }
    if (files.some((file) => file.size > 2_000_000)) {
      error.set('Each image must be smaller than 2 MB.');
      input.value = '';
      return;
    }
    if (files.reduce((total, file) => total + file.size, 0) > 1_200_000) {
      error.set('The selected images must total no more than 1.2 MB.');
      input.value = '';
      return;
    }
    target.set(files);
  }

  async saveInspection(action: 'draft' | 'submit'): Promise<void> {
    if (this.submitting()) return;
    const category = this.problemCategory();
    const problemOther = this.problemOther().trim();
    const identifiedProblem =
      category === 'Other' ? `Other: ${problemOther}` : category;
    const missingOther = category === 'Other' && !problemOther;

    if (
      action === 'submit' &&
      (!category ||
        missingOther ||
        !this.findings().trim() ||
        !this.requiredRepairWork().trim() ||
        this.inspectionTotal() <= 0)
    ) {
      this.error.set(
        'Select a problem category, specify it if Other, and complete Diagnosis & Inspection Findings, Recommended Repair Work, and a valid repair estimate.',
      );
      return;
    }

    this.identifiedProblem.set(identifiedProblem);

    try {
      const input: InspectionReportInput = {
        action,
        identifiedProblem: identifiedProblem || undefined,
        findings: this.findings(),
        requiredRepairWork: this.requiredRepairWork(),
        parts: this.nonEmptyParts(this.inspectionParts()),
        labourCharge: this.amount(this.inspectionLabour()),
        inspectionCharges: this.amount(this.inspectionCharge()),
        otherCharges: this.amount(this.inspectionOtherCharges()),
        estimatedTimeValue: this.inspectionTime() ?? undefined,
        estimatedTimeUnit: this.inspectionTimeUnit(),
        warranty: this.inspectionWarranty(),
        images: this.inspectionImages().length
          ? await this.encodeImages(this.inspectionImages())
          : undefined,
        message: this.inspectionMessage(),
      };
      this.submitting.set(true);
      this.error.set('');
      this.requests.saveInspection(this.request._id, input).subscribe({
        next: () => {
          this.inspectionModalOpen.set(false);
          this.reloadRequest(
            action === 'submit'
              ? 'Inspection report sent to the customer for approval.'
              : 'Inspection draft saved.',
          );
        },
        error: (error: HttpErrorResponse) =>
          this.fail(error, 'Inspection report could not be saved.'),
      });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Images could not be read.');
    }
  }

  startRepair(): void {
    if (this.submitting() || !this.canStartRepair) return;
    this.confirmation.set({
      title: 'Start repair?',
      message: `Start this repair using the customer-approved estimate of ${this.approvedTotal.toFixed(2)}?`,
      confirmLabel: 'Start repair',
      cancelLabel: 'Cancel',
    });
  }

  cancelConfirmation(): void {
    this.confirmation.set(null);
  }

  confirmStartRepair(): void {
    this.confirmation.set(null);
    if (this.submitting() || !this.canStartRepair) return;
    this.submitting.set(true);
    this.error.set('');
    this.requests.startApprovedRepair(this.request._id).subscribe({
      next: () => this.reloadRequest('Repair started.'),
      error: (error: HttpErrorResponse) => this.fail(error, 'Repair could not be started.'),
    });
  }

  async submitAdditionalCharges(action: 'draft' | 'submit'): Promise<void> {
    if (this.submitting()) return;
    if (
      action === 'submit' &&
      (!this.additionalIssue().trim() ||
        !this.additionalReason().trim() ||
        !this.additionalDescription().trim() ||
        this.additionalTotal() <= 0)
    ) {
      this.error.set('Complete the additional-work details and enter a charge amount.');
      return;
    }
    try {
      const input: AdditionalChargeRequestInput = {
        action,
        draftId: this.additionalDraftId(),
        issue: this.additionalIssue(),
        reason: this.additionalReason(),
        repairDescription: this.additionalDescription(),
        parts: this.nonEmptyParts(this.additionalParts()),
        labourCharge: this.amount(this.additionalLabour()),
        otherCharges: this.amount(this.additionalOtherCharges()),
        blocksRepair: this.blocksRepair(),
        estimatedTimeValue: this.additionalTime() ?? undefined,
        estimatedTimeUnit: this.additionalTimeUnit(),
        images: this.additionalImages().length
          ? await this.encodeImages(this.additionalImages())
          : undefined,
        message: this.additionalMessage(),
      };
      this.submitting.set(true);
      this.error.set('');
      this.requests.requestAdditionalCharges(this.request._id, input).subscribe({
        next: (charge) => {
          this.additionalDraftId.set(action === 'draft' ? charge._id : undefined);
          this.additionalFormOpen.set(action === 'draft');
          this.reloadRequest(
            action === 'submit'
              ? 'Additional-charge request sent to the customer.'
              : 'Additional-charge draft saved.',
          );
        },
        error: (error: HttpErrorResponse) =>
          this.fail(error, 'Additional-charge request could not be saved.'),
      });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Images could not be read.');
    }
  }

  private reloadRequest(message: string): void {
    this.requests.get(this.request._id).subscribe({
      next: (request) => {
        this.requestUpdated.emit(request);
        this.toastService.success('Repair Workflow', message);
        this.submitting.set(false);
        if (request.repairJob?.inspection?.status === 'awaiting_approval') {
          this.inspectionFormOpen.set(false);
        }
        if (
          this.additionalDraftId() === undefined &&
          request.repairJob?.additionalChargeRequests?.some((charge) => charge.status === 'pending')
        ) {
          this.additionalFormOpen.set(false);
        }
      },
      error: (error: HttpErrorResponse) =>
        this.fail(error, 'Updated repair details could not be loaded.'),
    });
  }

  private fail(error: HttpErrorResponse, fallback: string): void {
    const msg = error.error?.message || fallback;
    this.error.set(msg);
    this.toastService.error('Workflow Error', msg);
    this.submitting.set(false);
  }

  private resetAdditionalForm(): void {
    this.additionalDraftId.set(undefined);
    this.additionalFormOpen.set(false);
    this.additionalIssue.set('');
    this.additionalReason.set('');
    this.additionalDescription.set('');
    this.additionalParts.set([{ name: '', quantity: 1, unitPrice: 0 }]);
    this.additionalLabour.set(0);
    this.additionalOtherCharges.set(0);
    this.additionalTime.set(null);
    this.additionalTimeUnit.set('days');
    this.additionalMessage.set('');
    this.additionalImages.set([]);
    this.additionalImagesError.set('');
    this.blocksRepair.set(false);
  }

  private amount(value: number): number {
    return Math.max(0, Number(value) || 0);
  }

  private partsTotal(parts: RepairEstimatePartInput[]): number {
    return parts.reduce(
      (total, part) => total + this.amount(part.quantity) * this.amount(part.unitPrice),
      0,
    );
  }

  private nonEmptyParts(parts: RepairEstimatePartInput[]): RepairEstimatePartInput[] {
    return parts
      .filter((part) => part.name.trim())
      .map((part) => ({
        name: part.name.trim(),
        quantity: Math.max(1, Math.floor(part.quantity)),
        unitPrice: this.amount(part.unitPrice),
      }));
  }

  private encodeImages(files: File[]): Promise<RepairWorkflowImageInput[]> {
    return Promise.all(
      files.map(
        (file) =>
          new Promise<RepairWorkflowImageInput>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result !== 'string') {
                reject(new Error('An image could not be read.'));
                return;
              }
              resolve({ mimeType: file.type, data: reader.result });
            };
            reader.onerror = () => reject(new Error('An image could not be read.'));
            reader.readAsDataURL(file);
          }),
      ),
    );
  }
}
