import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Observable } from 'rxjs';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { UserProfile } from '../../../../core/auth/auth.models';
import { CustomerRepairRequest } from '../../../models/customer-portal.models';
import { CustomerPortalService } from '../../../services/customer-portal.service';
import { CustomerJobDetailPageBase } from '../../../../shared/components/job-page-base';
import { JobAttachmentsComponent } from '../../../../shared/components/job-attachments/job-attachments.component';
import { JobTimelineComponent } from '../../../../shared/components/job-timeline/job-timeline.component';
import type { RepairRoute } from '../../../../shared/models/repair-route.models';
import { CustomerRepairWorkflowComponent } from '../../../repair-requests/components/customer-repair-workflow.component';
import { ShopRepairRouteComponent } from '../../../../shop/repair-job-details/components/shop-repair-route.component';
import { buildRepairProgressSteps } from '../../../../shared/utils/repair-progress.util';

type Coordinates = { latitude: number; longitude: number };

interface CustomerShopSummary {
  id: string;
  name: string;
  logoUrl?: string | null;
  address?: string;
}

@Component({
  selector: 'app-customer-active-job-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    JobAttachmentsComponent,
    JobTimelineComponent,
    CustomerRepairWorkflowComponent,
    ShopRepairRouteComponent,
  ],
  templateUrl: './customer-active-job-detail.page.html',
  styleUrl: './customer-active-job-detail.page.scss',
})
export class CustomerActiveJobDetailPage extends CustomerJobDetailPageBase {
  readonly authService = inject(AuthService);
  readonly workflowRef = viewChild(CustomerRepairWorkflowComponent);
  readonly heroImageUnavailable = signal(false);
  readonly shopLogoUnavailable = signal<string | null>(null);
  readonly shopLocation = signal<Coordinates | null>(null);
  readonly shopLocationLoading = signal(false);
  readonly shopLocationError = signal('');
  readonly progressSteps = computed(() => this.buildProgressSteps());
  private readonly customerPortal = inject(CustomerPortalService);
  private readonly destroyRef = inject(DestroyRef);
  private requestedShopId: string | null = null;
  readonly customerDirectionsLoader = (requestId: string): Observable<RepairRoute> =>
    this.customerPortal.getRepairRoute(requestId);
  readonly backRoute = '/customer/jobs/active-jobs';
  readonly backLabel = 'Active Repairs';
  readonly pageTitle = 'Active Repair Details';

  constructor() {
    super();
    effect(() => {
      const request = this.record();
      const shopId = request ? this.shopDetails(request)?.id ?? null : null;
      if (shopId === this.requestedShopId) return;

      this.requestedShopId = shopId;
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
            this.shopLocation.set(shop.location);
            this.shopLocationLoading.set(false);
          },
          error: () => {
            if (this.requestedShopId !== shopId) return;
            this.shopLocationError.set('The repair shop location could not be loaded.');
            this.shopLocationLoading.set(false);
          },
        });
    });
  }

  legacyDetailRoute(id: string): string[] {
    return ['/customer/repair-requests', id];
  }

  photoSource(photo: NonNullable<CustomerRepairRequest['photos']>[number]): string {
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

  shopDetails(job: CustomerRepairRequest): CustomerShopSummary | null {
    if (job.shop) {
      return {
        id: job.shop.id,
        name: job.shop.name,
        logoUrl: job.shop.logoUrl,
        address: job.shop.address,
      };
    }

    const shop =
      job.shops?.find((item) => item.id === job.acceptedQuotation?.shopId) ??
      job.shops?.find((item) => item.responseStatus === 'customer_accepted') ??
      job.shops?.find((item) => item.responseStatus === 'quotation_submitted') ??
      job.shops?.[0];
    return shop ? { id: shop.id, name: shop.name, logoUrl: shop.logoUrl } : null;
  }

  statusLabel(job: CustomerRepairRequest): string {
    const status = job.repairJob?.status ?? job.status;
    if (!job.repairJob && status === 'open') return 'New';
    return status
      .replace(/_/g, ' ')
      .replace(/^\w/, (firstLetter) => firstLetter.toUpperCase());
  }

  customerName(user: UserProfile): string {
    return [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Customer';
  }

  customerInitials(user: UserProfile): string {
    const name = this.customerName(user);
    return name === 'Customer'
      ? user.email.slice(0, 1).toUpperCase() || 'C'
      : name
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part.charAt(0).toUpperCase())
          .join('');
  }

  customerPhone(user: UserProfile): string {
    return [user.countryCode, user.mobileNumber].filter(Boolean).join(' ') || 'Not provided';
  }

  customerLocation(user: UserProfile): string {
    return user.location
      ? `${user.location.latitude.toFixed(5)}, ${user.location.longitude.toFixed(5)}`
      : 'Not provided';
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

  private buildProgressSteps() {
    const job = this.record();
    if (!job) return [];
    const repairJob = job.repairJob;
    const acceptedQuotation =
      job.quotations.find((quotation) => quotation.status === 'accepted') ??
      job.acceptedQuotation;
    const quotationAccepted = Boolean(
      job.acceptedQuotationId ||
        repairJob?.acceptedQuotationId ||
        acceptedQuotation?.status === 'accepted' ||
        job.shops?.some((shop) => shop.responseStatus === 'customer_accepted'),
    );
    const quotationSubmitted =
      job.quotations.length > 0 ||
      job.shops?.some((shop) => shop.responseStatus === 'quotation_submitted');
    const acceptedAt = acceptedQuotation?.respondedAt ?? repairJob?.confirmedAt;

    return buildRepairProgressSteps({
      requestCreatedAt: job.createdAt,
      requestStatus: job.status,
      repairJob,
      quotationStatus: quotationAccepted
        ? 'accepted'
        : quotationSubmitted
          ? 'submitted'
          : 'none',
      acceptedAt,
      quotationAt:
        acceptedAt ??
        job.quotations.at(-1)?.createdAt ??
        job.acceptedQuotation?.createdAt,
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
