import { CommonModule } from '@angular/common';
import { Component, computed, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  customerRepairRequestStatusLabel,
  CustomerRepairRequest,
  CustomerRepairRequestFilters,
  ShopSearchResult,
} from './customer-portal.models';
import { CustomerPortalService } from './customer-portal.service';
import {
  CommonFilterComponent,
  FilterConfig,
  FilterValues,
} from '../shared/common-filter.component';

type RequestStatusTab = 'all' | 'open' | 'in_progress' | 'completed' | 'disputed';

@Component({
  selector: 'app-customer-repair-requests',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CommonFilterComponent],
  templateUrl: './customer-repair-requests.page.html',
  styleUrl: './customer-repair-requests.page.scss',
})
export class CustomerRepairRequestsPage implements OnInit {
  readonly requests = signal<CustomerRepairRequest[]>([]);
  readonly selectedStatus = signal<RequestStatusTab>('all');
  readonly statusTabs: Array<{ key: RequestStatusTab; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'completed', label: 'Completed' },
    { key: 'disputed', label: 'Disputed' },
  ];
  readonly sortOrder = signal<'newest' | 'oldest'>('newest');
  readonly visibleRequests = computed(() => {
    const filtered = this.requests().filter((request) => {
      switch (this.selectedStatus()) {
        case 'open':
          return request.status === 'open' && !request.repairJob;
        case 'in_progress':
          return (
            !!request.repairJob &&
            !['completed', 'repair_declined', 'disputed'].includes(request.repairJob.status)
          );
        case 'completed':
          return this.requestStatusLabel(request) === 'Completed';
        case 'disputed':
          return this.requestStatusLabel(request) === 'Disputed';
        default:
          return true;
      }
    });
    const direction = this.sortOrder() === 'newest' ? -1 : 1;
    return filtered.sort(
      (left, right) =>
        direction * (new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()),
    );
  });
  readonly loading = signal(true);
  readonly error = signal('');
  readonly actionError = signal('');
  readonly updating = signal<string | null>(null);
  readonly editRequest = signal<CustomerRepairRequest | null>(null);
  readonly editableShops = signal<Array<{ id: string; shopName: string }>>([]);
  readonly selectedEditShops = signal<string[]>([]);
  readonly editAppliance = signal('');
  readonly editBrand = signal('');
  readonly editModel = signal('');
  readonly editDescription = signal('');
  readonly editPreferredDate = signal('');
  readonly editServiceType = signal<'shop_visit' | 'home_service'>('shop_visit');
  readonly editPhotos = signal<File[]>([]);
  readonly removeExistingPhotos = signal(false);
  readonly editError = signal('');
  readonly editPhotoError = signal('');
  readonly savingEdit = signal(false);
  readonly actionMessage = signal('');
  readonly appliedFilters = signal<FilterValues>({});
  readonly filterConfig: FilterConfig = {
    title: 'Repair request filters',
    fields: [
      {
        key: 'status',
        label: 'Request status',
        type: 'select',
        placeholder: 'All requests',
        options: [
          { label: 'Open', value: 'open' },
          { label: 'Cancelled', value: 'cancelled' },
          { label: 'Completed', value: 'completed' },
        ],
      },
      {
        key: 'repairStatus',
        label: 'Repair status',
        type: 'select',
        placeholder: 'Any repair status',
        options: [
          { label: 'Confirmed', value: 'confirmed' },
          { label: 'Inspection pending', value: 'inspection_pending' },
          { label: 'Inspection in progress', value: 'inspection_in_progress' },
          { label: 'Estimate awaiting approval', value: 'awaiting_customer_approval' },
          { label: 'Inspection approved', value: 'inspection_approved' },
          { label: 'Repair declined', value: 'repair_declined' },
          { label: 'In progress', value: 'in_progress' },
          { label: 'On hold', value: 'on_hold' },
          { label: 'Repair completed', value: 'repair_completed' },
          { label: 'Ready for pickup', value: 'ready_for_pickup' },
          { label: 'Picked up', value: 'picked_up' },
          { label: 'Completed', value: 'completed' },
          { label: 'Issue reported', value: 'disputed' },
        ],
      },
      { key: 'appliance', label: 'Device category', type: 'text' },
      { key: 'requestDate', label: 'Request date', type: 'date-range' },
    ],
  };

  constructor(private readonly portal: CustomerPortalService) {}

  ngOnInit(): void {
    this.loadRequests();
  }

  loadRequests(): void {
    this.loading.set(true);
    const requestDate = this.appliedFilters()['requestDate'];
    const dateRange =
      requestDate && typeof requestDate === 'object' && 'from' in requestDate ? requestDate : {};
    const filters = this.appliedFilters();
    this.portal
      .getRepairRequests({
        status: this.requestStatus(filters['status']),
        repairStatus: this.repairStatus(filters['repairStatus']),
        appliance: typeof filters['appliance'] === 'string' ? filters['appliance'] : undefined,
        from: dateRange.from,
        to: dateRange.to,
      })
      .subscribe({
        next: (requests) => {
          this.requests.set(requests);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.error.set(error.error?.message || 'Your repair requests could not be loaded.');
          this.loading.set(false);
        },
      });
  }

  applyFilters(filters: FilterValues): void {
    if (JSON.stringify(this.appliedFilters()) === JSON.stringify(filters)) return;
    this.appliedFilters.set(filters);
    this.loadRequests();
  }

  hasAppliedFilters(): boolean {
    return Object.keys(this.appliedFilters()).length > 0;
  }

  statusCount(status: RequestStatusTab): number {
    if (status === 'all') return this.requests().length;
    return this.requests().filter((request) => {
      switch (status) {
        case 'open':
          return request.status === 'open' && !request.repairJob;
        case 'in_progress':
          return (
            !!request.repairJob &&
            !['completed', 'repair_declined', 'disputed'].includes(request.repairJob.status)
          );
        case 'completed':
          return this.requestStatusLabel(request) === 'Completed';
        case 'disputed':
          return this.requestStatusLabel(request) === 'Disputed';
      }
    }).length;
  }

  selectStatus(status: RequestStatusTab): void {
    this.selectedStatus.set(status);
  }

  requestStatusLabel(request: CustomerRepairRequest): string {
    return customerRepairRequestStatusLabel(request);
  }

  canEditRequest(request: CustomerRepairRequest): boolean {
    return (
      request.status === 'open' &&
      !request.repairJob &&
      request.quotations.length === 0 &&
      !request.shops?.some((shop) =>
        ['quotation_submitted', 'customer_accepted', 'customer_rejected'].includes(
          shop.responseStatus ?? '',
        ),
      )
    );
  }

  openEdit(request: CustomerRepairRequest): void {
    this.editRequest.set(request);
    this.editError.set('');
    this.editPhotoError.set('');
    this.editPhotos.set([]);
    this.removeExistingPhotos.set(false);
    this.editAppliance.set(request.appliance);
    this.editBrand.set(request.brand ?? '');
    this.editModel.set(request.model ?? '');
    this.editDescription.set(request.description);
    this.editPreferredDate.set(request.preferredServiceDate?.slice(0, 10) ?? '');
    this.editServiceType.set(request.serviceType ?? 'shop_visit');
    this.selectedEditShops.set([...request.shopIds]);
    this.editableShops.set(
      (request.shops ?? []).map((shop) => ({ id: shop.id, shopName: shop.name })),
    );

    this.portal.searchShops({}).subscribe({
      next: (shops) => this.mergeEditableShops(shops),
      error: (error: HttpErrorResponse) => {
        this.editError.set(
          error.error?.message ||
            'Available repair shops could not be loaded. Existing selections are still shown.',
        );
      },
    });
  }

  closeEdit(): void {
    if (this.savingEdit()) return;
    this.editRequest.set(null);
    this.editError.set('');
    this.editPhotoError.set('');
  }

  toggleEditShop(shopId: string): void {
    this.selectedEditShops.update((selected) => {
      if (selected.includes(shopId)) return selected.filter((id) => id !== shopId);
      if (selected.length >= 5) {
        this.editError.set('You can select up to 5 repair shops.');
        return selected;
      }
      this.editError.set('');
      return [...selected, shopId];
    });
  }

  onEditPhotoSelection(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    const invalid = files.find(
      (file) =>
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 1024 * 1024,
    );
    if (files.length > 4 || invalid) {
      this.editPhotos.set([]);
      this.editPhotoError.set(
        'Choose up to 4 JPEG, PNG, or WebP photos, each no larger than 1 MB.',
      );
      input.value = '';
      return;
    }
    this.editPhotos.set(files);
    this.editPhotoError.set('');
    if (files.length) this.removeExistingPhotos.set(false);
  }

  saveEdit(): void {
    const request = this.editRequest();
    if (!request) return;
    if (!this.selectedEditShops().length) {
      this.editError.set('Select at least one repair shop.');
      return;
    }
    if (!this.editAppliance().trim() || !this.editDescription().trim()) {
      this.editError.set('Enter the appliance and describe the problem.');
      return;
    }
    if (this.editPhotoError()) return;

    this.savingEdit.set(true);
    this.editError.set('');
    this.actionError.set('');
    this.portal
      .updateRepairRequest(request._id, {
        shopIds: this.selectedEditShops(),
        appliance: this.editAppliance().trim(),
        description: this.editDescription().trim(),
        brand: this.editBrand().trim() || undefined,
        model: this.editModel().trim() || undefined,
        preferredServiceDate: this.editPreferredDate() || undefined,
        serviceType: this.editServiceType(),
        photos: this.editPhotos(),
        removeExistingPhotos: this.removeExistingPhotos(),
      })
      .subscribe({
        next: () => {
          this.savingEdit.set(false);
          this.editRequest.set(null);
          this.actionMessage.set('Your repair request was updated.');
          this.loadRequests();
        },
        error: (error: HttpErrorResponse) => {
          this.editError.set(error.error?.message || 'Your repair request could not be updated.');
          this.savingEdit.set(false);
        },
      });
  }

  private mergeEditableShops(shops: ShopSearchResult[]): void {
    const available = shops.map((shop) => ({ id: shop.id, shopName: shop.shopName }));
    const byId = new Map(this.editableShops().map((shop) => [shop.id, shop]));
    available.forEach((shop) => byId.set(shop.id, shop));
    this.editableShops.set([...byId.values()]);
  }

  private requestStatus(value: FilterValues[string]): CustomerRepairRequestFilters['status'] {
    return value === 'open' || value === 'cancelled' || value === 'completed' ? value : undefined;
  }

  private repairStatus(value: FilterValues[string]): CustomerRepairRequestFilters['repairStatus'] {
    return typeof value === 'string' &&
      [
        'confirmed',
        'inspection_pending',
        'inspection_in_progress',
        'awaiting_customer_approval',
        'inspection_approved',
        'repair_declined',
        'in_progress',
        'on_hold',
        'repair_completed',
        'ready_for_pickup',
        'picked_up',
        'completed',
        'disputed',
      ].includes(value)
      ? (value as NonNullable<CustomerRepairRequestFilters['repairStatus']>)
      : undefined;
  }

  setQuotationStatus(quotationId: string, status: 'accepted' | 'declined'): void {
    this.updating.set(quotationId);
    this.actionError.set('');
    this.portal.updateQuotationStatus(quotationId, status).subscribe({
      next: () => {
        this.updating.set(null);
        this.loadRequests();
      },
      error: (error: HttpErrorResponse) => {
        this.actionError.set(error.error?.message || 'Quotation status could not be updated.');
        this.updating.set(null);
      },
    });
  }

  shopName(request: CustomerRepairRequest, shopId: string): string {
    return request.shops?.find((shop) => shop.id === shopId)?.name ?? 'Repair shop';
  }
}
