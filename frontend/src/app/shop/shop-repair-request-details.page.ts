import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ShopProfile } from '../core/auth/auth.models';
import { AuthService } from '../core/auth/auth.service';
import { ShopRepairRequest } from './shop-repair-requests.models';
import { ShopRepairRequestsService } from './shop-repair-requests.service';
import { ShopRepairRouteComponent } from './shop-repair-route.component';
import { ShopRepairWorkflowComponent } from './shop-repair-workflow.component';
import { AdminPageHeaderComponent } from '../admin/admin-page-header.component';

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
    AdminPageHeaderComponent,
    CommonModule,
    FormsModule,
    RouterLink,
    ShopRepairRouteComponent,
    ShopRepairWorkflowComponent,
  ],
  templateUrl: './shop-repair-request-details.page.html',
  styleUrl: './shop-repair-request-details.page.scss',
})
export class ShopRepairRequestDetailsPage implements OnInit {
  readonly reasons = DECLINE_REASONS;
  readonly request = signal<ShopRepairRequest | null>(null);
  readonly shopProfile = signal<ShopProfile | null>(null);
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
    if (request.repairJob || request.shopResponse.status === 'customer_accepted') return 4;
    if (request.shopResponse.status === 'quotation_submitted') return 3;
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
  ) {}

  setRequest(request: ShopRepairRequest): void {
    this.request.set(request);
  }

  ngOnInit(): void {
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
          this.success.set('Quotation submitted. The customer has been notified.');
          this.quotationOpen.set(false);
          this.submitting.set(false);
          this.reloadRequest(request._id);
        },
        error: (error: HttpErrorResponse) => {
          this.formError.set(error.error?.message || 'Quotation could not be submitted.');
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
        this.success.set('Request declined. The customer has been notified.');
        this.declineOpen.set(false);
        this.submitting.set(false);
        this.reloadRequest(request._id);
      },
      error: (error: HttpErrorResponse) => {
        this.formError.set(error.error?.message || 'Request could not be declined.');
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
        this.success.set(messages[action]);
        this.repairActionSubmitting.set(false);
        this.reloadRequest(id);
      },
      error: (error: HttpErrorResponse) => {
        this.repairFormError.set(error.error?.message || 'Repair status could not be updated.');
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
