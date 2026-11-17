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
  TechnicianAssignment,
  TechnicianJob,
  TechnicianJobSummary,
} from '../../shop/technicians/technicians.models';
import { TechniciansService } from '../../shop/technicians/technicians.service';
import { RepairRoute } from '../models/repair-route.models';
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
      'myJobDirections',
      'assignments',
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
    technicianApi.assignments.and.returnValue(
      of([
        assignmentRecord('assigned-count', 'confirmed', false),
        assignmentRecord('active-assignment', 'in_progress', false),
      ]),
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
        pending: 2,
        assigned: 2,
        active: 1,
        disputed: 3,
        completed: 1,
      });
      expect(shopApi.list).toHaveBeenCalledOnceWith({
        status: 'all',
        limit: 50,
        page: 1,
      });
      expect(technicianApi.assignments).toHaveBeenCalledTimes(1);
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

  it('loads assigned jobs from the dedicated technician assignments API', (done) => {
    technicianApi.assignments.and.returnValue(
      of([assignmentRecord('assigned-job', 'inspection_pending', false)]),
    );

    service.shopJobs('assigned').subscribe((items) => {
      expect(items.map((item) => item.id)).toEqual(['assigned-job']);
      expect(items[0].assignedToName).toBe('Ravi Technician');
      expect(items[0].assignedAt).toBe('2026-11-16T10:24:00.000Z');
      expect(items[0].serviceType).toBe('home_service');
      expect(technicianApi.assignments).toHaveBeenCalledTimes(1);
      expect(shopApi.list).not.toHaveBeenCalled();
      done();
    });
  });

  it('includes current assignments across active repair stages', (done) => {
    const awaitingAssignment = shopRequest('awaiting-assignment', 'customer_accepted', 'confirmed');
    shopApi.list.and.returnValue(of(shopPage([awaitingAssignment], 1, 1)));
    technicianApi.assignments.and.returnValue(
      of([
        assignmentRecord('technician-assignment', 'confirmed', false),
        assignmentRecord('owner-assignment', 'inspection_pending', true),
        assignmentRecord('already-active', 'in_progress', false),
      ]),
    );

    forkJoin({
      pending: service.shopJobs('pending'),
      assigned: service.shopJobs('assigned'),
    }).subscribe((lists) => {
      expect(lists.pending.map((item) => item.id)).toEqual(['awaiting-assignment']);
      expect(lists.assigned.map((item) => item.id)).toEqual([
        'technician-assignment',
        'owner-assignment',
        'already-active',
      ]);
      expect(lists.assigned.map((item) => item.assignedToName)).toEqual([
        'Ravi Technician',
        'You',
        'Ravi Technician',
      ]);
      expect(lists.assigned.map((item) => item.assignedAt)).toEqual([
        '2026-11-16T10:24:00.000Z',
        '2026-11-16T10:24:00.000Z',
        '2026-11-16T10:24:00.000Z',
      ]);
      expect(lists.assigned.every((item) => item.status === 'assigned')).toBeTrue();
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
      assignedToName: 'Aman Verma',
      assignedToImageData: 'data:image/png;base64,technician',
      serviceType: 'home_service',
      assignedAt: '2025-01-01T00:00:00.000Z',
      createdAt: '2024-12-31T00:00:00.000Z',
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
      expect(items[0].assignedAt).toBe('2025-01-01T00:00:00.000Z');
      expect(items[0].assignedToName).toBe('Aman Verma');
      expect(items[0].assignedToImageData).toBe('data:image/png;base64,technician');
      expect(items[0].serviceType).toBe('home_service');
      expect(items[0].createdAt).toBe('2024-12-31T00:00:00.000Z');
      expect(technicianApi.myJobs).toHaveBeenCalledWith('pending');
      done();
    });
  });

  it('loads technician directions from the technician-scoped route service', (done) => {
    const route: RepairRoute = {
      distanceMeters: 4800,
      durationSeconds: 900,
      description: 'Fastest route',
      path: [{ latitude: 30.72, longitude: 76.72 }],
    };
    technicianApi.myJobDirections.and.returnValue(of(route));

    service.technicianDirections('assigned-job').subscribe((result) => {
      expect(result).toEqual(route);
      expect(technicianApi.myJobDirections).toHaveBeenCalledWith('assigned-job');
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

function assignmentRecord(
  id: string,
  repairStatus: RepairWorkflowJob['status'],
  isOwner: boolean,
): TechnicianAssignment {
  return {
    requestId: id,
    appliance: 'Laptop',
    brand: 'Fixora',
    model: 'A1',
    description: 'Screen repair',
    photo: null,
    createdAt: '2026-11-15T12:00:00.000Z',
    serviceType: 'home_service',
    repairStatus,
    customer: 'Ava Customer',
    assignment: {
      technicianId: isOwner ? 'shop-1' : 'technician-1',
      assignedAt: '2026-11-16T10:24:00.000Z',
    },
    isOwner,
    technician: isOwner
      ? { id: 'shop-1', name: 'You', availability: 'available', workload: 0 }
      : {
          id: 'technician-1',
          name: 'Ravi Technician',
          firstName: 'Ravi',
          lastName: 'Technician',
          email: 'ravi@example.test',
          phone: '',
          countryCode: '+91',
          mobileNumber: '',
          profileImageData: null,
          employeeId: 'TECH-1',
          skills: [],
          specialization: '',
          experienceYears: 0,
          employmentType: 'full_time',
          joiningDate: null,
          status: 'active',
          availability: 'available',
          workload: 0,
          accountCreatedAt: null,
        },
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
