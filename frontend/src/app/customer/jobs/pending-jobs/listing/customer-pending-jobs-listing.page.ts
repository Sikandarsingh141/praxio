import { CommonModule } from '@angular/common';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminPageHeaderComponent } from '../../../../shared/components/page-header/admin-page-header.component';
import { CustomerJobsListingPageBase } from '../../../../shared/components/job-page-base';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { JobPaginationComponent } from '../../../../shared/components/job-pagination/job-pagination.component';
import {
  CommonFilterComponent,
  FilterConfig,
  FilterValues,
} from '../../../../shared/components/filters/common-filter.component';
import {
  CustomerJobCategory,
  JobListItem,
  PendingJobQuotation,
} from '../../../../shared/models/job.models';
import { CustomerPortalService } from '../../../services/customer-portal.service';
import { ToastService } from '../../../../core/toast/toast.service';
import { TableScrollIndicatorsDirective } from '../../../../shared/directives/table-scroll-indicators.directive';

type QuotationResponseStatus = 'accepted' | 'declined';

interface PendingQuotationResponse {
  requestId: string;
  quotation: PendingJobQuotation;
  status: QuotationResponseStatus;
}

@Component({
  selector: 'app-customer-pending-jobs-listing-page',
  standalone: true,
  imports: [
    AdminPageHeaderComponent,
    CommonModule,
    OverlayModule,
    RouterLink,
    EmptyStateComponent,
    JobPaginationComponent,
    CommonFilterComponent,
    TableScrollIndicatorsDirective,
  ],
  templateUrl: './customer-pending-jobs-listing.page.html',
  styleUrl: './customer-pending-jobs-listing.page.scss',
})
export class CustomerPendingJobsListingPage extends CustomerJobsListingPageBase {
  protected override readonly category: CustomerJobCategory = 'pending';
  readonly title: string = 'Pending Requests';
  readonly description: string = 'Review requests with submitted quotations.';
  readonly detailRoute: string = '/customer/jobs/pending-jobs';
  readonly appliedFilters = signal<FilterValues>({});
  readonly failedImages = signal<Set<string>>(new Set<string>());
  readonly openActionsJobId = signal<string | null>(null);
  readonly quotationMenuPositions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
  ];
  readonly quotationResponse = signal<PendingQuotationResponse | null>(null);
  readonly quotationResponseError = signal('');
  readonly quotationRejectionReason = signal('');
  readonly respondingQuotationId = signal<string | null>(null);
  private readonly customerPortal = inject(CustomerPortalService);
  private readonly toastService = inject(ToastService);

  toggleActions(jobId: string): void {
    this.openActionsJobId.update((current) => (current === jobId ? null : jobId));
  }

  closeActions(): void {
    this.openActionsJobId.set(null);
  }

  prepareQuotationResponse(
    job: JobListItem,
    quotation: PendingJobQuotation,
    status: QuotationResponseStatus,
  ): void {
    this.openActionsJobId.set(null);
    this.quotationResponseError.set('');
    this.quotationRejectionReason.set('');
    this.quotationResponse.set({ requestId: job.id, quotation, status });
  }

  cancelQuotationResponse(): void {
    if (this.respondingQuotationId()) return;
    this.quotationResponse.set(null);
    this.quotationResponseError.set('');
  }

  submitQuotationResponse(): void {
    const response = this.quotationResponse();
    if (!response || this.respondingQuotationId()) return;

    this.respondingQuotationId.set(response.quotation.id);
    this.quotationResponseError.set('');
    this.customerPortal
      .updateQuotationStatus(
        response.quotation.id,
        response.status,
        this.quotationRejectionReason().trim() || undefined,
      )
      .subscribe({
        next: () => {
          this.quotationResponse.set(null);
          this.respondingQuotationId.set(null);
          this.toastService.success(
            'Quotation Updated',
            response.status === 'accepted' ? 'Quotation accepted.' : 'Quotation declined.',
          );
          this.reload();
        },
        error: (error: HttpErrorResponse) => {
          const message = error.error?.message || 'Quotation response could not be saved.';
          this.quotationResponseError.set(message);
          this.respondingQuotationId.set(null);
          this.toastService.error('Action Failed', message);
        },
      });
  }

  hasValidImage(job: JobListItem): boolean {
    if (!job.imageData || typeof job.imageData !== 'string') return false;
    if (this.failedImages().has(job.id)) return false;
    const trimmed = job.imageData.trim();
    return trimmed.length > 20;
  }

  getDeviceImageSrc(job: JobListItem): string {
    const data = job.imageData?.trim() || '';
    if (data.startsWith('data:') || data.startsWith('http://') || data.startsWith('https://') || data.startsWith('/')) {
      return data;
    }
    const mime = job.imageMimeType || 'image/jpeg';
    return `data:${mime};base64,${data}`;
  }

  onImageError(jobId: string): void {
    const updated = new Set(this.failedImages());
    updated.add(jobId);
    this.failedImages.set(updated);
  }

  formatBrandModel(job: JobListItem): string {
    const brand = job.brand?.trim() || '';
    const model = job.model?.trim() || '';
    if (brand && model) return `${brand} - ${model}`;
    if (brand) return brand;
    if (model) return model;
    return 'Brand not specified';
  }

  getDeviceType(item: JobListItem): 'cooler' | 'laptop' | 'mobile' | 'tv' | 'washing_machine' | 'headphone' | 'refrigerator' | 'printer' | 'ac' | 'generic' {
    const text = `${item.title || ''} ${item.brand || ''} ${item.model || ''} ${item.description || ''}`.toLowerCase();
    if (text.includes('cooler')) return 'cooler';
    if (text.includes('laptop') || text.includes('macbook') || text.includes('computer') || text.includes('dell') || text.includes('thinkpad')) return 'laptop';
    if (text.includes('mobile') || text.includes('phone') || text.includes('iphone') || text.includes('samsung') || text.includes('pixel')) return 'mobile';
    if (text.includes('tv') || text.includes('television') || text.includes('bravia') || text.includes('led') || text.includes('oled')) return 'tv';
    if (text.includes('wash') || text.includes('machine') || text.includes('dryer') || text.includes('ifb')) return 'washing_machine';
    if (text.includes('headphone') || text.includes('earphone') || text.includes('boat') || text.includes('audio')) return 'headphone';
    if (text.includes('refrigerator') || text.includes('fridge')) return 'refrigerator';
    if (text.includes('printer') || text.includes('print')) return 'printer';
    if (text.includes('ac') || text.includes('air conditioner') || text.includes('cooling')) return 'ac';
    return 'generic';
  }
  readonly filterConfig: FilterConfig = {
    title: 'Pending request filters',
    fields: [
      { key: 'appliance', label: 'Appliance or device', type: 'text' },
      { key: 'brand', label: 'Brand', type: 'text' },
      {
        key: 'serviceType',
        label: 'Service type',
        type: 'select',
        placeholder: 'Any service type',
        options: [
          { label: 'Shop visit', value: 'shop_visit' },
          { label: 'Home service', value: 'home_service' },
        ],
      },
      { key: 'requestDate', label: 'Request date', type: 'date-range' },
    ],
  };

  applyFilters(filters: FilterValues): void {
    this.appliedFilters.set(filters);
    this.page.set(1);
  }

  protected override matchesPageFilters(item: JobListItem): boolean {
    if (item.quotationSubmitted !== true) return false;

    const filters = this.appliedFilters();
    const appliance = filters['appliance'];
    const brand = filters['brand'];
    const serviceType = filters['serviceType'];
    if (
      typeof appliance === 'string' &&
      appliance.trim() &&
      !item.title.toLocaleLowerCase().includes(appliance.trim().toLocaleLowerCase())
    ) {
      return false;
    }
    if (
      typeof brand === 'string' &&
      brand.trim() &&
      !(item.brand ?? '').toLocaleLowerCase().includes(brand.trim().toLocaleLowerCase())
    ) {
      return false;
    }
    if (typeof serviceType === 'string' && serviceType && item.serviceType !== serviceType) {
      return false;
    }

    const requestDate = filters['requestDate'];
    if (requestDate && typeof requestDate === 'object' && 'from' in requestDate) {
      const requestDay = item.createdAt.slice(0, 10);
      if (
        (requestDate.from && requestDay < requestDate.from) ||
        (requestDate.to && requestDay > requestDate.to)
      ) {
        return false;
      }
    }
    return true;
  }
}

