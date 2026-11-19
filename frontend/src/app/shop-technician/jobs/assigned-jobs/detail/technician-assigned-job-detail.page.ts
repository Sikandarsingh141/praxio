import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, switchMap } from 'rxjs';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogConfig,
} from '../../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { TechnicianJobDetailPageBase } from '../../../../shared/components/job-page-base';
import { JobAttachmentsComponent } from '../../../../shared/components/job-attachments/job-attachments.component';
import { JobTimelineComponent } from '../../../../shared/components/job-timeline/job-timeline.component';
import { RepairProgressComponent } from '../../../../shared/components/repair-progress/repair-progress.component';
import { ShopRepairRouteComponent } from '../../../../shop/repair-job-details/components/shop-repair-route.component';
import { TechnicianRepairDetails } from '../../../../shop/technicians/technicians.models';
import { TechniciansService } from '../../../../shop/technicians/technicians.service';
import { TechnicianAdditionalChargesComponent } from '../../components/technician-additional-charges.component';
import { ToastService } from '../../../../core/toast/toast.service';
import {
  InspectionReportInput,
  RepairEstimatePartInput,
  RepairInspectionReport,
  RepairWorkflowImageInput,
} from '../../../../shared/models/repair-workflow.models';

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
  selector: 'app-technician-assigned-job-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    JobAttachmentsComponent,
    JobTimelineComponent,
    RepairProgressComponent,
    ShopRepairRouteComponent,
    TechnicianAdditionalChargesComponent,
    ConfirmationDialogComponent,
  ],
  templateUrl: './technician-assigned-job-detail.page.html',
  styleUrl: './technician-assigned-job-detail.page.scss',
})
export class TechnicianAssignedJobDetailPage extends TechnicianJobDetailPageBase {
  private readonly technicians = inject(TechniciansService);
  private readonly toast = inject(ToastService);
  readonly heroImageUnavailable = signal(false);
  readonly repairActionPending = signal(false);
  readonly repairActionError = signal('');
  readonly inspectionActionPending = signal(false);
  readonly inspectionActionError = signal('');
  readonly repairConfirmation = signal<ConfirmationDialogConfig | null>(null);
  readonly progressNotes = signal('');
  readonly completionDescription = signal('');
  readonly workPerformed = signal('');
  readonly partsReplaced = signal('');
  readonly finalNotes = signal('');
  readonly additionalChargesModalOpen = signal(false);
  readonly completionModalOpen = signal(false);
  readonly completionFormError = signal('');
  readonly inspectionModalOpen = signal(false);
  readonly submittingInspection = signal(false);
  readonly inspectionFormError = signal('');
  readonly inspectionImagesError = signal('');
  readonly problemCategories = PROBLEM_CATEGORIES;
  readonly problemCategory = signal<ProblemCategory | ''>('');
  readonly problemOther = signal('');
  readonly identifiedProblem = signal('');
  readonly findings = signal('');
  readonly requiredRepairWork = signal('');
  readonly inspectionParts = signal<RepairEstimatePartInput[]>([
    { name: '', quantity: 1, unitPrice: 0 },
  ]);
  readonly inspectionLabour = signal(0);
  readonly inspectionCharge = signal(0);
  readonly inspectionOtherCharges = signal(0);
  readonly inspectionTime = signal<number | null>(null);
  readonly inspectionTimeUnit = signal<'hours' | 'days'>('days');
  readonly inspectionWarranty = signal('');
  readonly inspectionMessage = signal('');
  readonly inspectionImages = signal<File[]>([]);
  readonly inspectionPartsTotal = computed(() => this.partsTotal(this.inspectionParts()));
  readonly inspectionTotal = computed(
    () =>
      this.inspectionPartsTotal() +
      this.amount(this.inspectionLabour()) +
      this.amount(this.inspectionCharge()) +
      this.amount(this.inspectionOtherCharges()),
  );
  readonly backRoute = '/technician/assigned-jobs';
  readonly backLabel = 'Assigned Requests';
  readonly pageTitle = 'Assigned Request Details';
  readonly customerMapUrl = computed(() => {
    const request = this.record();
    const location = request?.customerInfo?.location ?? request?.location;
    if (
      !location ||
      !Number.isFinite(location.latitude) ||
      location.latitude < -90 ||
      location.latitude > 90 ||
      !Number.isFinite(location.longitude) ||
      location.longitude < -180 ||
      location.longitude > 180
    ) {
      return null;
    }
    return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
  });

  customerName(request: TechnicianRepairDetails): string {
    return request.customerInfo?.name?.trim() || request.customer || 'Customer';
  }

