import { CommonModule } from '@angular/common';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { Component, signal } from '@angular/core';
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
  JobShopPartner,
} from '../../../../shared/models/job.models';
import { TableScrollIndicatorsDirective } from '../../../../shared/directives/table-scroll-indicators.directive';

@Component({
  selector: 'app-customer-new-jobs-listing-page',
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
  templateUrl: './customer-new-jobs-listing.page.html',
  styleUrl: './customer-new-jobs-listing.page.scss',
})
export class CustomerNewJobsListingPage extends CustomerJobsListingPageBase {
  protected override readonly category: CustomerJobCategory = 'new';
  readonly title: string = 'Open Requests';
  readonly description: string =
    'Review newly submitted repair requests and manage incoming requests.';
  readonly detailRoute: string = '/customer/jobs/new-jobs';
  readonly appliedFilters = signal<FilterValues>({});
  readonly failedImages = signal<Set<string>>(new Set<string>());
  readonly failedShopImages = signal<Set<string>>(new Set<string>());
  readonly openActionsJobId = signal<string | null>(null);
  readonly detailMenuPositions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
  ];

  toggleActions(jobId: string): void {
    this.openActionsJobId.update((current) => (current === jobId ? null : jobId));
  }

  closeActions(): void {
    this.openActionsJobId.set(null);
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

  shopPartners(job: JobListItem): JobShopPartner[] {
    if (job.shopPartners?.length) return job.shopPartners;
    return job.shopName ? [{ id: job.id, name: job.shopName }] : [];
  }

  hasShopImage(shopId: string, logoUrl?: string | null): boolean {
    return !!logoUrl && !this.failedShopImages().has(shopId);
  }

  onShopImageError(shopId: string): void {
    const updated = new Set(this.failedShopImages());
    updated.add(shopId);
    this.failedShopImages.set(updated);
  }

  visibleShopPartners(job: JobListItem): JobShopPartner[] {
    return this.shopPartners(job).slice(0, 4);
  }

  additionalShopCount(job: JobListItem): number {
    return Math.max(0, this.shopPartners(job).length - 4);
  }

  shopPartnersLabel(job: JobListItem): string {
    const names = this.shopPartners(job).map((shop) => shop.name);
    return names.length ? `Selected shops: ${names.join(', ')}` : 'No shops selected';
  }

  shopInitial(name: string): string {
    return name.trim().charAt(0).toLocaleUpperCase() || 'S';
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
    title: 'Open request filters',
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

