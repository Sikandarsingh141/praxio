import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { ShopProfile } from '../../../../core/auth/auth.models';
import { ToastService } from '../../../../core/toast/toast.service';
import { ShopJobDetailPageBase } from '../../../../shared/components/job-page-base';
import { JobTimelineComponent } from '../../../../shared/components/job-timeline/job-timeline.component';
import { ShopRepairWorkflowComponent } from '../../../repair-job-details/components/shop-repair-workflow.component';
import { ShopRepairRouteComponent } from '../../../repair-job-details/components/shop-repair-route.component';
import { ShopRepairRequest } from '../../../repair-requests/shop-repair-requests.models';
import { ShopRepairRequestsService } from '../../../repair-requests/shop-repair-requests.service';

const DECLINE_REASONS = [
  'Service not offered',
  'Outside service area',
  'No current capacity',
  'Request details are insufficient',
  'Other',
];

@Component({
  selector: 'app-shop-new-job-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    JobTimelineComponent,
    ShopRepairWorkflowComponent,
    ShopRepairRouteComponent,
  ],
  templateUrl: './shop-new-job-detail.page.html',
  styleUrl: './shop-new-job-detail.page.scss',
})
export class ShopNewJobDetailPage extends ShopJobDetailPageBase implements OnInit {
  readonly authService = inject(AuthService);
  readonly requestsService = inject(ShopRepairRequestsService);
  readonly toast = inject(ToastService);
  readonly reasons = DECLINE_REASONS;
  readonly shopProfile = signal<ShopProfile | null>(null);
  readonly quotationOpen = signal(false);
  readonly declineOpen = signal(false);
  readonly submitting = signal(false);
  readonly formError = signal('');
  readonly quotationAttempted = signal(false);
  readonly quotationAmount = signal<number | null>(null);
  readonly completionDays = signal<number | null>(null);
  readonly validityDays = signal<number | null>(7);
  readonly quotationMessage = signal('');
  readonly declineReason = signal('');
  readonly customDeclineReason = signal('');
  readonly selectedPhoto = signal<number | null>(null);
  readonly unavailablePhotos = signal(new Set<number>());
  readonly heroImageUnavailable = signal(false);
  readonly progressSteps = ['Request Submitted', 'Inspection Pending', 'Quotation', 'Repair & Complete'];
  readonly customerCoordinates = computed(() => {
    const request = this.record();
    if (!request) return null;
    if (request.customer.location) return request.customer.location;
    if (
      typeof request.customerLatitude === 'number' &&
      typeof request.customerLongitude === 'number'
    ) {
      return { latitude: request.customerLatitude, longitude: request.customerLongitude };
    }
    return null;
  });
  readonly customerMapUrl = computed(() => {
    const location = this.customerCoordinates();
    return this.isValidCoordinates(location)
      ? `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`
      : null;
  });
  readonly currentProgressStep = computed(() => {
    const request = this.record();
    if (!request) return 1;
    if (request.repairJob || request.shopResponse.status === 'customer_accepted') return 4;
    if (request.shopResponse.status === 'quotation_submitted') return 3;
    return 2;
  });
  readonly canRespond = computed(() => {
    const request = this.record();
    return !!request &&
      request.status === 'open' &&
      ['new', 'pending'].includes(request.shopResponse.status) &&
      (!request.shopResponse.responseDeadline ||
        new Date(request.shopResponse.responseDeadline).getTime() > Date.now());
  });

  readonly backRoute = '/shop/jobs/new-jobs';
  readonly backLabel = 'New Requests';
  readonly pageTitle = 'New Repair Request Details';
  legacyDetailRoute(id: string): string[] { return ['/shop/repair-requests', id]; }

  override ngOnInit(): void {
    super.ngOnInit();
    this.authService.getMyShopProfile().subscribe({
      next: (profile) => this.shopProfile.set(profile),
      error: (error: HttpErrorResponse) => {
        console.error('Shop location could not be loaded for repair directions.', error);
      },
    });
  }

  statusLabel(request: ShopRepairRequest): string {
    if (request.shopResponse.status === 'new') return 'Inspection Pending';
    const status = request.shopResponse.status.replace(/_/g, ' ');
    return status.replace(/^\w/, (firstLetter) => firstLetter.toUpperCase());
  }

  customerName(request: ShopRepairRequest): string {
    return request.customer.displayName ||
      [request.customer.firstName, request.customer.lastName].filter(Boolean).join(' ') ||
      'Customer';
  }

