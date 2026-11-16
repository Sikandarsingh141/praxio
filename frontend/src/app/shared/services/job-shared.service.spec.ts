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
