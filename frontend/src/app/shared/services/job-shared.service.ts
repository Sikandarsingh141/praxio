import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { EMPTY, Observable, expand, forkJoin, map, reduce } from 'rxjs';
import { CustomerPortalService } from '../../customer/services/customer-portal.service';
import { CustomerRepairRequest } from '../../customer/models/customer-portal.models';
import { ShopRepairRequest } from '../../shop/repair-requests/shop-repair-requests.models';
import { ShopRepairRequestsService } from '../../shop/repair-requests/shop-repair-requests.service';
import { RepairRoute } from '../models/repair-route.models';
import {
  TechnicianAssignment,
  TechnicianJob,
  TechnicianRepairDetails,
} from '../../shop/technicians/technicians.models';
import { TechniciansService } from '../../shop/technicians/technicians.service';
import { DisputeAccessRole, RepairDispute } from '../models/disputes.models';
import { RepairWorkflowJob } from '../models/repair-workflow.models';
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
import {
  RepairProgressStep,
  buildRepairProgressSteps,
} from '../utils/repair-progress.util';

const PAGE_LIMIT = 50;
const PRE_REPAIR_STATUSES = [
  'confirmed',
  'pickup_scheduled',
  'pickup_in_progress',
  'item_picked_up',
  'inspection_pending',
];

export interface CustomerJobCounts {
  new: number;
  pending: number;
  active: number;
  disputed: number;
  completed: number;
}

