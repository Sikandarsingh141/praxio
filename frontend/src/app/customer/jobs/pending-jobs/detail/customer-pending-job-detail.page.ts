import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Observable } from 'rxjs';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import {
  CustomerRepairRequest,
  RepairQuotation,
  ShopSearchResult,
} from '../../../models/customer-portal.models';
import { CustomerRepairShopProfileComponent } from '../../components/customer-repair-shop-profile.component';
import { CustomerPortalService } from '../../../services/customer-portal.service';
import { CustomerJobDetailPageBase } from '../../../../shared/components/job-page-base';
import { JobAttachmentsComponent } from '../../../../shared/components/job-attachments/job-attachments.component';
import { JobTimelineComponent } from '../../../../shared/components/job-timeline/job-timeline.component';
import { RepairProgressComponent } from '../../../../shared/components/repair-progress/repair-progress.component';
import type { RepairRoute } from '../../../../shared/models/repair-route.models';
import { ShopRepairRouteComponent } from '../../../../shop/repair-job-details/components/shop-repair-route.component';
import { ToastService } from '../../../../core/toast/toast.service';

type Coordinates = { latitude: number; longitude: number };
type QuotationResponseStatus = 'accepted' | 'declined';

interface CustomerQuotationResponse {
  requestId: string;
  quotation: RepairQuotation;
  shopName: string;
  status: QuotationResponseStatus;
}

@Component({
  selector: 'app-customer-pending-job-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    JobAttachmentsComponent,
    JobTimelineComponent,
    RepairProgressComponent,
    ShopRepairRouteComponent,
    CustomerRepairShopProfileComponent,
  ],
  templateUrl: './customer-pending-job-detail.page.html',
  styleUrl: './customer-pending-job-detail.page.scss',
})
export class CustomerPendingJobDetailPage extends CustomerJobDetailPageBase {
  readonly authService = inject(AuthService);
  readonly heroImageUnavailable = signal(false);
  readonly shopLocation = signal<Coordinates | null>(null);
  readonly shopLocationLoading = signal(false);
  readonly shopLocationError = signal('');
  readonly shopProfile = signal<ShopSearchResult | null>(null);
  readonly shopProfileError = signal('');
  readonly quotationResponse = signal<CustomerQuotationResponse | null>(null);
  readonly quotationResponseError = signal('');
  readonly quotationRejectionReason = signal('');
  readonly respondingQuotationId = signal<string | null>(null);
  private readonly customerPortal = inject(CustomerPortalService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private requestedShopId: string | null = null;
  readonly customerDirectionsLoader = (requestId: string): Observable<RepairRoute> =>
    this.customerPortal.getRepairRoute(requestId);
  readonly backRoute = '/customer/jobs/pending-jobs';
  readonly backLabel = 'Pending Requests';
  readonly pageTitle = 'Pending Request Details';

  constructor() {
    super();
    effect(() => {
      const request = this.record();
      const shopId = request ? this.shopDetails(request)?.id ?? null : null;
      if (shopId === this.requestedShopId) return;

      this.requestedShopId = shopId;
      this.shopProfile.set(null);
      this.shopProfileError.set('');
      this.shopLocation.set(null);
      this.shopLocationError.set('');
      this.shopLocationLoading.set(!!shopId);
      if (!shopId) return;

      this.customerPortal
        .getShop(shopId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (shop) => {
            if (this.requestedShopId !== shopId) return;
            this.shopProfile.set(shop);
            this.shopLocation.set(shop.location);
            this.shopLocationLoading.set(false);
          },
          error: () => {
            if (this.requestedShopId !== shopId) return;
            this.shopProfileError.set('Shop profile information could not be loaded.');
            this.shopLocationError.set('The repair shop location could not be loaded.');
            this.shopLocationLoading.set(false);
          },
        });
    });
  }

  legacyDetailRoute(id: string): string[] { return ['/customer/repair-requests', id]; }

  photoSource(photo: NonNullable<CustomerRepairRequest['photos']>[number]): string {
    const data = photo.data.trim();
    if (data.startsWith('data:') || /^https?:\/\//i.test(data) || data.startsWith('/') || data.startsWith('blob:')) {
      return data;
    }
    return `data:${photo.mimeType || 'image/jpeg'};base64,${data}`;
  }

