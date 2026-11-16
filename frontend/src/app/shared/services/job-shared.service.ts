import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
import { CustomerPortalService } from '../../customer/services/customer-portal.service';
import { CustomerRepairRequest } from '../../customer/models/customer-portal.models';
import { ShopRepairRequest } from '../../shop/repair-requests/shop-repair-requests.models';
import { ShopRepairRequestsService } from '../../shop/repair-requests/shop-repair-requests.service';
import { TechnicianJob, TechnicianRepairDetails } from '../../shop/technicians/technicians.models';
import { TechniciansService } from '../../shop/technicians/technicians.service';
import { DisputeRole, RepairDispute } from '../models/disputes.models';
import {
  CustomerJobCategory,
  JobAttachment,
  JobListItem,
  JobTimelineEntry,
  ShopJobCategory,
  TechnicianJobCategory,
  disputeToJobListItem,
} from '../models/job.models';
import { DisputesService } from './disputes.service';

const PAGE_LIMIT = 50;

@Injectable({ providedIn: 'root' })
export class JobSharedService {
  constructor(
    private readonly customer: CustomerPortalService,
    private readonly shop: ShopRepairRequestsService,
    private readonly technicians: TechniciansService,
    private readonly disputes: DisputesService,
  ) {}

  customerJobs(category: CustomerJobCategory): Observable<JobListItem[]> {
    if (category === 'disputed') {
      return this.allDisputes('customer').pipe(map((items) => items.map(disputeToJobListItem)));
    }

    return this.customer.getRepairRequests().pipe(
      map((requests) =>
        requests
          .filter((request) => this.matchesCustomerCategory(request, category))
          .map((request) => this.customerListItem(request)),
      ),
    );
  }

  customerJob(id: string): Observable<CustomerRepairRequest> {
    return this.customer.getRepairJob(id);
  }

  shopJobs(category: ShopJobCategory): Observable<JobListItem[]> {
    if (category === 'disputed') {
      return this.allDisputes('shop').pipe(map((items) => items.map(disputeToJobListItem)));
    }

    return this.allShopRequests().pipe(
      map((requests) =>
        requests
          .filter((request) => this.matchesShopCategory(request, category))
          .map((request) => this.shopListItem(request)),
      ),
    );
  }

  shopJob(id: string): Observable<ShopRepairRequest> {
    return this.shop.get(id);
  }

  technicianJobs(category: TechnicianJobCategory): Observable<JobListItem[]> {
    const filter = category === 'assigned' ? 'pending' : category;
    return this.technicians
      .myJobs(filter)
      .pipe(map(({ jobs }) => jobs.map((job) => this.technicianListItem(job))));
  }

  technicianJob(id: string): Observable<TechnicianRepairDetails> {
    return this.technicians.myJobDetails(id);
  }

  customerTimeline(request: CustomerRepairRequest): JobTimelineEntry[] {
    return (request.repairJob?.history ?? []).map((event) => ({
      title: event.action.replace(/_/g, ' '),
      description: event.notes,
      at: event.at,
    }));
  }

  shopTimeline(request: ShopRepairRequest): JobTimelineEntry[] {
    return (request.repairJob?.history ?? []).map((event) => ({
      title: event.action.replace(/_/g, ' '),
      description: event.notes,
      at: event.at,
    }));
  }

  technicianTimeline(request: TechnicianRepairDetails): JobTimelineEntry[] {
    return (request.timeline ?? []).map((event) => ({
      title: event.action.replace(/_/g, ' '),
      description: [event.actorName, event.notes].filter(Boolean).join(' · '),
      at: event.at,
    }));
  }

  photoAttachments(photos: Array<{ mimeType: string; data: string }>): JobAttachment[] {
    return photos.map((photo, index) => ({
      name: `Photo ${index + 1}`,
      mimeType: photo.mimeType,
      data: photo.data,
    }));
  }

