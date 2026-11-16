import { CommonModule } from '@angular/common';
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
import { CustomerJobCategory, JobListItem } from '../../../../shared/models/job.models';

@Component({
  selector: 'app-customer-new-jobs-listing-page',
  standalone: true,
  imports: [
    AdminPageHeaderComponent,
    CommonModule,
    RouterLink,
    EmptyStateComponent,
    JobPaginationComponent,
    CommonFilterComponent,
  ],
  templateUrl: './customer-new-jobs-listing.page.html',
  styleUrl: './customer-new-jobs-listing.page.scss',
})
export class CustomerNewJobsListingPage extends CustomerJobsListingPageBase {
  protected override readonly category: CustomerJobCategory = 'new';
  readonly title: string = 'New Jobs';
  readonly description: string = 'Review newly submitted repair requests and manage incoming jobs.';
  readonly detailRoute: string = '/customer/jobs/new-jobs';
  readonly appliedFilters = signal<FilterValues>({});
  readonly failedImages = signal<Set<string>>(new Set<string>());

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

  formatJobId(id: string): string {
    if (!id) return '';
    return id.length > 8 ? id.slice(-8).toUpperCase() : id.toUpperCase();
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
    title: 'New job filters',
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