  customerAddress(): string {
    const location = this.customerCoordinates();
    return this.isValidCoordinates(location)
      ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
      : 'Location not provided';
  }

  isQuotationValid(): boolean {
    const amount = this.quotationAmount();
    const days = this.completionDays();
    const validity = this.validityDays();
    return amount !== null && Number.isFinite(amount) && amount > 0 &&
      days !== null && Number.isInteger(days) && days > 0 &&
      validity !== null && Number.isInteger(validity) && validity > 0 && validity <= 365 &&
      !!this.quotationMessage().trim();
  }

  submitQuotation(): void {
    const request = this.record();
    this.quotationAttempted.set(true);
    this.formError.set('');
    if (!request || !this.canRespond() || !this.isQuotationValid()) return;

    const days = this.validityDays();
    const amount = this.quotationAmount();
    const completionDays = this.completionDays();
    if (days === null || amount === null || completionDays === null) return;

    this.submitting.set(true);
    this.requestsService.submitQuotation(request._id, {
      amount,
      currency: 'INR',
      message: this.quotationMessage().trim(),
      estimatedDays: completionDays,
      validUntil: new Date(Date.now() + days * 86400000).toISOString(),
    }).subscribe({
      next: () => {
        this.toast.success('Quotation Submitted!', 'The customer has been notified successfully.');
        this.quotationOpen.set(false);
        this.submitting.set(false);
        this.reloadRequest(request._id);
      },
      error: (error: HttpErrorResponse) => {
        const message = error.error?.message || 'Quotation could not be submitted.';
        this.formError.set(message);
        this.toast.error('Submission Failed', message);
        this.submitting.set(false);
      },
    });
  }

  declineRequest(): void {
    const request = this.record();
    const reason = this.declineReason() === 'Other'
      ? this.customDeclineReason().trim()
      : this.declineReason().trim();
    if (!request || !this.canRespond()) return;
    if (!reason) {
      this.formError.set('Choose or enter a reason before declining.');
      return;
    }
    this.submitting.set(true);
    this.formError.set('');
    this.requestsService.decline(request._id, reason).subscribe({
      next: () => {
        this.toast.info('Request Declined', 'The customer has been notified.');
        this.declineOpen.set(false);
        this.submitting.set(false);
        this.reloadRequest(request._id);
      },
      error: (error: HttpErrorResponse) => {
        const message = error.error?.message || 'Request could not be declined.';
        this.formError.set(message);
        this.toast.error('Decline Failed', message);
        this.submitting.set(false);
      },
    });
  }

  photoSource(index: number, request: ShopRepairRequest): string {
    const data = request.photos[index]?.data?.trim();
    if (!data) return '';
    if (data.startsWith('data:') || /^https?:\/\//i.test(data) || data.startsWith('/') || data.startsWith('blob:')) {
      return data;
    }
    return `data:${request.photos[index].mimeType || 'image/jpeg'};base64,${data}`;
  }

  markPhotoUnavailable(index: number): void {
    this.unavailablePhotos.update((unavailable) => new Set(unavailable).add(index));
  }

  openPhoto(index: number): void {
    if (!this.unavailablePhotos().has(index)) this.selectedPhoto.set(index);
  }

  changePhoto(direction: -1 | 1): void {
    const request = this.record();
    const current = this.selectedPhoto();
    if (!request || current === null || request.photos.length < 1) return;
    this.selectedPhoto.set((current + direction + request.photos.length) % request.photos.length);
  }

  copyRequestId(id: string): void {
    void navigator.clipboard.writeText(id).then(
      () => this.toast.success('Copied', 'Request ID copied to clipboard.'),
      () => this.toast.error('Copy Failed', 'Request ID could not be copied.'),
    );
  }

  progressDate(index: number): string | undefined {
    return index === 0 ? this.record()?.createdAt : undefined;
  }

  private reloadRequest(id: string): void {
    this.requestsService.get(id).subscribe({
      next: (request) => this.record.set(request),
      error: (error: HttpErrorResponse) => {
        this.error.set(error.error?.message || 'Updated request could not be reloaded.');
      },
    });
  }

  private isValidCoordinates(
    location: { latitude: number; longitude: number } | null | undefined,
  ): location is { latitude: number; longitude: number } {
    return !!location &&
      Number.isFinite(location.latitude) && location.latitude >= -90 && location.latitude <= 90 &&
      Number.isFinite(location.longitude) && location.longitude >= -180 && location.longitude <= 180;
  }
}

