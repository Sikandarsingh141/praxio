import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ShopProfile } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { ShopRepairRequest } from '../repair-requests/shop-repair-requests.models';
import { ShopRepairRequestsService } from '../repair-requests/shop-repair-requests.service';
import { ShopRepairRouteComponent } from './components/shop-repair-route.component';
import { ShopRepairWorkflowComponent } from './components/shop-repair-workflow.component';
import { JobTimelineComponent } from '../../shared/components/job-timeline/job-timeline.component';
import { JobSharedService } from '../../shared/services/job-shared.service';
import { Technician } from '../technicians/technicians.models';
import { TechniciansService } from '../technicians/technicians.service';
import { ToastService } from '../../core/toast/toast.service';

const DECLINE_REASONS = [
  'Service not offered',
  'Outside service area',
  'No current capacity',
  'Request details are insufficient',
  'Other',
];

@Component({
  selector: 'app-shop-repair-request-details-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    JobTimelineComponent,
    ShopRepairRouteComponent,
    ShopRepairWorkflowComponent,
  ],
  templateUrl: './shop-repair-request-details.page.html',
  styleUrl: './shop-repair-request-details.page.scss',
})
export class ShopRepairRequestDetailsPage implements OnInit {
  readonly jobs = inject(JobSharedService);
  readonly reasons = DECLINE_REASONS;
  readonly request = signal<ShopRepairRequest | null>(null);
  readonly shopProfile = signal<ShopProfile | null>(null);
  readonly heroImageUnavailable = signal(false);
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
  readonly message = signal('');
  readonly quotationAttempted = signal(false);
  readonly declineReason = signal('');
  readonly customDeclineReason = signal('');
  readonly repairActionSubmitting = signal(false);
  readonly progressNotes = signal('');
  readonly completionDescription = signal('');
  readonly workPerformed = signal('');
  readonly partsReplaced = signal('');
  readonly finalNotes = signal('');
  readonly pickupInstructions = signal('');
  readonly pickupMessage = signal('');
  readonly repairFormError = signal('');
  readonly pageTitle = signal('Repair Request Details');
  readonly backRoute = signal('/shop/repair-requests');
  readonly backLabel = signal('Repair Requests');
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
  readonly progressSteps = [
    'Request Submitted',
    'Inspection Pending',
    'Quotation',
    'Repair & Complete',
  ];
  readonly currentProgressStep = computed(() => {
    const request = this.request();
    if (!request) return 1;
    const status = request.repairJob?.status;
    if (
      status === 'in_progress' ||
      status === 'on_hold' ||
      status === 'repair_completed' ||
      status === 'ready_for_pickup' ||
      status === 'picked_up' ||
      status === 'completed' ||
      status === 'inspection_approved' ||
      request.shopResponse.status === 'customer_accepted'
    ) {
      return 4;
    }
    if (
      status === 'awaiting_customer_approval' ||
      status === 'repair_declined' ||
      request.shopResponse.status === 'quotation_submitted' ||
      request.quotations.length
    ) {
      return 3;
    }
    return 2;
  });

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

  isRepairComplete(request: ShopRepairRequest): boolean {
    return request.repairJob?.status === 'completed' || request.status === 'completed';
  }

  progressDate(request: ShopRepairRequest, index: number): string | undefined {
    const repairJob = request.repairJob;
    const historyAt = (action: string): string | undefined =>
      repairJob?.history?.find((event) => event.action === action)?.at;
    switch (index) {
      case 0:
        return request.createdAt;
      case 1:
        return historyAt('inspection_pending') ?? repairJob?.confirmedAt;
      case 2:
        return (
          request.quotations.find((quotation) => quotation.status === 'accepted')?.respondedAt ??
          request.quotations[request.quotations.length - 1]?.createdAt
        );
      case 3:
        return (
          historyAt('repair_completed') ??
          repairJob?.repairCompletedAt ??
          historyAt('ready_for_pickup') ??
          repairJob?.readyForPickupAt ??
          repairJob?.completedAt
        );
      default:
        return undefined;
    }
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
        title: 'New Repair Request Details',
        label: 'New Requests',
        route: '/shop/jobs/new-jobs',
      },
      pending: {
        title: 'Pending Request Details',
        label: 'Pending Requests',
        route: '/shop/jobs/pending-jobs',
      },
      assigned: {
        title: 'Assigned Job Details',
        label: 'Assigned Jobs',
        route: '/shop/jobs/assigned-jobs',
      },
      active: {
        title: 'Active Job Details',
        label: 'Active Jobs',
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
        message: this.message().trim(),
        estimatedDays: this.completionDays()!,
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
      !!this.message().trim()
    );
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
    if (!request) return;
    this.runRepairAction('start', () =>
      this.requestsService.startRepair(request._id, this.progressNotes().trim() || undefined),
    );
  }

  holdRepair(): void {
    const request = this.request();
    if (!request) return;
    this.runRepairAction('hold', () =>
      this.requestsService.holdRepair(request._id, this.progressNotes().trim() || undefined),
    );
  }

  completeRepair(): void {
    const request = this.request();
    if (!request || !this.completionDescription().trim() || !this.workPerformed().trim()) {
      this.repairFormError.set('Describe the outcome and work performed before continuing.');
      return;
    }
    this.repairFormError.set('');
    this.runRepairAction('complete', () =>
      this.requestsService.completeRepair(request._id, {
        completionDescription: this.completionDescription().trim(),
        workPerformed: this.workPerformed().trim(),
        partsReplaced: this.partsReplaced().trim() || undefined,
        finalNotes: this.finalNotes().trim() || undefined,
      }),
    );
  }

  markReadyForPickup(): void {
    const request = this.request();
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