  customerInitials(request: TechnicianRepairDetails): string {
    return this.customerName(request)
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  shopAddress(request: TechnicianRepairDetails): string {
    return [request.shop?.address, request.shop?.city].filter(Boolean).join(', ');
  }

  photoSource(photo: TechnicianRepairDetails['photos'][number]): string {
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

  statusLabel(request: TechnicianRepairDetails): string {
    return (request.repairJobDetails?.status ?? request.shopResponse?.status ?? request.status)
      .replace(/_/g, ' ')
      .replace(/^\w/, (firstLetter) => firstLetter.toUpperCase());
  }

  hasInitialDiagnosis(request: TechnicianRepairDetails): boolean {
    const inspection =
      request.repairJobDetails?.inspection ?? request.repairJob?.inspection ?? request.inspection;
    if (!inspection) return false;
    return Boolean(
      inspection.identifiedProblem?.trim() ||
        inspection.findings?.trim() ||
        inspection.requiredRepairWork?.trim() ||
        inspection.parts?.some((part) => part.name?.trim()) ||
        inspection.labourCharge > 0 ||
        inspection.inspectionCharges > 0 ||
        inspection.otherCharges > 0 ||
        inspection.estimatedTimeValue != null ||
        inspection.warranty?.trim() ||
        inspection.message?.trim() ||
        inspection.decisionReason?.trim() ||
        inspection.images?.length ||
        (inspection.status && inspection.status !== 'in_progress' && inspection.status !== 'draft'),
    );
  }

  startInspection(): void {
    const repair = this.record()?.repairJobDetails ?? this.record()?.repairJob;
    if (
      !repair ||
      !['confirmed', 'inspection_pending'].includes(repair.status) ||
      this.inspectionActionPending()
    ) {
      return;
    }
    this.inspectionActionPending.set(true);
    this.inspectionActionError.set('');
    this.technicians
      .startInspection(this.id)
      .pipe(
        switchMap(() => this.jobs.technicianJob(this.id)),
        finalize(() => this.inspectionActionPending.set(false)),
      )
      .subscribe({
        next: (request) => {
          this.refreshRecord(request);
          this.toast.success('Repair Workflow', 'Inspection started.');
        },
        error: (error: HttpErrorResponse) => {
          const message = error.error?.message || 'Inspection could not be started.';
          this.inspectionActionError.set(message);
          this.toast.error('Workflow Error', message);
        },
      });
  }

  openInspectionModal(): void {
    const request = this.record();
    const repair = request?.repairJobDetails ?? request?.repairJob;
    this.populateInspectionForm(request?.inspection ?? repair?.inspection);
    this.inspectionFormError.set('');
    this.inspectionModalOpen.set(true);
  }

  closeInspectionModal(): void {
    this.inspectionModalOpen.set(false);
    this.inspectionFormError.set('');
    this.inspectionImagesError.set('');
    this.inspectionImages.set([]);
  }

  updateInspectionPart(index: number, field: PartField, value: string | number): void {
    this.inspectionParts.update((parts) =>
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

  addInspectionPart(): void {
    this.inspectionParts.update((parts) => [...parts, { name: '', quantity: 1, unitPrice: 0 }]);
  }

  removeInspectionPart(index: number): void {
    this.inspectionParts.update((parts) =>
      parts.length > 1 ? parts.filter((_, partIndex) => partIndex !== index) : parts,
    );
  }

  chooseInspectionImages(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.inspectionImagesError.set('');
    if (files.length > 8 || files.some((file) => !/^image\/(jpeg|png|webp)$/.test(file.type))) {
      this.inspectionImagesError.set('Choose up to 8 JPG, PNG, or WebP images.');
      input.value = '';
      return;
    }
    if (files.some((file) => file.size > 2_000_000)) {
      this.inspectionImagesError.set('Each image must be smaller than 2 MB.');
      input.value = '';
      return;
    }
    if (files.reduce((total, file) => total + file.size, 0) > 1_200_000) {
      this.inspectionImagesError.set('The selected images must total no more than 1.2 MB.');
      input.value = '';
      return;
    }
    this.inspectionImages.set(files);
  }

  async saveInspection(action: 'draft' | 'submit'): Promise<void> {
    if (this.submittingInspection()) return;

    const category = this.problemCategory();
    const problemOther = this.problemOther().trim();
    const identifiedProblem = category === 'Other' ? `Other: ${problemOther}` : category;
    if (
      action === 'submit' &&
      (!category ||
        (category === 'Other' && !problemOther) ||
        !this.findings().trim() ||
        !this.requiredRepairWork().trim() ||
        this.inspectionTotal() <= 0)
    ) {
      this.inspectionFormError.set(
        'Select a problem category, specify it if Other, and complete Diagnosis & Inspection Findings, Recommended Repair Work, and a valid repair estimate.',
      );
      return;
    }

    this.identifiedProblem.set(identifiedProblem);
    this.submittingInspection.set(true);
    this.inspectionFormError.set('');

    try {
      const input: InspectionReportInput = {
        action,
        identifiedProblem: identifiedProblem || undefined,
        findings: this.findings().trim(),
        requiredRepairWork: this.requiredRepairWork().trim(),
        parts: this.nonEmptyParts(this.inspectionParts()),
        labourCharge: this.amount(this.inspectionLabour()),
        inspectionCharges: this.amount(this.inspectionCharge()),
        otherCharges: this.amount(this.inspectionOtherCharges()),
        estimatedTimeValue: this.inspectionTime() ?? undefined,
        estimatedTimeUnit: this.inspectionTimeUnit(),
        warranty: this.inspectionWarranty().trim() || undefined,
        images: this.inspectionImages().length
          ? await this.encodeImages(this.inspectionImages())
          : undefined,
        message: this.inspectionMessage().trim() || undefined,
      };

      this.technicians
        .saveInspection(this.id, input)
        .pipe(
          switchMap(() => this.jobs.technicianJob(this.id)),
          finalize(() => this.submittingInspection.set(false)),
        )
        .subscribe({
          next: (request) => {
            this.closeInspectionModal();
            this.refreshRecord(request);
            this.toast.success(
              'Repair Workflow',
              action === 'submit'
                ? 'Inspection report sent to the customer for approval.'
                : 'Inspection draft saved.',
            );
          },
          error: (error: HttpErrorResponse) => {
            const message = error.error?.message || 'Inspection report could not be saved.';
            this.inspectionFormError.set(message);
            this.toast.error('Workflow Error', message);
          },
        });
    } catch (error) {
      this.submittingInspection.set(false);
      this.inspectionFormError.set(
        error instanceof Error ? error.message : 'Images could not be read.',
      );
    }
  }

  private populateInspectionForm(inspection?: RepairInspectionReport | null): void {
    const storedProblem = inspection?.identifiedProblem?.trim() || '';
    const otherPrefix = 'Other:';
    const otherProblem = storedProblem.startsWith(otherPrefix)
      ? storedProblem.slice(otherPrefix.length).trim()
      : '';
    const matchedCategory = PROBLEM_CATEGORIES.find((category) => category === storedProblem);
    const legacyProblem =
      storedProblem.length > 0 && !matchedCategory && !storedProblem.startsWith(otherPrefix);
    const useOther =
      otherProblem.length > 0 || legacyProblem || storedProblem === otherPrefix;

    this.identifiedProblem.set(storedProblem);
    this.problemCategory.set(useOther ? 'Other' : matchedCategory ?? '');
    this.problemOther.set(useOther ? otherProblem || (legacyProblem ? storedProblem : '') : '');
    this.findings.set(inspection?.findings ?? '');
    this.requiredRepairWork.set(inspection?.requiredRepairWork ?? '');
    const parts = inspection?.parts ?? [];
    this.inspectionParts.set(
      parts.length
        ? parts.map(({ name, quantity, unitPrice }) => ({ name, quantity, unitPrice }))
        : [{ name: '', quantity: 1, unitPrice: 0 }],
    );
    this.inspectionLabour.set(inspection?.labourCharge ?? 0);
    this.inspectionCharge.set(inspection?.inspectionCharges ?? 0);
    this.inspectionOtherCharges.set(inspection?.otherCharges ?? 0);
    this.inspectionTime.set(inspection?.estimatedTimeValue ?? null);
    this.inspectionTimeUnit.set(inspection?.estimatedTimeUnit ?? 'days');
    this.inspectionWarranty.set(inspection?.warranty ?? '');
    this.inspectionMessage.set(inspection?.message ?? '');
    this.inspectionImages.set([]);
    this.inspectionImagesError.set('');
  }

  confirmStartRepair(): void {
    const request = this.record();
    const repair = request?.repairJobDetails ?? request?.repairJob;
    if (!request || repair?.status !== 'inspection_approved' || this.repairActionPending()) {
      return;
    }
    this.repairConfirmation.set({
      title: 'Start repair?',
      message: `Start this repair using the customer-approved estimate of ${(repair.approvedRepairAmount ?? request.quotation?.amount ?? 0).toFixed(2)}?`,
      confirmLabel: 'Start repair',
      cancelLabel: 'Cancel',
    });
  }

  cancelStartRepair(): void {
    this.repairConfirmation.set(null);
  }

  startApprovedRepair(): void {
    this.repairConfirmation.set(null);
    if (this.repairActionPending()) return;
    this.repairActionPending.set(true);
    this.repairActionError.set('');
    this.technicians
      .startApprovedRepair(this.id)
      .pipe(
        switchMap(() => this.jobs.technicianJob(this.id)),
        finalize(() => this.repairActionPending.set(false)),
      )
      .subscribe({
        next: (request) => {
          this.refreshRecord(request);
          this.toast.success('Repair Workflow', 'Repair started.');
        },
        error: (error: HttpErrorResponse) => {
          const message = error.error?.message || 'Repair could not be started.';
          this.repairActionError.set(message);
          this.toast.error('Workflow Error', message);
        },
      });
  }

  holdRepair(): void {
    const repair = this.record()?.repairJobDetails ?? this.record()?.repairJob;
    if (repair?.status !== 'in_progress' || this.repairActionPending()) return;
    this.repairActionPending.set(true);
    this.repairActionError.set('');
    this.technicians
      .holdJob(this.id, this.progressNotes().trim())
      .pipe(
        switchMap(() => this.jobs.technicianJob(this.id)),
        finalize(() => this.repairActionPending.set(false)),
      )
      .subscribe({
        next: (request) => {
          this.progressNotes.set('');
          this.refreshRecord(request);
          this.toast.success('Repair Workflow', 'Repair placed on hold.');
        },
        error: (error: HttpErrorResponse) => {
          const message = error.error?.message || 'Repair could not be placed on hold.';
          this.repairActionError.set(message);
          this.toast.error('Workflow Error', message);
        },
      });
  }

  resumeRepair(): void {
    const repair = this.record()?.repairJobDetails ?? this.record()?.repairJob;
    if (repair?.status !== 'on_hold' || this.repairActionPending()) return;
    this.repairActionPending.set(true);
    this.repairActionError.set('');
    this.technicians
      .startJob(this.id, this.progressNotes().trim())
      .pipe(
        switchMap(() => this.jobs.technicianJob(this.id)),
        finalize(() => this.repairActionPending.set(false)),
      )
      .subscribe({
        next: (request) => {
          this.progressNotes.set('');
          this.refreshRecord(request);
          this.toast.success('Repair Workflow', 'Repair resumed.');
        },
        error: (error: HttpErrorResponse) => {
          const message = error.error?.message || 'Repair could not be resumed.';
          this.repairActionError.set(message);
          this.toast.error('Workflow Error', message);
        },
      });
  }

  openAdditionalChargesModal(): void {
    this.additionalChargesModalOpen.set(true);
  }

  closeAdditionalChargesModal(): void {
    this.additionalChargesModalOpen.set(false);
  }

  onAdditionalChargesUpdated(request: TechnicianRepairDetails): void {
    this.refreshRecord(request);
    this.closeAdditionalChargesModal();
  }

  openCompletionModal(): void {
    this.completionFormError.set('');
    this.completionModalOpen.set(true);
  }

  closeCompletionModal(): void {
    this.completionModalOpen.set(false);
  }

  completeRepair(): void {
    const repair = this.record()?.repairJobDetails ?? this.record()?.repairJob;
    const completionDescription = this.completionDescription().trim();
    const workPerformed = this.workPerformed().trim();
    if (repair?.status !== 'in_progress' || this.repairActionPending()) return;
    if (!completionDescription || !workPerformed) {
      this.completionFormError.set('Provide a completion summary and work performed.');
      return;
    }
    this.repairActionPending.set(true);
    this.repairActionError.set('');
    this.completionFormError.set('');
    this.technicians
      .completeJob(this.id, {
        completionDescription,
        workPerformed,
        partsReplaced: this.partsReplaced().trim() || undefined,
        finalNotes: this.finalNotes().trim() || undefined,
      })
      .pipe(
        switchMap(() => this.jobs.technicianJob(this.id)),
        finalize(() => this.repairActionPending.set(false)),
      )
      .subscribe({
        next: (request) => {
          this.completionDescription.set('');
          this.workPerformed.set('');
          this.partsReplaced.set('');
          this.finalNotes.set('');
          this.completionModalOpen.set(false);
          this.refreshRecord(request);
          this.toast.success('Repair Workflow', 'Repair marked complete.');
        },
        error: (error: HttpErrorResponse) => {
          const message = error.error?.message || 'Repair could not be completed.';
          this.repairActionError.set(message);
          this.completionFormError.set(message);
          this.toast.error('Workflow Error', message);
        },
      });
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

