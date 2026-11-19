import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ShopProfile } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { ShopRepairRequest } from '../repair-requests/shop-repair-requests.models';
import { ShopRepairRequestsService } from '../repair-requests/shop-repair-requests.service';
import { ShopRepairRouteComponent } from './components/shop-repair-route.component';
import { ShopRepairPickupComponent } from './components/shop-repair-pickup.component';
import { ShopRepairWorkflowComponent } from './components/shop-repair-workflow.component';
import { JobTimelineComponent } from '../../shared/components/job-timeline/job-timeline.component';
import { JobAttachmentsComponent } from '../../shared/components/job-attachments/job-attachments.component';
import { JobAttachment } from '../../shared/models/job.models';
import { JobSharedService } from '../../shared/services/job-shared.service';
import { canStartRepair } from '../../shared/utils/repair-authorization.util';
import { buildRepairProgressSteps } from '../../shared/utils/repair-progress.util';
import { Technician } from '../technicians/technicians.models';
import { TechniciansService } from '../technicians/technicians.service';
import { ToastService } from '../../core/toast/toast.service';
import { profileImageSource } from '../../shared/utils/appliance-thumbnail.util';

const DECLINE_REASONS = [
  'Service not offered',
  'Outside service area',
  'No current capacity',
  'Request details are insufficient',
  'Other',
];

const QUOTATION_SUMMARY_OPTIONS = [
  'General Repair',
  'Part Replacement',
  'Hardware Repair',
  'Software Repair',
  'Electrical Repair',
  'Screen / Display Replacement',
  'Battery Replacement',
  'Cleaning & Maintenance',
  'Diagnostic & Troubleshooting',
  'Other',
] as const;

type QuotationSummaryOption = (typeof QUOTATION_SUMMARY_OPTIONS)[number];

const WORK_PERFORMED_OPTIONS = [
  'Hardware Repair',
  'Software Repair',
  'Component Replacement',
  'Battery Replacement',
  'Screen / Display Replacement',
  'Electrical Repair',
  'Cleaning & Maintenance',
  'Testing & Quality Check',
  'Performance Optimization',
  'Other',
] as const;

type WorkPerformedOption = (typeof WORK_PERFORMED_OPTIONS)[number];

type ReplacedPart = {
  name: string;
  quantity: number;
};

@Component({
  selector: 'app-shop-repair-request-details-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    JobTimelineComponent,
    ShopRepairRouteComponent,
    ShopRepairPickupComponent,
    ShopRepairWorkflowComponent,
    JobAttachmentsComponent,
  ],
  templateUrl: './shop-repair-request-details.page.html',
  styleUrl: './shop-repair-request-details.page.scss',
})
export class ShopRepairRequestDetailsPage implements OnInit {
  @ViewChild(ShopRepairWorkflowComponent) private repairWorkflow?: ShopRepairWorkflowComponent;

