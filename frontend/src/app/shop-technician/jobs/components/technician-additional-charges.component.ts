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
import { finalize } from 'rxjs';
import { ToastService } from '../../../core/toast/toast.service';
import {
  AdditionalChargeRequest,
  AdditionalChargeRequestInput,
  RepairEstimatePartInput,
  RepairWorkflowImageInput,
  RepairWorkflowJob,
} from '../../../shared/models/repair-workflow.models';
import { TechnicianRepairDetails } from '../../../shop/technicians/technicians.models';
import { TechniciansService } from '../../../shop/technicians/technicians.service';

type PartField = 'name' | 'quantity' | 'unitPrice';

@Component({
  selector: 'app-technician-additional-charges',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './technician-additional-charges.component.html',
  styleUrl: './technician-additional-charges.component.scss',
})
export class TechnicianAdditionalChargesComponent implements OnChanges {
  @Input({ required: true }) requestId!: string;
  @Input({ required: true }) repairJob!: RepairWorkflowJob;
  @Input() currency = 'USD';
  @Output() readonly requestUpdated = new EventEmitter<TechnicianRepairDetails>();

  readonly submitting = signal(false);
  readonly error = signal('');
  readonly issue = signal('');
  readonly reason = signal('');
  readonly repairDescription = signal('');
  readonly parts = signal<RepairEstimatePartInput[]>([{ name: '', quantity: 1, unitPrice: 0 }]);
  readonly labourCharge = signal(0);
  readonly otherCharges = signal(0);
  readonly blocksRepair = signal(false);
  readonly estimatedTimeValue = signal<number | null>(null);
  readonly estimatedTimeUnit = signal<'hours' | 'days'>('days');
  readonly message = signal('');
  readonly images = signal<File[]>([]);
  readonly imagesError = signal('');
  readonly draftId = signal<string | undefined>(undefined);
  readonly formOpen = signal(false);
  readonly partsTotal = computed(() => this.parts().reduce(
    (total, part) => total + this.amount(part.quantity) * this.amount(part.unitPrice),
    0,
  ));
  readonly total = computed(
    () => this.partsTotal() + this.amount(this.labourCharge()) + this.amount(this.otherCharges()),
  );

  constructor(
    private readonly technicians: TechniciansService,
    private readonly toast: ToastService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['repairJob']) return;
    const draft = this.repairJob.additionalChargeRequests?.find(
      (charge) => charge.status === 'draft',
    );
    if (draft) {
      this.loadDraft(draft);
    } else {
      this.resetForm();
    }
  }

  updatePart(index: number, field: PartField, value: string | number): void {
    this.parts.update((parts) =>
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

  addPart(): void {
    this.parts.update((parts) => [...parts, { name: '', quantity: 1, unitPrice: 0 }]);
  }

  removePart(index: number): void {
    this.parts.update((parts) =>
      parts.length > 1 ? parts.filter((_, partIndex) => partIndex !== index) : parts,
    );
  }

  chooseImages(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.imagesError.set('');
    if (files.length > 8 || files.some((file) => !/^image\/(jpeg|png|webp)$/.test(file.type))) {
      this.imagesError.set('Choose up to 8 JPG, PNG, or WebP images.');
      input.value = '';
      return;
    }
    if (files.some((file) => file.size > 2_000_000)) {
      this.imagesError.set('Each image must be smaller than 2 MB.');
      input.value = '';
      return;
    }
    if (files.reduce((sum, file) => sum + file.size, 0) > 1_200_000) {
      this.imagesError.set('The selected images must total no more than 1.2 MB.');
      input.value = '';
      return;
    }
    this.images.set(files);
  }

  async save(action: 'draft' | 'submit'): Promise<void> {
    if (this.submitting()) return;
    if (
      action === 'submit' &&
      (!this.issue().trim() ||
        !this.reason().trim() ||
        !this.repairDescription().trim() ||
        this.total() <= 0)
    ) {
      this.error.set('Complete the additional-work details and enter a charge amount.');
      return;
    }
    try {
      const input: AdditionalChargeRequestInput = {
        action,
        draftId: this.draftId(),
        issue: this.issue(),
        reason: this.reason(),
        repairDescription: this.repairDescription(),
        parts: this.nonEmptyParts(this.parts()),
        labourCharge: this.amount(this.labourCharge()),
        otherCharges: this.amount(this.otherCharges()),
        blocksRepair: this.blocksRepair(),
        estimatedTimeValue: this.estimatedTimeValue() ?? undefined,
        estimatedTimeUnit: this.estimatedTimeUnit(),
        images: this.images().length ? await this.encodeImages(this.images()) : undefined,
        message: this.message(),
      };
      this.submitting.set(true);
      this.error.set('');
      this.technicians
        .requestAdditionalCharges(this.requestId, input)
        .pipe(finalize(() => this.submitting.set(false)))
        .subscribe({
          next: (charge) => {
            this.draftId.set(action === 'draft' ? charge._id : undefined);
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

  private loadDraft(draft: AdditionalChargeRequest): void {
    this.draftId.set(draft._id);
    this.issue.set(draft.issue ?? '');
    this.reason.set(draft.reason ?? '');
    this.repairDescription.set(draft.repairDescription ?? '');
    this.parts.set(
      draft.parts?.length
        ? draft.parts.map(({ name, quantity, unitPrice }) => ({ name, quantity, unitPrice }))
        : [{ name: '', quantity: 1, unitPrice: 0 }],
    );
    this.labourCharge.set(draft.labourCharge);
    this.otherCharges.set(draft.otherCharges);
    this.blocksRepair.set(draft.blocksRepair);
    this.estimatedTimeValue.set(draft.estimatedTimeValue ?? null);
    this.estimatedTimeUnit.set(draft.estimatedTimeUnit ?? 'days');
    this.message.set(draft.message ?? '');
    this.formOpen.set(true);
  }

  private resetForm(): void {
    this.draftId.set(undefined);
    this.formOpen.set(false);
    this.issue.set('');
    this.reason.set('');
    this.repairDescription.set('');
    this.parts.set([{ name: '', quantity: 1, unitPrice: 0 }]);
    this.labourCharge.set(0);
    this.otherCharges.set(0);
    this.blocksRepair.set(false);
    this.estimatedTimeValue.set(null);
    this.estimatedTimeUnit.set('days');
    this.message.set('');
    this.images.set([]);
    this.imagesError.set('');
  }

  private reloadRequest(message: string): void {
    this.technicians.myJobDetails(this.requestId).subscribe({
      next: (request) => {
        this.requestUpdated.emit(request);
        this.toast.success('Repair Workflow', message);
        const hasDraft = request.repairJobDetails?.additionalChargeRequests?.some(
          (charge) => charge.status === 'draft',
        );
        if (!hasDraft) this.formOpen.set(false);
      },
      error: (error: HttpErrorResponse) =>
        this.fail(error, 'Updated repair details could not be loaded.'),
    });
  }

  private fail(error: HttpErrorResponse, fallback: string): void {
    const message = error.error?.message || fallback;
    this.error.set(message);
    this.toast.error('Workflow Error', message);
  }

  private amount(value: number): number {
    return Math.max(0, Number(value) || 0);
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