export interface ShopJobCounts {
  new: number;
  pending: number;
  assigned: number;
  active: number;
  disputed: number;
  completed: number;
}

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

  customerJobCounts(): Observable<CustomerJobCounts> {
    return forkJoin({
      requests: this.customer.getRepairRequests(),
      disputes: this.disputes.list('customer', { page: 1, limit: 1 }),
    }).pipe(
      map(({ requests, disputes }) => ({
        new: requests.filter((request) => this.matchesCustomerCategory(request, 'new')).length,
        pending: requests.filter((request) => this.matchesCustomerCategory(request, 'pending'))
          .length,
        active: requests.filter((request) => this.matchesCustomerCategory(request, 'active')).length,
        disputed: disputes.pagination.total,
        completed: requests.filter((request) => this.matchesCustomerCategory(request, 'completed'))
          .length,
      })),
    );
  }

  shopJobCounts(): Observable<ShopJobCounts> {
    return forkJoin({
      requests: this.allShopRequests(),
      assignments: this.technicians.assignments(),
      disputes: this.disputes.list('shop', { page: 1, limit: 1 }),
    }).pipe(
      map(({ requests, assignments, disputes }) => ({
        new: requests.filter((request) => this.matchesShopCategory(request, 'new')).length,
        pending: requests.filter((request) => this.matchesShopCategory(request, 'pending')).length,
        assigned: this.assignedShopItems(assignments).length,
        active: requests.filter((request) => this.matchesShopCategory(request, 'active')).length,
        disputed: disputes.pagination.total,
        completed: requests.filter((request) => this.matchesShopCategory(request, 'completed'))
          .length,
      })),
    );
  }

  customerJob(id: string): Observable<CustomerRepairRequest> {
    return this.customer.getRepairJob(id);
  }

  disputedJobs(role: DisputeAccessRole): Observable<JobListItem[]> {
    return this.allDisputes(role).pipe(map((items) => items.map(disputeToJobListItem)));
  }

  shopJobs(category: ShopJobCategory): Observable<JobListItem[]> {
    if (category === 'disputed') {
      return this.disputedJobs('shop');
    }
    if (category === 'assigned') {
      return this.technicians
        .assignments()
        .pipe(map((assignments) => this.assignedShopItems(assignments)));
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

  customerProgress(request: CustomerRepairRequest): RepairProgressStep[] {
    const acceptedQuotation =
      request.acceptedQuotation ??
      request.quotations.find(
        (quotation) =>
          quotation._id === request.acceptedQuotationId || quotation.status === 'accepted',
      );
    const latestQuotation = [...request.quotations].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    )[0];
    const quotationAccepted = Boolean(
      request.acceptedQuotationId ||
        request.repairJob?.acceptedQuotationId ||
        acceptedQuotation?.status === 'accepted' ||
        request.shops?.some((shop) => shop.responseStatus === 'customer_accepted'),
    );
    const quotationSubmitted =
      request.quotations.length > 0 ||
      request.shops?.some((shop) => shop.responseStatus === 'quotation_submitted');
    return buildRepairProgressSteps({
      requestCreatedAt: request.createdAt,
      requestStatus: request.status,
      quotationStatus: quotationAccepted
        ? 'accepted'
        : quotationSubmitted
          ? 'submitted'
          : 'none',
      acceptedAt: acceptedQuotation?.respondedAt ?? request.repairJob?.confirmedAt,
      quotationAt:
        acceptedQuotation?.respondedAt ??
        latestQuotation?.createdAt ??
        request.acceptedQuotation?.createdAt,
      requiresPhysicalPickup: acceptedQuotation?.requiresPhysicalPickup,
      inspectionCompletedBeforeQuotation: acceptedQuotation?.inspectionCompletedBeforeQuotation,
      repairJob: request.repairJob,
    });
  }

  shopProgress(request: ShopRepairRequest): RepairProgressStep[] {
    const acceptedQuotation =
      request.quotations.find(
        (quotation) =>
          quotation._id === request.acceptedQuotationId || quotation.status === 'accepted',
      );
    const latestQuotation = [...request.quotations].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    )[0];
    const quotationAccepted = Boolean(
      request.acceptedQuotationId ||
        request.repairJob?.acceptedQuotationId ||
        acceptedQuotation ||
        request.shopResponse.status === 'customer_accepted',
    );
    return buildRepairProgressSteps({
      requestCreatedAt: request.createdAt,
      requestStatus: request.status,
      quotationStatus: quotationAccepted
        ? 'accepted'
        : latestQuotation || request.shopResponse.status === 'quotation_submitted'
          ? 'submitted'
          : 'none',
      acceptedAt:
        acceptedQuotation?.respondedAt ??
        request.shopResponse.respondedAt ??
        request.repairJob?.confirmedAt,
      quotationAt:
        acceptedQuotation?.respondedAt ??
        latestQuotation?.createdAt ??
        request.repairJob?.confirmedAt,
      requiresPhysicalPickup: acceptedQuotation?.requiresPhysicalPickup,
      inspectionCompletedBeforeQuotation: acceptedQuotation?.inspectionCompletedBeforeQuotation,
      repairJob: request.repairJob,
    });
  }

  technicianProgress(request: TechnicianRepairDetails): RepairProgressStep[] {
    const repairJob = request.repairJobDetails ?? request.repairJob ?? undefined;
    const acceptedQuotation = request.quotations.find(
      (quotation) => quotation.status === 'accepted',
    );
    const latestQuotation = [...request.quotations].sort((left, right) =>
      (right.createdAt ?? '').localeCompare(left.createdAt ?? ''),
    )[0];
    const quotationAccepted = Boolean(
      acceptedQuotation ||
        request.quotation?.approvedAt ||
        repairJob?.acceptedQuotationId ||
        request.shopResponse?.status === 'customer_accepted',
    );
    return buildRepairProgressSteps({
      requestCreatedAt: request.createdAt ?? request.assignedAt,
      requestStatus: request.requestStatus ?? request.status,
      quotationStatus: quotationAccepted
        ? 'accepted'
        : latestQuotation ||
            request.quotation ||
            request.shopResponse?.status === 'quotation_submitted'
          ? 'submitted'
          : 'none',
      acceptedAt:
        acceptedQuotation?.respondedAt ??
        request.quotation?.approvedAt ??
        request.shopResponse?.respondedAt ??
        repairJob?.confirmedAt,
      quotationAt:
        acceptedQuotation?.respondedAt ??
        latestQuotation?.createdAt ??
        request.quotation?.approvedAt ??
        undefined,
      requiresPhysicalPickup: acceptedQuotation?.requiresPhysicalPickup,
      inspectionCompletedBeforeQuotation:
        acceptedQuotation?.inspectionCompletedBeforeQuotation,
      repairJob,
    });
  }

  technicianDirections(requestId: string): Observable<RepairRoute> {
    return this.technicians.myJobDirections(requestId);
  }

  customerTimeline(request: CustomerRepairRequest): JobTimelineEntry[] {
    return this.repairTimeline(request.repairJob?.history, request.customerId);
  }

  shopTimeline(request: ShopRepairRequest): JobTimelineEntry[] {
    return this.repairTimeline(request.repairJob?.history, request.customerId);
  }

  technicianTimeline(request: TechnicianRepairDetails): JobTimelineEntry[] {
    return (request.timeline ?? []).map((event) => ({
      title: event.action.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
      description: event.notes,
      at: event.at,
      actorName: event.actorName,
      actorRole: event.actorRole,
    }));
  }

  photoAttachments(photos: Array<{ mimeType: string; data: string }>): JobAttachment[] {
    return photos.map((photo, index) => ({
      name: `Photo ${index + 1}`,
      mimeType: photo.mimeType,
      data: photo.data,
    }));
  }

  private repairTimeline(
    history: RepairWorkflowJob['history'],
    customerId?: string,
  ): JobTimelineEntry[] {
    return (history ?? []).map((event) => {
      const customerAction = !!customerId && event.actorId === customerId;
      const acceptedQuotation =
        customerAction && event.notes?.toLocaleLowerCase().includes('accepted the quotation');
      return {
        title: acceptedQuotation
          ? 'Quotation Accepted'
          : event.action.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
        description: event.notes,
        at: event.at,
        ...(event.actorId ? { actorRole: customerAction ? 'Customer' : 'Shop' } : {}),
      };
    });
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
          (new Date(left.assignedAt ?? left.createdAt).getTime() -
            new Date(right.assignedAt ?? right.createdAt).getTime())
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

  private allDisputes(role: DisputeAccessRole): Observable<RepairDispute[]> {
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

  private assignedShopItems(assignments: TechnicianAssignment[]): JobListItem[] {
    return assignments
      .filter(
        (assignment) =>
          !['repair_declined', 'disputed'].includes(assignment.repairStatus ?? ''),
      )
      .map((assignment) => ({
        id: assignment.requestId,
        title: assignment.appliance,
        status: 'assigned',
        description: assignment.description ?? '',
        customerName: assignment.customer,
        customerProfileImageUrl: assignment.customerProfileImageUrl ?? null,
        brand: assignment.brand,
        model: assignment.model,
        imageData: assignment.photo ?? null,
        serviceType: assignment.serviceType ?? undefined,
        createdAt: assignment.createdAt ?? assignment.assignment.assignedAt,
        assignedToId: assignment.isOwner ? 'owner' : assignment.assignment.technicianId,
        assignedToName: assignment.isOwner ? 'You' : assignment.technician?.name ?? 'Technician',
        assignedToOwner: assignment.isOwner,
        assignedToImageData: assignment.isOwner
          ? null
          : assignment.technician?.profileImageData ?? null,
        assignedAt: assignment.assignment.assignedAt,
      }));
  }

  private matchesCustomerCategory(
    request: CustomerRepairRequest,
    category: Exclude<CustomerJobCategory, 'disputed'>,
  ): boolean {
    const status = request.repairJob?.status;
    const hasAcceptedQuotation =
      request.acceptedQuotation?.status === 'accepted' ||
      request.quotations.some((quotation) => quotation.status === 'accepted') ||
      request.shops?.some((shop) => shop.responseStatus === 'customer_accepted') === true;
    const hasResponse = hasAcceptedQuotation ||
      request.quotations.length > 0 ||
      request.shops?.some((shop) =>
        ['quotation_submitted', 'customer_accepted', 'customer_rejected'].includes(
          shop.responseStatus ?? '',
        ),
      ) === true;

    switch (category) {
      case 'new':
        return request.status === 'open' && !request.repairJob;
      case 'pending':
        return request.status === 'open' &&
          ((!request.repairJob && hasResponse) ||
            (hasAcceptedQuotation &&
              (status === 'confirmed' ||
                (!!status && PRE_REPAIR_STATUSES.includes(status)))) ||
            status === 'repair_declined');
      case 'assigned':
        return (
          request.status === 'open' &&
          (status === 'confirmed' ||
            (!!status && PRE_REPAIR_STATUSES.includes(status)))
        );
      case 'active':
        return request.status === 'open' &&
          !!status &&
          ![
            ...PRE_REPAIR_STATUSES,
            'repair_declined',
            'picked_up',
            'completed',
            'disputed',
          ].includes(status);
      case 'completed':
        return request.status === 'completed' || status === 'picked_up' || status === 'completed';
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
          (responseStatus === 'pending' ||
            responseStatus === 'quotation_submitted' ||
            (responseStatus === 'customer_accepted' &&
              !request.technicianAssignment?.current &&
              (!status || PRE_REPAIR_STATUSES.includes(status))));
      case 'assigned':
        return request.status === 'open' &&
          responseStatus === 'customer_accepted' &&
          !!request.technicianAssignment?.current &&
          (!status || PRE_REPAIR_STATUSES.includes(status));
      case 'active':
        return request.status === 'open' &&
          !!status &&
          ![...PRE_REPAIR_STATUSES, 'repair_declined', 'completed', 'disputed'].includes(
            status,
          );
      case 'completed':
        return request.status === 'completed' || status === 'completed';
    }
  }

  private customerListItem(request: CustomerRepairRequest): JobListItem {
    const firstPendingQuotation = request.quotations.find(
      (quotation) => quotation.status === 'pending' || quotation.status === 'sent',
    );
    const pendingQuotations = request.quotations
      .filter((quotation) => quotation.status === 'pending' || quotation.status === 'sent')
      .map((quotation) => ({
        id: quotation._id,
        shopName:
          request.shops?.find((shop) => shop.id === quotation.shopId)?.name ?? 'Repair shop',
        amount: quotation.amount,
        currency: quotation.currency,
      }));

    return {
      id: request._id,
      title: request.appliance,
      status: request.repairJob?.status ?? request.status,
      description: request.description,
      shopName:
        pendingQuotations[0]?.shopName ??
        request.shop?.name ??
        request.shops?.[0]?.name,
      shopLogoUrl:
        request.shops?.find((shop) => shop.id === firstPendingQuotation?.shopId)?.logoUrl ??
        request.shop?.logoUrl ??
        request.shops?.[0]?.logoUrl ??
        null,
      shopPartners: request.shops?.length
        ? request.shops.map(({ id, name, logoUrl }) => ({ id, name, logoUrl }))
        : request.shop
          ? [{ id: request.shop.id, name: request.shop.name, logoUrl: request.shop.logoUrl }]
          : [],
      brand: request.brand,
      model: request.model,
      imageData: request.photos?.[0]?.data ?? null,
      imageMimeType: request.photos?.[0]?.mimeType,
      serviceType: request.serviceType,
      createdAt: request.createdAt,
      amount: request.acceptedQuotation?.amount ?? null,
      currency: request.acceptedQuotation?.currency,
      quotationSubmitted: request.acceptedQuotation?.status === 'accepted' ||
        request.quotations.length > 0 ||
        request.shops?.some((shop) =>
          ['quotation_submitted', 'customer_accepted', 'customer_rejected'].includes(
            shop.responseStatus ?? '',
          ),
        ) === true,
      ...(pendingQuotations.length ? { pendingQuotations } : {}),
    };
  }

  private shopListItem(request: ShopRepairRequest): JobListItem {
    const quotations = request.quotations ?? [];
    const assignment = request.technicianAssignment?.current;
    const repairStatus = request.repairJob?.status;
    const itemCollected = this.hasCollectedItem(request);
    const acceptedAwaitingAssignment =
      request.shopResponse.status === 'customer_accepted' &&
      !assignment &&
      (!repairStatus || PRE_REPAIR_STATUSES.includes(repairStatus));
    return {
      id: request._id,
      title: request.appliance,
      status:
        !itemCollected &&
        assignment &&
        (!repairStatus || PRE_REPAIR_STATUSES.includes(repairStatus))
          ? 'assigned'
          : acceptedAwaitingAssignment
            ? 'customer_accepted'
            : repairStatus ?? request.shopResponse.status,
      description: request.description,
      customerName: request.customer.displayName ??
        `${request.customer.firstName} ${request.customer.lastName}`.trim(),
      customerProfileImageUrl: request.customer.profileImageUrl ?? null,
      brand: request.brand,
      model: request.model,
      imageData: request.photos?.[0]?.data ?? null,
      imageMimeType: request.photos?.[0]?.mimeType,
      serviceType: request.serviceType,
      createdAt: request.createdAt,
      amount: request.repairJob?.approvedRepairAmount ?? null,
      currency: quotations.find((quotation) => quotation.status === 'accepted')?.currency,
      quotationSubmitted: quotations.length > 0 ||
        ['quotation_submitted', 'customer_accepted', 'customer_rejected'].includes(
          request.shopResponse.status,
        ),
      assignedToId: assignment?.isOwner ? 'owner' : assignment?.technicianId,
      assignedToName: assignment?.isOwner ? 'You' : assignment?.technicianName,
      assignedToOwner: assignment?.isOwner ?? false,
      assignedToImageData: assignment?.profileImageData ?? null,
      assignedAt: assignment?.assignedAt,
    };
  }

  private hasCollectedItem(request: ShopRepairRequest): boolean {
    return (
      request.repairJob?.status === 'item_picked_up' ||
      (request.repairJob?.requiresPhysicalPickup === true &&
        !!request.repairJob.servicePickup?.collectedAt)
    );
  }

  private technicianListItem(job: TechnicianJob): JobListItem {
    return {
      id: job.id,
      title: job.appliance,
      status: job.status,
      description: job.description ?? '',
      customerName: job.customer,
      customerProfileImageUrl: job.customerProfileImageUrl ?? null,
      shopName: job.shopName,
      brand: job.brand,
      model: job.model,
      imageData: job.photo ?? null,
      assignedToName: job.assignedToName ?? 'Technician',
      assignedToImageData: job.assignedToImageData ?? null,
      serviceType: job.serviceType ?? undefined,
      createdAt: job.createdAt ?? job.assignedAt,
      assignedAt: job.assignedAt,
      amount: job.cost ?? job.quotationAmount ?? null,
      currency: job.quotationCurrency,
    };
  }
}