  shopDetails(job: CustomerRepairRequest): CustomerShopSummary | null {
    if (job.shop) {
      return {
        id: job.shop.id,
        name: job.shop.name,
        logoUrl: job.shop.logoUrl,
        address: job.shop.address,
      };
    }
    const shop = job.shops?.find((item) => item.responseStatus === 'quotation_submitted') ??
      job.shops?.[0];
    return shop
      ? { id: shop.id, name: shop.name, logoUrl: shop.logoUrl }
      : null;
  }

  statusLabel(job: CustomerRepairRequest): string {
    const status = job.repairJob?.status ?? job.status;
    if (!job.repairJob && status === 'open') return 'New';
    return status
      .replace(/_/g, ' ')
      .replace(/^\w/, (firstLetter) => firstLetter.toUpperCase());
  }

  customerCoordinates(job: CustomerRepairRequest): Coordinates | null {
    const requestCoordinates =
      typeof job.customerLatitude === 'number' &&
      typeof job.customerLongitude === 'number'
        ? { latitude: job.customerLatitude, longitude: job.customerLongitude }
        : null;
    const profileLocation = this.authService.currentUser()?.location ?? null;
    const location = requestCoordinates ?? profileLocation;
    return this.isValidCoordinates(location) ? location : null;
  }

  hasRouteCoordinates(job: CustomerRepairRequest): boolean {
    return (
      this.isValidCoordinates(this.shopLocation()) &&
      this.isValidCoordinates(this.customerCoordinates(job))
    );
  }

  formatStatus(status: string): string {
    return status
      .replace(/_/g, ' ')
      .replace(/^\w/, (firstLetter) => firstLetter.toUpperCase());
  }

  canRespondToQuotation(job: CustomerRepairRequest, quotation: RepairQuotation): boolean {
    return (
      !job.acceptedQuotation &&
      (quotation.status === 'pending' || quotation.status === 'sent')
    );
  }

  quotationShopName(job: CustomerRepairRequest, quotation: RepairQuotation): string {
    return (
      job.shops?.find((shop) => shop.id === quotation.shopId)?.name ??
      job.shop?.name ??
      'Repair shop'
    );
  }

  prepareQuotationResponse(
    job: CustomerRepairRequest,
    quotation: RepairQuotation,
    status: QuotationResponseStatus,
  ): void {
    this.quotationResponseError.set('');
    this.quotationRejectionReason.set('');
    this.quotationResponse.set({
      requestId: job._id,
      quotation,
      shopName: this.quotationShopName(job, quotation),
      status,
    });
  }

  cancelQuotationResponse(): void {
    if (this.respondingQuotationId()) return;
    this.quotationResponse.set(null);
    this.quotationResponseError.set('');
  }

  submitQuotationResponse(): void {
    const response = this.quotationResponse();
    if (!response || this.respondingQuotationId()) return;

    this.respondingQuotationId.set(response.quotation._id);
    this.quotationResponseError.set('');
    this.customerPortal
      .updateQuotationStatus(
        response.quotation._id,
        response.status,
        this.quotationRejectionReason().trim() || undefined,
      )
      .subscribe({
        next: () => {
          this.quotationResponse.set(null);
          this.respondingQuotationId.set(null);
          this.toastService.success(
            'Quotation Updated',
            response.status === 'accepted'
              ? 'Quotation accepted. This shop has been selected for your repair request.'
              : 'Quotation declined.',
          );
          this.customerPortal.getRepairJob(response.requestId).subscribe({
            next: (job) => this.refreshRecord(job),
            error: (error: HttpErrorResponse) => {
              this.toastService.error(
                'Refresh Failed',
                error.error?.message || 'The latest repair details could not be loaded.',
              );
            },
          });
        },
        error: (error: HttpErrorResponse) => {
          const message = error.error?.message || 'Quotation response could not be saved.';
          this.quotationResponseError.set(message);
          this.respondingQuotationId.set(null);
          this.toastService.error('Action Failed', message);
        },
      });
  }

  private isValidCoordinates(
    location: Coordinates | null | undefined,
  ): location is Coordinates {
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

interface CustomerShopSummary {
  id: string;
  name: string;
  logoUrl?: string | null;
  address?: string;
}

