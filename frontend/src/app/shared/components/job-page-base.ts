import { Directive, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { CustomerRepairRequest } from '../../customer/models/customer-portal.models';
import { ShopRepairRequest } from '../../shop/repair-requests/shop-repair-requests.models';
import { TechnicianRepairDetails } from '../../shop/technicians/technicians.models';
import {
  FilterConfig,
  FilterValues,
} from './filters/common-filter.component';
import {
  CustomerJobCategory,
  JobListItem,
  ShopJobCategory,
  TechnicianJobCategory,
} from '../models/job.models';
import { JobSharedService } from '../services/job-shared.service';
import { profileImageSource } from '../utils/appliance-thumbnail.util';

@Directive()
export abstract class JobListingPageBase implements OnInit {
  readonly jobs = inject(JobSharedService);
  readonly items = signal<JobListItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly search = signal('');
  readonly sort = signal<'newest' | 'oldest'>('newest');
  readonly statusFilter = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly filteredItems = computed(() => {
    const filtered = this.jobs.filterAndSort(this.items(), this.search(), this.sort());
    const status = this.statusFilter();
    return filtered.filter(
      (item) =>
        (!status || item.status === status) &&
        this.matchesPageFilters(item),
    );
  });
  readonly pageItems = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.filteredItems().slice(start, start + this.pageSize());
  });

  protected abstract loadItems(): Observable<JobListItem[]>;

  protected matchesPageFilters(_item: JobListItem): boolean {
    return true;
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set('');
    this.loadItems().subscribe({
      next: (items) => {
        this.items.set(items);
        this.page.set(1);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(this.jobs.errorMessage(error, 'Jobs could not be loaded.'));
        this.loading.set(false);
      },
    });
  }

  statusOptions(): string[] {
    return [...new Set(this.items().map((item) => item.status))].sort();
  }

  setSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  setSort(value: 'newest' | 'oldest'): void {
    this.sort.set(value);
    this.page.set(1);
  }

  setStatusFilter(value: string): void {
    this.statusFilter.set(value);
    this.page.set(1);
  }

  setPage(page: number): void {
    const maxPage = Math.max(1, Math.ceil(this.filteredItems().length / this.pageSize()));
    if (page >= 1 && page <= maxPage) this.page.set(page);
  }

  setPageSize(size: number): void {
    if ([5, 10, 25, 100].includes(size)) {
      this.pageSize.set(size);
      this.page.set(1);
    }
  }
}

@Directive()
export abstract class CustomerJobsListingPageBase extends JobListingPageBase {
  protected abstract readonly category: CustomerJobCategory;
  protected override loadItems(): Observable<JobListItem[]> {
    return this.jobs.customerJobs(this.category);
  }
}

@Directive()
export abstract class ShopJobsListingPageBase extends JobListingPageBase {
  protected abstract readonly category: ShopJobCategory;
  readonly appliedFilters = signal<FilterValues>({});

  get filterConfig(): FilterConfig {
    const titles: Record<ShopJobCategory, string> = {
      new: 'New job filters',
      pending: 'Pending job filters',
      assigned: 'Assigned job filters',
      active: 'Active job filters',
      disputed: 'Disputed job filters',
      completed: 'Completed job filters',
    };
    return {
      title: titles[this.category],
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
  }

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

  protected override loadItems(): Observable<JobListItem[]> {
    return this.jobs.shopJobs(this.category);
  }
}

@Directive()
export abstract class TechnicianJobsListingPageBase extends JobListingPageBase {
  protected abstract readonly category: TechnicianJobCategory;
  readonly appliedFilters = signal<FilterValues>({});

  get filterConfig(): FilterConfig {
    const titles: Record<TechnicianJobCategory, string> = {
      assigned: 'Assigned request filters',
      active: 'Active repair filters',
      completed: 'Completed repair filters',
    };
    return {
      title: titles[this.category],
      fields: [
        { key: 'appliance', label: 'Appliance or device', type: 'text' },
        { key: 'brand', label: 'Brand', type: 'text' },
        { key: 'assignedDate', label: 'Assigned date', type: 'date-range' },
      ],
    };
  }

  applyFilters(filters: FilterValues): void {
    this.appliedFilters.set(filters);
    this.page.set(1);
  }

  protected override matchesPageFilters(item: JobListItem): boolean {
    const filters = this.appliedFilters();
    const appliance = filters['appliance'];
    const brand = filters['brand'];
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
    const assignedDate = filters['assignedDate'];
    if (assignedDate && typeof assignedDate === 'object' && 'from' in assignedDate) {
      const assignedDay = (item.assignedAt ?? item.createdAt).slice(0, 10);
      if (
        (assignedDate.from && assignedDay < assignedDate.from) ||
        (assignedDate.to && assignedDay > assignedDate.to)
      ) {
        return false;
      }
    }
    return true;
  }

  protected override loadItems(): Observable<JobListItem[]> {
    return this.jobs.technicianJobs(this.category);
  }
}

@Directive()
export abstract class JobDetailPageBase<T> implements OnInit {
  protected readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  protected readonly jobs = inject(JobSharedService);
  readonly record = signal<T | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly customerImageUnavailable = signal(false);
  protected readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  abstract readonly backRoute: string;
  abstract readonly backLabel: string;
  abstract readonly pageTitle: string;

  protected abstract loadRecord(id: string): Observable<T>;

  ngOnInit(): void {
    if (!this.id) {
      this.error.set('A job ID is required to view this page.');
      this.loading.set(false);
      return;
    }
    this.loadRecord(this.id).subscribe({
      next: (record) => {
        this.record.set(record);
        this.customerImageUnavailable.set(false);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(this.jobs.errorMessage(error, 'Job details could not be loaded.'));
        this.loading.set(false);
      },
    });
  }

  goBack(): void {
    void this.router.navigateByUrl(this.backRoute);
  }

  refreshRecord(record: T): void {
    this.record.set(record);
    this.customerImageUnavailable.set(false);
  }

  customerPhotoSource(value?: string | null): string | null {
    const source = profileImageSource(value);
    return source && !this.customerImageUnavailable() ? source : null;
  }

  onCustomerImageError(): void {
    this.customerImageUnavailable.set(true);
  }
}

@Directive()
export abstract class CustomerJobDetailPageBase extends JobDetailPageBase<CustomerRepairRequest> {
  protected override loadRecord(id: string): Observable<CustomerRepairRequest> {
    return this.jobs.customerJob(id);
  }
}

@Directive()
export abstract class ShopJobDetailPageBase extends JobDetailPageBase<ShopRepairRequest> {
  protected override loadRecord(id: string): Observable<ShopRepairRequest> {
    return this.jobs.shopJob(id);
  }
}

@Directive()
export abstract class TechnicianJobDetailPageBase extends JobDetailPageBase<TechnicianRepairDetails> {
  readonly directionsLoader = (requestId: string) =>
    this.jobs.technicianDirections(requestId);

  protected override loadRecord(id: string): Observable<TechnicianRepairDetails> {
    return this.jobs.technicianJob(id);
  }
}