  readonly jobs = inject(JobSharedService);
  readonly reasons = DECLINE_REASONS;
  readonly request = signal<ShopRepairRequest | null>(null);
  readonly shopProfile = signal<ShopProfile | null>(null);
  readonly heroImageUnavailable = signal(false);
  readonly customerImageUnavailable = signal(false);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly formError = signal('');
  readonly quotationOpen = signal(false);
  readonly declineOpen = signal(false);
  readonly quotationAmount = signal<number | null>(null);
  readonly completionDays = signal<number | null>(null);
  readonly validityDays = signal<number | null>(7);
  readonly quotationSummaries = signal<QuotationSummaryOption[]>([]);
  readonly quotationSummarySearch = signal('');
  readonly quotationSummaryOpen = signal(false);
  readonly additionalRepairDetails = signal('');
  readonly quotationAttempted = signal(false);
  readonly inspectionCompletedBeforeQuotation = signal(false);
  readonly requiresPhysicalPickup = signal(false);
  readonly declineReason = signal('');
  readonly customDeclineReason = signal('');
  readonly repairActionSubmitting = signal(false);
  readonly progressNotes = signal('');
  readonly completionDescription = signal('');
  readonly completionModalOpen = signal(false);
  readonly completionAttempted = signal(false);
  readonly workPerformedOptions = WORK_PERFORMED_OPTIONS;
  readonly workPerformedSelections = signal<WorkPerformedOption[]>([]);
  readonly workPerformedSearch = signal('');
  readonly workPerformedDropdownOpen = signal(false);
  readonly workPerformedOther = signal('');
  readonly replacedParts = signal<ReplacedPart[]>([{ name: '', quantity: 1 }]);
  readonly finalNotes = signal('');
  readonly pickupInstructions = signal('');
  readonly pickupMessage = signal('');
  readonly pickupModalOpen = signal(false);
  readonly pickupAttempted = signal(false);
  readonly repairFormError = signal('');
  readonly pageTitle = signal('Repair Request Details');
  readonly backRoute = signal('/shop/repair-requests');
  readonly backLabel = signal('All Requests');
  readonly assignmentModalOpen = signal(false);
  readonly assignmentLoading = signal(false);
  readonly assignmentSubmitting = signal(false);
  readonly assignmentSearch = signal('');
  readonly assignmentTechnicians = signal<Technician[]>([]);
  readonly selectedTechnicianId = signal('');
  readonly assignmentNote = signal('');
  readonly assignmentReason = signal('');
  readonly assignmentError = signal('');
  readonly customerCoordinates = computed(() => {
    const request = this.request();
    if (!request) return null;
    if (request.customer.location) return request.customer.location;
    if (
      typeof request.customerLatitude === 'number' &&
      typeof request.customerLongitude === 'number'
    ) {
      return {
        latitude: request.customerLatitude,
        longitude: request.customerLongitude,
      };
    }
    return null;
  });
  readonly customerMapUrl = computed(() => {
    const location = this.customerCoordinates();
    return this.isValidCoordinates(location)
      ? `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`
      : null;
  });
  readonly progressSteps = computed(() => this.buildProgressSteps());
  readonly filteredQuotationSummaries = computed(() => {
    const term = this.quotationSummarySearch().trim().toLowerCase();
    return QUOTATION_SUMMARY_OPTIONS.filter(
      (option) => !term || option.toLowerCase().includes(term),
    );
  });
  readonly quotationProposedSolution = computed(() => this.quotationSummaries().join(', '));
  readonly quotationMessage = computed(() => {
    const details = this.additionalRepairDetails().trim();
    return this.hasQuotationSummaryOption('Other') && details
      ? details
      : this.quotationProposedSolution();
  });
  readonly filteredWorkPerformedOptions = computed(() => {
    const term = this.workPerformedSearch().trim().toLowerCase();
    return WORK_PERFORMED_OPTIONS.filter(
      (option) => !term || option.toLowerCase().includes(term),
    );
  });
  readonly hasOtherWorkPerformed = computed(() =>
    this.workPerformedSelections().includes('Other'),
  );
  readonly workPerformedValue = computed(() => {
    const otherDetails = this.workPerformedOther().trim();
    return this.workPerformedSelections()
      .map((option) => (option === 'Other' && otherDetails ? `Other: ${otherDetails}` : option))
      .join(', ');
  });
  readonly partsReplacedValue = computed(() =>
    this.replacedParts()
      .map((part) => ({
        name: part.name.trim(),
        quantity: Math.max(1, Number(part.quantity) || 1),
      }))
      .filter((part) => part.name)
      .map((part) => `${part.name} × ${part.quantity}`)
      .join(', '),
  );
  readonly canRespond = computed(() => {
    const request = this.request();
    if (!request || request.status !== 'open') {
      return false;
    }
    return (
      ['new', 'pending'].includes(request.shopResponse.status) &&
      (!request.shopResponse.responseDeadline ||
        new Date(request.shopResponse.responseDeadline).getTime() > Date.now())
    );
  });

  constructor(
    private readonly route: ActivatedRoute,
    private readonly requestsService: ShopRepairRequestsService,
    private readonly authService: AuthService,
    private readonly techniciansService: TechniciansService,
    private readonly toastService: ToastService,
  ) {}

