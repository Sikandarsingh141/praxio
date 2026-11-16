import { TestBed } from '@angular/core/testing';
import { forkJoin, of } from 'rxjs';
import { CustomerRepairRequest } from '../../customer/models/customer-portal.models';
import { CustomerPortalService } from '../../customer/services/customer-portal.service';
import {
  ShopRepairRequest,
  ShopRepairRequestPage,
} from '../../shop/repair-requests/shop-repair-requests.models';
import { ShopRepairRequestsService } from '../../shop/repair-requests/shop-repair-requests.service';
import {
  TechnicianJob,
  TechnicianJobSummary,
} from '../../shop/technicians/technicians.models';
import { TechniciansService } from '../../shop/technicians/technicians.service';
import { RepairWorkflowJob } from '../models/repair-workflow.models';
import { DisputeListResult } from '../models/disputes.models';
import { DisputesService } from './disputes.service';
import { JobSharedService } from './job-shared.service';

describe('JobSharedService', () => {
  let service: JobSharedService;
  let customerApi: jasmine.SpyObj<CustomerPortalService>;
  let shopApi: jasmine.SpyObj<ShopRepairRequestsService>;
  let technicianApi: jasmine.SpyObj<TechniciansService>;
  let disputesApi: jasmine.SpyObj<DisputesService>;

  beforeEach(() => {
    customerApi = jasmine.createSpyObj<CustomerPortalService>('CustomerPortalService', [
      'getRepairRequests',
      'getRepairJob',
    ]);
    shopApi = jasmine.createSpyObj<ShopRepairRequestsService>('ShopRepairRequestsService', [
      'list',
      'get',
    ]);
    technicianApi = jasmine.createSpyObj<TechniciansService>('TechniciansService', [
      'myJobs',
      'myJobDetails',
    ]);
    disputesApi = jasmine.createSpyObj<DisputesService>('DisputesService', ['list', 'get']);

    TestBed.configureTestingModule({
      providers: [
        JobSharedService,
        { provide: CustomerPortalService, useValue: customerApi },
        { provide: ShopRepairRequestsService, useValue: shopApi },
        { provide: TechniciansService, useValue: technicianApi },
        { provide: DisputesService, useValue: disputesApi },
      ],
    });
    service = TestBed.inject(JobSharedService);
  });

  it('keeps quoted customer requests in New Jobs while retaining other status categories', (done) => {
    customerApi.getRepairRequests.and.returnValue(of([
      customerRequest('new'),
      customerRequest('pending', undefined, true),
      customerRequest('assigned', 'confirmed'),
      customerRequest('active', 'in_progress'),
      customerRequest('completed', 'completed', false, 'completed'),
    ]));

    forkJoin({
      new: service.customerJobs('new'),
      pending: service.customerJobs('pending'),
      assigned: service.customerJobs('assigned'),
      active: service.customerJobs('active'),
      completed: service.customerJobs('completed'),
    }).subscribe((lists) => {
      expect(lists.new.map((item) => item.id)).toEqual(['new', 'pending']);
      expect(lists.new[0].quotationSubmitted).toBeFalse();
      expect(lists.new[1].quotationSubmitted).toBeTrue();
      expect(lists.pending.map((item) => item.id)).toEqual(['pending']);
      expect(lists.assigned.map((item) => item.id)).toEqual(['assigned']);
      expect(lists.active.map((item) => item.id)).toEqual(['active']);
      expect(lists.completed.map((item) => item.id)).toEqual(['completed']);
      expect(customerApi.getRepairRequests).toHaveBeenCalledTimes(5);
      done();
    });
  });

  it('keeps accepted requests pending until the shop starts inspection', (done) => {
    const confirmedRequest = customerRequest('accepted-confirmed', 'confirmed');
    const inspectionPendingRequest = customerRequest('accepted-inspection-pending', 'inspection_pending');
    const inspectionStartedRequest = customerRequest('inspection-in-progress', 'inspection_in_progress');
    for (const request of [confirmedRequest, inspectionPendingRequest]) {
      request.shops = [{ id: 'shop-1', name: 'Repair shop', responseStatus: 'customer_accepted' }];
    }
    customerApi.getRepairRequests.and.returnValue(
      of([confirmedRequest, inspectionPendingRequest, inspectionStartedRequest]),
    );

    forkJoin({
      pending: service.customerJobs('pending'),
      active: service.customerJobs('active'),
    }).subscribe((lists) => {
      expect(lists.pending.map((item) => item.id)).toEqual([
        'accepted-confirmed',
        'accepted-inspection-pending',
      ]);
      expect(lists.active.map((item) => item.id)).toEqual(['inspection-in-progress']);
      done();
    });
  });

  it('returns counts for customer request navigation from the existing category rules', (done) => {
    const pendingRequest = customerRequest('pending', 'confirmed');
    pendingRequest.shops = [
      { id: 'shop-1', name: 'Repair shop', responseStatus: 'customer_accepted' },
    ];
    customerApi.getRepairRequests.and.returnValue(
      of([
        customerRequest('open'),
        pendingRequest,
        customerRequest('active', 'in_progress'),
        customerRequest('completed', 'completed', false, 'completed'),
      ]),
    );
    disputesApi.list.and.returnValue(
      of({
        items: [],
        pagination: { page: 1, limit: 1, total: 2, totalPages: 2 },
        summary: { TOTAL: 2 },
      } satisfies DisputeListResult),
    );

    service.customerJobCounts().subscribe((counts) => {
      expect(counts).toEqual({
        new: 1,
        pending: 1,
        active: 1,
        disputed: 2,
        completed: 1,
      });
      expect(customerApi.getRepairRequests).toHaveBeenCalledTimes(1);
      expect(disputesApi.list).toHaveBeenCalledOnceWith('customer', { page: 1, limit: 1 });
      done();
    });
  });

  it('returns shop request counts including accepted assignments', (done) => {
    shopApi.list.and.returnValue(
      of(
        shopPage(
          [
            shopRequest('open', 'new'),
            shopRequest('pending', 'quotation_submitted'),
            shopRequest('assigned', 'customer_accepted', 'confirmed'),
            shopRequest('active', 'customer_accepted', 'in_progress'),
            shopRequest('completed', 'customer_accepted', 'completed'),
          ],
          1,
          5,
        ),
      ),
    );
    disputesApi.list.and.returnValue(
      of({
        items: [],
        pagination: { page: 1, limit: 1, total: 3, totalPages: 3 },
        summary: { TOTAL: 3 },
      } satisfies DisputeListResult),
    );

    service.shopJobCounts().subscribe((counts) => {
      expect(counts).toEqual({
        new: 1,
        pending: 1,
        assigned: 1,
        active: 1,
        disputed: 3,
        completed: 1,
      });
      expect(shopApi.list).toHaveBeenCalledOnceWith({
        status: 'all',
        limit: 50,
        page: 1,
      });
      expect(disputesApi.list).toHaveBeenCalledOnceWith('shop', { page: 1, limit: 1 });
      done();
    });
  });

  it('exposes only actionable customer quotations for pending job responses', (done) => {
    const request = customerRequest('pending-quotation');
    request.shops = [{ id: 'shop-1', name: 'Repair shop' }];
    request.quotations = [
      {
        _id: 'quote-1',
        repairRequestId: request._id,
        shopId: 'shop-1',
        amount: 125,
        currency: 'USD',
        message: 'Screen replacement',
        status: 'sent',
        createdAt: '2025-01-01T00:00:00.000Z',
      },
      {
        _id: 'quote-2',
        repairRequestId: request._id,
        shopId: 'shop-2',
        amount: 80,
        currency: 'USD',
        message: 'Declined offer',
        status: 'declined',
        createdAt: '2025-01-02T00:00:00.000Z',
      },
    ];
    customerApi.getRepairRequests.and.returnValue(of([request]));

    service.customerJobs('pending').subscribe((items) => {
      expect(items.length).toBe(1);
      expect(items[0].pendingQuotations).toEqual([
        { id: 'quote-1', shopName: 'Repair shop', amount: 125, currency: 'USD' },
      ]);
      done();
    });
  });

  it('loads shop request pages beyond the first page before categorizing jobs', (done) => {
    const firstPageItems = Array.from({ length: 50 }, (_, index) =>
      shopRequest(`new-${index}`, 'new'),
    );
    shopApi.list.and.returnValues(
      of(shopPage(firstPageItems, 1, 51)),
      of(shopPage([shopRequest('assigned-next-page', 'customer_accepted', 'confirmed')], 2, 51)),
    );

    service.shopJobs('assigned').subscribe((items) => {
      expect(items.map((item) => item.id)).toEqual(['assigned-next-page']);
      expect(shopApi.list.calls.count()).toBe(2);
      expect(shopApi.list.calls.argsFor(1)[0].page).toBe(2);
      done();
    });
  });

  it('keeps listing jobs when an older API response omits quotations', (done) => {
    const request = shopRequest('completed-without-quotes', 'customer_accepted', 'completed');
    Reflect.deleteProperty(request, 'quotations');
    shopApi.list.and.returnValue(of(shopPage([request], 1, 1)));

    service.shopJobs('completed').subscribe((items) => {
      expect(items).toHaveSize(1);
      expect(items[0].quotationSubmitted).toBeTrue();
      expect(items[0].currency).toBeUndefined();
      done();
    });
  });

  it('uses the supported pending filter for technician assigned jobs', (done) => {
    const job: TechnicianJob = {
      id: 'tech-job',
      appliance: 'Phone',
      brand: 'Fixora',
      model: 'A1',
      status: 'confirmed',
      assignedAt: '2025-01-01T00:00:00.000Z',
    };
    technicianApi.myJobs.and.returnValue(
      of({
        jobs: [job],
        summary: {
          assigned: 1,
          inProgress: 0,
          completed: 0,
          onHold: 0,
          today: 0,
        } satisfies TechnicianJobSummary,
      }),
    );

    service.technicianJobs('assigned').subscribe((items) => {
      expect(items.map((item) => item.id)).toEqual(['tech-job']);
      expect(technicianApi.myJobs).toHaveBeenCalledWith('pending');
      done();
    });
  });
});