  filterAndSort(
    items: JobListItem[],
    search: string,
    sort: 'newest' | 'oldest',
  ): JobListItem[] {
    const query = search.trim().toLocaleLowerCase();
    return items
      .filter((item) => {
        if (!query) return true;
        return [
          item.id,
          item.title,
          item.status,
          item.description,
          item.customerName ?? '',
          item.shopName ?? '',
          item.brand ?? '',
          item.model ?? '',
        ]
          .join(' ')
          .toLocaleLowerCase()
          .includes(query);
      })
      .sort((left, right) => {
        const direction = sort === 'newest' ? -1 : 1;
        return (
          direction *
          (new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
        );
      });
  }

  errorMessage(error: unknown, fallback: string): string {
    return error instanceof HttpErrorResponse
      ? error.error?.message || fallback
      : fallback;
  }

  private allShopRequests(): Observable<ShopRepairRequest[]> {
    const filters = { status: 'all' as const, limit: PAGE_LIMIT };
    return this.shop.list({ ...filters, page: 1 }).pipe(
      expand((result) =>
        result.page * result.limit < result.total
          ? this.shop.list({ ...filters, page: result.page + 1 })
          : EMPTY,
      ),
      reduce((all, result) => all.concat(result.requests), [] as ShopRepairRequest[]),
    );
  }

  private allDisputes(role: DisputeRole): Observable<RepairDispute[]> {
    const filters = { page: 1, limit: PAGE_LIMIT } as const;
    return this.disputes.list(role, filters).pipe(
      expand((result) =>
        result.pagination.page < result.pagination.totalPages
          ? this.disputes.list(role, { ...filters, page: result.pagination.page + 1 })
          : EMPTY,
      ),
      reduce((all, result) => all.concat(result.items), [] as RepairDispute[]),
    );
  }

  private matchesCustomerCategory(
    request: CustomerRepairRequest,
    category: Exclude<CustomerJobCategory, 'disputed'>,
  ): boolean {
    const status = request.repairJob?.status;
    const hasResponse = request.quotations.length > 0 ||
      request.shops?.some((shop) =>
        ['quotation_submitted', 'customer_accepted', 'customer_rejected'].includes(
          shop.responseStatus ?? '',
        ),
      ) === true;

    switch (category) {
      case 'new':
        return request.status === 'open' && !request.repairJob && !hasResponse;
      case 'pending':
        return request.status === 'open' &&
          ((!request.repairJob && hasResponse) || status === 'repair_declined');
      case 'assigned':
        return request.status === 'open' &&
          (status === 'confirmed' || status === 'inspection_pending');
      case 'active':
        return request.status === 'open' &&
          !!status &&
          !['confirmed', 'inspection_pending', 'repair_declined', 'completed', 'disputed'].includes(
            status,
          );
      case 'completed':
        return request.status === 'completed' || status === 'completed';
    }
  }

  private matchesShopCategory(
    request: ShopRepairRequest,
    category: Exclude<ShopJobCategory, 'disputed'>,
  ): boolean {
    const responseStatus = request.shopResponse.status;
    const status = request.repairJob?.status;
    switch (category) {
      case 'new':
        return request.status === 'open' && responseStatus === 'new';
      case 'pending':
        return request.status === 'open' &&
          (responseStatus === 'pending' || responseStatus === 'quotation_submitted');
      case 'assigned':
        return request.status === 'open' &&
          responseStatus === 'customer_accepted' &&
          (!status || ['confirmed', 'inspection_pending'].includes(status));
      case 'active':
        return request.status === 'open' &&
          !!status &&
          !['confirmed', 'inspection_pending', 'repair_declined', 'completed', 'disputed'].includes(
            status,
          );
      case 'completed':
        return request.status === 'completed' || status === 'completed';
    }
  }

  private customerListItem(request: CustomerRepairRequest): JobListItem {
    return {
      id: request._id,
      title: request.appliance,
      status: request.repairJob?.status ?? request.status,
      description: request.description,
      shopName: request.shop?.name ?? request.shops?.[0]?.name,
      brand: request.brand,
      model: request.model,
      imageData: request.photos?.[0]?.data ?? null,
      imageMimeType: request.photos?.[0]?.mimeType,
      serviceType: request.serviceType,
      createdAt: request.createdAt,
      amount: request.acceptedQuotation?.amount ?? null,
      currency: request.acceptedQuotation?.currency,
    };
  }

  private shopListItem(request: ShopRepairRequest): JobListItem {
    return {
      id: request._id,
      title: request.appliance,
      status: request.repairJob?.status ?? request.shopResponse.status,
      description: request.description,
      customerName: request.customer.displayName ??
        `${request.customer.firstName} ${request.customer.lastName}`.trim(),
      brand: request.brand,
      model: request.model,
      imageData: request.photos[0]?.data ?? null,
      imageMimeType: request.photos[0]?.mimeType,
      serviceType: request.serviceType,
      createdAt: request.createdAt,
      amount: request.repairJob?.approvedRepairAmount ?? null,
      currency: request.quotations.find((quotation) => quotation.status === 'accepted')?.currency,
    };
  }

  private technicianListItem(job: TechnicianJob): JobListItem {
    return {
      id: job.id,
      title: job.appliance,
      status: job.status,
      description: job.description ?? '',
      customerName: job.customer,
      shopName: job.shopName,
      brand: job.brand,
      model: job.model,
      imageData: job.photo ?? null,
      createdAt: job.assignedAt,
      amount: job.cost ?? job.quotationAmount ?? null,
      currency: job.quotationCurrency,
    };
  }
}