  setRequest(request: ShopRepairRequest): void {
    this.request.set(request);
    this.heroImageUnavailable.set(false);
    this.customerImageUnavailable.set(false);
  }

  customerPhotoSource(value?: string | null): string | null {
    const source = profileImageSource(value);
    return source && !this.customerImageUnavailable() ? source : null;
  }

  customerName(request: ShopRepairRequest): string {
    return (
      request.customer.displayName?.trim() ||
      [request.customer.firstName, request.customer.lastName].filter(Boolean).join(' ') ||
      'Customer'
    );
  }

  customerInitials(request: ShopRepairRequest): string {
    return this.customerName(request)
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  photoAttachments(photos: ShopRepairRequest['photos']): JobAttachment[] {
    return (photos || []).map((photo, index) => ({
      name: `Photo ${index + 1}`,
      mimeType: photo.mimeType,
      data: photo.data,
    }));
  }

  photoSource(photo: ShopRepairRequest['photos'][number]): string {
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

  statusLabel(request: ShopRepairRequest): string {
    const status = request.repairJob?.status ?? request.shopResponse.status;
    return status
      .replace(/_/g, ' ')
      .replace(/^\w/, (firstLetter) => firstLetter.toUpperCase());
  }

  private buildProgressSteps() {
    const request = this.request();
    if (!request) return [];
    const repairJob = request.repairJob;
    const acceptedQuotation = request.quotations.find(
      (quotation) => quotation.status === 'accepted',
    );
    const quotationAccepted = Boolean(
      request.acceptedQuotationId ||
        repairJob?.acceptedQuotationId ||
        acceptedQuotation ||
        request.shopResponse.status === 'customer_accepted',
    );
    const acceptedAt =
      acceptedQuotation?.respondedAt ??
      request.shopResponse.respondedAt ??
      repairJob?.confirmedAt;
    return buildRepairProgressSteps({
      requestCreatedAt: request.createdAt,
      requestStatus: request.status,
      repairJob,
      quotationStatus: quotationAccepted
        ? 'accepted'
        : request.shopResponse.status === 'quotation_submitted'
          ? 'submitted'
          : 'none',
      acceptedAt,
      quotationAt: request.quotations.at(-1)?.createdAt,
    });
  }

  openAssignment(): void {
    this.assignmentModalOpen.set(true);
    this.assignmentError.set('');
    const current = this.request()?.technicianAssignment?.current;
    this.selectedTechnicianId.set(current?.isOwner ? '' : current?.technicianId ?? '');
    this.assignmentLoading.set(true);
    this.techniciansService.list().subscribe({
      next: (result) => {
        this.assignmentTechnicians.set(result.technicians);
        this.assignmentLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.assignmentError.set(error.error?.message || 'Technician list could not be loaded.');
        this.assignmentLoading.set(false);
      },
    });
  }

  get filteredAssignmentTechnicians(): Technician[] {
    const query = this.assignmentSearch().trim().toLocaleLowerCase();
    return this.assignmentTechnicians().filter((technician) =>
      [
        technician.name,
        technician.employeeId,
        technician.skills.join(' '),
        technician.specialization,
      ]
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
    const request = this.request();
    if (!request) return;
    const current = request.technicianAssignment?.current;
    const selected = this.selectedTechnicianId();
    if (
      current &&
      (current.technicianId === selected || (current.isOwner && selected === ''))
    ) {
      this.assignmentError.set('Select a different technician or use Unassign.');
      return;
    }
    if (current && !this.assignmentReason().trim()) {
      this.assignmentError.set('Enter a reason to reassign this repair.');
      return;
    }
    this.assignmentSubmitting.set(true);
    this.assignmentError.set('');
    this.techniciansService
      .assign(request._id, {
        ...(selected ? { technicianId: selected } : {}),
        note: this.assignmentNote().trim(),
        ...(current ? { reason: this.assignmentReason().trim() } : {}),
      })
      .subscribe({
        next: (result) => {
          this.assignmentSubmitting.set(false);
          this.assignmentModalOpen.set(false);
          this.success.set(
            result.warning
              ? `Technician assigned. Warning: ${result.warning}`
              : 'Technician assignment updated.',
          );
          this.reloadRequest(request._id);
        },
        error: (error: HttpErrorResponse) => {
          this.assignmentError.set(error.error?.message || 'Technician could not be assigned.');
          this.assignmentSubmitting.set(false);
        },
      });
  }

  unassignTechnician(): void {
    const request = this.request();
    if (!request?.technicianAssignment?.current) return;
    const reason = this.assignmentReason().trim();
    if (!reason) {
      this.assignmentError.set('Enter a reason before unassigning this technician.');
      return;
    }
    if (!window.confirm('Unassign the current technician from this repair?')) return;
    this.assignmentSubmitting.set(true);
    this.techniciansService.unassign(request._id, reason).subscribe({
      next: () => {
        this.assignmentSubmitting.set(false);
        this.assignmentModalOpen.set(false);
        this.success.set('Technician unassigned.');
        this.reloadRequest(request._id);
      },
      error: (error: HttpErrorResponse) => {
        this.assignmentError.set(error.error?.message || 'Technician could not be unassigned.');
        this.assignmentSubmitting.set(false);
      },
    });
  }

  cancelAssignment(): void {
    this.assignmentModalOpen.set(false);
    this.assignmentError.set('');
  }

  ngOnInit(): void {
    const routeContexts: Record<string, { title: string; label: string; route: string }> = {
      new: {
        title: 'New Request Details',
        label: 'New Requests',
        route: '/shop/jobs/new-jobs',
      },
      pending: {
        title: 'Pending Request Details',
        label: 'Pending Requests',
        route: '/shop/jobs/pending-jobs',
      },
      assigned: {
        title: 'Assigned Request Details',
        label: 'Assigned Requests',
        route: '/shop/jobs/assigned-jobs',
      },
      active: {
        title: 'Active Repair Details',
        label: 'Active Repairs',
        route: '/shop/jobs/active-jobs',
      },
    };
    const routeStatus = this.route.snapshot.data['jobStatus'];
    const routeContext = typeof routeStatus === 'string' ? routeContexts[routeStatus] : undefined;
    if (routeContext) {
      this.pageTitle.set(routeContext.title);
      this.backLabel.set(routeContext.label);
      this.backRoute.set(routeContext.route);
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Repair request was not found.');
      this.loading.set(false);
      return;
    }
    this.requestsService.get(id).subscribe({
      next: (request) => {
        this.request.set(request);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.message || 'Repair request could not be loaded.');
        this.loading.set(false);
      },
    });
    this.authService.getMyShopProfile().subscribe({
      next: (profile) => {
        this.shopProfile.set(profile);
      },
      error: (error: HttpErrorResponse) => {
        console.error('Shop location could not be loaded for repair directions.', error);
      },
    });
  }

  openQuotation(): void {
    this.inspectionCompletedBeforeQuotation.set(false);
    this.requiresPhysicalPickup.set(false);
    this.quotationOpen.set(true);
  }

  setInspectionCompletedBeforeQuotation(inspectionCompleted: boolean): void {
    this.inspectionCompletedBeforeQuotation.set(inspectionCompleted);
    if (inspectionCompleted) {
      this.requiresPhysicalPickup.set(false);
    }
  }

  setRequiresPhysicalPickup(requiresPhysicalPickup: boolean): void {
    this.requiresPhysicalPickup.set(
      requiresPhysicalPickup && !this.inspectionCompletedBeforeQuotation(),
    );
  }

  submitQuotation(): void {
    const request = this.request();
    if (!request || !this.canRespond()) {
      return;
    }
    this.quotationAttempted.set(true);
    if (!this.isQuotationValid()) return;

    this.submitting.set(true);
    this.formError.set('');
    const validUntil = new Date(
      Date.now() + this.validityDays()! * 86400000,
    ).toISOString();
    this.requestsService
      .submitQuotation(request._id, {
        amount: this.quotationAmount()!,
        currency: 'INR',
        message: this.quotationMessage().trim(),
        proposedSolution: this.quotationProposedSolution(),
        estimatedDays: this.completionDays()!,
        inspectionCompletedBeforeQuotation:
          this.inspectionCompletedBeforeQuotation(),
        requiresPhysicalPickup: this.requiresPhysicalPickup(),
        validUntil,
      })
      .subscribe({
        next: () => {
          this.toastService.success(
            'Quotation Submitted!',
            'The customer has been notified successfully.',
          );
          this.quotationOpen.set(false);
          this.submitting.set(false);
          this.reloadRequest(request._id);
        },
        error: (error: HttpErrorResponse) => {
          const msg = error.error?.message || 'Quotation could not be submitted.';
          this.formError.set(msg);
          this.toastService.error('Submission Failed', msg);
          this.submitting.set(false);
        },
      });
  }

  isQuotationValid(): boolean {
    const amount = this.quotationAmount();
    const completionDays = this.completionDays();
    const validityDays = this.validityDays();
    const summaries = this.quotationSummaries();
    const otherDetails = this.additionalRepairDetails().trim();
    return (
      amount !== null &&
      Number.isFinite(amount) &&
      amount > 0 &&
      completionDays !== null &&
      Number.isInteger(completionDays) &&
      completionDays > 0 &&
      validityDays !== null &&
      Number.isInteger(validityDays) &&
      validityDays > 0 &&
      validityDays <= 365 &&
      summaries.length > 0 &&
      (!summaries.includes('Other') || otherDetails.length > 0) &&
      this.quotationMessage().length <= 1000
    );
  }

  hasQuotationSummaryOption(option: QuotationSummaryOption): boolean {
    return this.quotationSummaries().includes(option);
  }

  toggleQuotationSummary(option: QuotationSummaryOption): void {
    const removing = this.hasQuotationSummaryOption(option);
    this.quotationSummaries.update((selected) =>
      removing ? selected.filter((item) => item !== option) : [...selected, option],
    );
    if (option === 'Other' && removing) {
      this.additionalRepairDetails.set('');
    }
    this.quotationSummarySearch.set('');
    this.formError.set('');
  }

  removeQuotationSummary(option: QuotationSummaryOption): void {
    this.quotationSummaries.update((selected) => selected.filter((item) => item !== option));
    if (option === 'Other') {
      this.additionalRepairDetails.set('');
    }
    this.formError.set('');
  }

  closeQuotationSummaryDropdown(event: FocusEvent): void {
    const container = event.currentTarget as HTMLElement | null;
    const nextTarget = event.relatedTarget as HTMLElement | null;
    if (!container || (nextTarget && container.contains(nextTarget))) return;
    this.quotationSummaryOpen.set(false);
    this.quotationSummarySearch.set('');
  }

  declineRequest(): void {
    const request = this.request();
    const reason =
      this.declineReason() === 'Other'
        ? this.customDeclineReason().trim()
        : this.declineReason().trim();
    if (!request || !this.canRespond()) {
      return;
    }

    if (!reason) {
      this.formError.set('Choose or enter a reason before declining.');
      return;
    }
    this.submitting.set(true);
    this.formError.set('');
    this.requestsService.decline(request._id, reason).subscribe({
      next: () => {
        this.toastService.info('Request Declined', 'The customer has been notified.');
        this.declineOpen.set(false);
        this.submitting.set(false);
        this.reloadRequest(request._id);
      },
      error: (error: HttpErrorResponse) => {
        const msg = error.error?.message || 'Request could not be declined.';
        this.formError.set(msg);
        this.toastService.error('Decline Failed', msg);
        this.submitting.set(false);
      },
    });
  }

  startRepair(): void {
    const request = this.request();
    if (!request || !this.canResumeRepair(request)) return;
    this.runRepairAction('start', () =>
      this.requestsService.startRepair(request._id, this.progressNotes().trim() || undefined),
    );
  }

  openInspectionSubmission(): void {
    if (!this.repairWorkflow) {
      this.toastService.error(
        'Inspection Error',
        'The inspection form is unavailable. Please refresh and try again.',
      );
      return;
    }
    this.repairWorkflow.openInspectionModal();
  }

  approvedRepairAmount(): number {
    const job = this.request()?.repairJob;
    return (
      this.repairWorkflow?.approvedTotal ??
      (job?.approvedRepairAmount ?? 0) + (job?.approvedAdditionalCharges ?? 0)
    );
  }

  approvedRepairCurrency(): string {
    return (
      this.repairWorkflow?.acceptedQuotation?.currency ??
      this.request()?.quotations.find((quotation) => quotation.status === 'accepted')?.currency ??
      'INR'
    );
  }

  canStartApprovedRepair(): boolean {
    const request = this.request();
    const acceptedQuotation = request?.quotations.find(
      (quotation) => quotation.status === 'accepted',
    );
    return canStartRepair(request?.repairJob, acceptedQuotation?.status);
  }

  repairStartLocked(): boolean {
    return (
      this.request()?.repairJob?.status === 'inspection_approved' &&
      !this.canStartApprovedRepair()
    );
  }

  repairStartSubmitting(): boolean {
    return this.repairWorkflow?.submitting() ?? false;
  }

  startApprovedRepair(): void {
    if (!this.repairWorkflow) {
      this.toastService.error(
        'Repair Error',
        'The repair authorization action is unavailable. Please refresh and try again.',
      );
      return;
    }
    this.repairWorkflow.startRepair();
  }

  canResumeRepair(request: ShopRepairRequest): boolean {
    const job = request.repairJob;
    return (
      job?.status === 'on_hold' &&
      request.quotations.some((quotation) => quotation.status === 'accepted') &&
      !(job.additionalChargeRequests ?? []).some(
        (charge) => charge.status === 'pending' && charge.blocksRepair,
      )
    );
  }

  holdRepair(): void {
    const request = this.request();
    if (!request) return;
    this.runRepairAction('hold', () =>
      this.requestsService.holdRepair(request._id, this.progressNotes().trim() || undefined),
    );
  }

  openCompletionModal(): void {
    this.completionModalOpen.set(true);
    this.repairFormError.set('');
  }

  closeCompletionModal(): void {
    this.completionModalOpen.set(false);
    this.completionAttempted.set(false);
    this.repairFormError.set('');
  }

  openPickupModal(): void {
    this.pickupModalOpen.set(true);
    this.repairFormError.set('');
  }

  closePickupModal(): void {
    this.pickupModalOpen.set(false);
    this.pickupAttempted.set(false);
    this.repairFormError.set('');
  }

  hasWorkPerformedOption(option: WorkPerformedOption): boolean {
    return this.workPerformedSelections().includes(option);
  }

  toggleWorkPerformedOption(option: WorkPerformedOption): void {
    const removing = this.hasWorkPerformedOption(option);
    this.workPerformedSelections.update((selected) =>
      removing ? selected.filter((item) => item !== option) : [...selected, option],
    );
    if (option === 'Other' && removing) {
      this.workPerformedOther.set('');
    }
    this.workPerformedSearch.set('');
    this.repairFormError.set('');
  }

  removeWorkPerformedOption(option: WorkPerformedOption): void {
    this.workPerformedSelections.update((selected) => selected.filter((item) => item !== option));
    if (option === 'Other') {
      this.workPerformedOther.set('');
    }
    this.repairFormError.set('');
  }

  closeWorkPerformedDropdown(event: FocusEvent): void {
    const container = event.currentTarget as HTMLElement | null;
    const nextTarget = event.relatedTarget as HTMLElement | null;
    if (!container || (nextTarget && container.contains(nextTarget))) return;
    this.workPerformedDropdownOpen.set(false);
    this.workPerformedSearch.set('');
  }

  addReplacedPart(): void {
    this.replacedParts.update((parts) => [...parts, { name: '', quantity: 1 }]);
  }

  removeReplacedPart(index: number): void {
    this.replacedParts.update((parts) => parts.filter((_, partIndex) => partIndex !== index));
  }

  updateReplacedPartName(index: number, value: string): void {
    this.replacedParts.update((parts) =>
      parts.map((part, partIndex) =>
        partIndex === index ? { ...part, name: value } : part,
      ),
    );
  }

  updateReplacedPartQuantity(index: number, value: number | string): void {
    this.replacedParts.update((parts) =>
      parts.map((part, partIndex) =>
        partIndex === index
          ? { ...part, quantity: Math.max(1, Number(value) || 1) }
          : part,
      ),
    );
  }

  isCompletionValid(): boolean {
    return (
      !!this.completionDescription().trim() &&
      this.workPerformedSelections().length > 0 &&
      (!this.hasOtherWorkPerformed() || !!this.workPerformedOther().trim())
    );
  }

  completeRepair(): void {
    const request = this.request();
    this.completionAttempted.set(true);
    if (!request) return;
    if (!this.completionDescription().trim()) {
      this.repairFormError.set('Add a completion summary before continuing.');
      return;
    }
    if (!this.workPerformedSelections().length) {
      this.repairFormError.set('Select at least one work performed activity.');
      return;
    }
    if (this.hasOtherWorkPerformed() && !this.workPerformedOther().trim()) {
      this.repairFormError.set('Describe the other work performed.');
      return;
    }
    this.repairFormError.set('');
    this.runRepairAction('complete', () =>
      this.requestsService.completeRepair(request._id, {
        completionDescription: this.completionDescription().trim(),
        workPerformed: this.workPerformedValue(),
        partsReplaced: this.partsReplacedValue() || undefined,
        finalNotes: this.finalNotes().trim() || undefined,
      }),
    );
  }

  markReadyForPickup(): void {
    const request = this.request();
    this.pickupAttempted.set(true);
    if (!request || !this.pickupInstructions().trim()) {
      this.repairFormError.set('Enter pickup instructions for the customer.');
      return;
    }
    this.repairFormError.set('');
    this.runRepairAction('pickup', () =>
      this.requestsService.readyForPickup(request._id, {
        pickupInstructions: this.pickupInstructions().trim(),
        message: this.pickupMessage().trim() || undefined,
      }),
    );
  }

  private runRepairAction(
    action: 'start' | 'hold' | 'complete' | 'pickup',
    request: () => ReturnType<ShopRepairRequestsService['startRepair']>,
  ): void {
    const id = this.request()?._id;
    if (!id || this.repairActionSubmitting()) {
      return;
    }
    this.repairActionSubmitting.set(true);
    this.repairFormError.set('');
    request().subscribe({
      next: () => {
        const messages = {
          start: 'Repair progress updated.',
          hold: 'Repair placed on hold.',
          complete: 'Repair completion details saved.',
          pickup: 'Customer notified that the repair is ready for pickup.',
        };
        this.toastService.success('Repair Updated', messages[action]);
        if (action === 'complete') {
          this.closeCompletionModal();
          this.resetCompletionForm();
        }
        if (action === 'pickup') {
          this.closePickupModal();
          this.resetPickupForm();
        }
        this.repairActionSubmitting.set(false);
        this.reloadRequest(id);
      },
      error: (error: HttpErrorResponse) => {
        const msg = error.error?.message || 'Repair status could not be updated.';
        this.repairFormError.set(msg);
        this.toastService.error('Update Failed', msg);
        this.repairActionSubmitting.set(false);
      },
    });
  }

  private resetCompletionForm(): void {
    this.completionDescription.set('');
    this.workPerformedSelections.set([]);
    this.workPerformedSearch.set('');
    this.workPerformedDropdownOpen.set(false);
    this.workPerformedOther.set('');
    this.replacedParts.set([{ name: '', quantity: 1 }]);
    this.finalNotes.set('');
    this.completionAttempted.set(false);
  }

  private resetPickupForm(): void {
    this.pickupInstructions.set('');
    this.pickupMessage.set('');
    this.pickupAttempted.set(false);
  }

  private reloadRequest(id: string): void {
    this.requestsService.get(id).subscribe({
      next: (request) => this.request.set(request),
      error: (error: HttpErrorResponse) =>
        this.error.set(error.error?.message || 'Updated request could not be reloaded.'),
    });
  }

  private isValidCoordinates(
    location: { latitude: number; longitude: number } | null | undefined,
  ): location is { latitude: number; longitude: number } {
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
}