function customerRequest(
  id: string,
  repairStatus?: RepairWorkflowJob['status'],
  hasShopResponse = false,
  requestStatus: CustomerRepairRequest['status'] = 'open',
): CustomerRepairRequest {
  return {
    _id: id,
    shopIds: [],
    appliance: 'Phone',
    description: 'Screen repair',
    status: requestStatus,
    createdAt: '2025-01-01T00:00:00.000Z',
    quotations: [],
    shops: hasShopResponse
      ? [{ id: 'shop-1', name: 'Repair shop', responseStatus: 'quotation_submitted' }]
      : [],
    repairJob: repairStatus ? { status: repairStatus } : undefined,
  };
}

function shopRequest(
  id: string,
  responseStatus: ShopRepairRequest['shopResponse']['status'],
  repairStatus?: RepairWorkflowJob['status'],
): ShopRepairRequest {
  return {
    _id: id,
    appliance: 'Phone',
    description: 'Screen repair',
    photos: [],
    status: 'open',
    createdAt: '2025-01-01T00:00:00.000Z',
    customer: { firstName: 'Test', lastName: 'Customer' },
    shopResponse: { status: responseStatus },
    quotations: [],
    repairJob: repairStatus ? { status: repairStatus } : undefined,
  };
}

function shopPage(
  requests: ShopRepairRequest[],
  page: number,
  total: number,
): ShopRepairRequestPage {
  return {
    requests,
    page,
    limit: 50,
    total,
    summary: { total, new: total, pending: 0, accepted: 0, declined: 0, expired: 0 },
  };
}
