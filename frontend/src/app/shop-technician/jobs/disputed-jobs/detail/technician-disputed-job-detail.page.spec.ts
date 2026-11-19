import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';
import { CustomerPortalService } from '../../../../customer/services/customer-portal.service';
import { ShopRepairRequestsService } from '../../../../shop/repair-requests/shop-repair-requests.service';
import type { TechnicianRepairDetails } from '../../../../shop/technicians/technicians.models';
import { TechniciansService } from '../../../../shop/technicians/technicians.service';
import { RepairDispute } from '../../../../shared/models/disputes.models';
import { DisputesService } from '../../../../shared/services/disputes.service';
import { TechnicianDisputedJobDetailPage } from './technician-disputed-job-detail.page';

describe('TechnicianDisputedJobDetailPage', () => {
  it('renders the shop Issue Resolution details design without mutation controls', async () => {
    const dispute: RepairDispute = {
      _id: 'dispute-1',
      reference: 'DSP-001',
      repairRequestId: 'request-1',
      customerId: 'customer-1',
      shopId: 'shop-1',
      category: 'repair_quality',
      subject: 'Repair issue',
      description: 'Issue after repair',
      expectedResolution: 'Fix the issue',
      attachments: [],
      status: 'UNDER_REVIEW',
      priority: 'normal',
      messages: [
        {
          authorId: 'shop-1',
          authorRole: 'shop',
          message: 'We will inspect the device again.',
          attachments: [],
          internal: false,
          createdAt: '2025-01-02T10:00:00.000Z',
        },
      ],
      statusHistory: [
        {
          from: 'NONE',
          to: 'OPEN',
          actorRole: 'customer',
          at: '2025-01-01T10:00:00.000Z',
        },
      ],
      resolution: {
        documents: [],
        completionDocuments: [],
        requiredActionCompleted: false,
      },
      reinspections: [],
      additionalCharges: [],
      reworkProgress: [],
      reworkCompletions: [],
      verificationHistory: [],
      createdAt: '2025-01-01T10:00:00.000Z',
      updatedAt: '2025-01-02T10:00:00.000Z',
      parties: {
        customer: { id: 'customer-1', name: 'Customer One' },
        shop: { id: 'shop-1', name: 'Repair Shop' },
      },
      repair: {
        id: 'request-1',
        appliance: 'Phone',
        brand: 'Apple',
        model: 'iPhone 12',
        description: 'Screen not working',
        photos: [],
        status: 'completed',
        createdAt: '2024-12-20T10:00:00.000Z',
        quotation: {
          amount: 850,
          currency: 'INR',
          message: 'Screen replacement',
        },
      },
    };
    const job: TechnicianRepairDetails = {
      id: 'request-1',
      appliance: 'Phone',
      brand: 'Apple',
      model: 'iPhone 12',
      status: 'completed',
      assignedAt: '2025-01-02T10:00:00.000Z',
      shopId: 'shop-1',
      description: 'Screen not working',
      photos: [],
      customer: 'Customer One',
      customerInfo: {
        name: 'Customer One',
        phone: null,
        email: 'customer@example.test',
        location: null,
      },
      phone: null,
      location: null,
      serviceType: null,
      quotations: [],
      shop: {
        name: 'Repair Shop',
        phone: null,
        email: null,
        address: null,
        city: null,
        location: null,
      },
    };
    const route = {
      distanceMeters: 0,
      durationSeconds: 0,
      description: 'Route unavailable',
      path: [],
    };
    const disputes = jasmine.createSpyObj<DisputesService>('DisputesService', [
      'get',
      'sendMessage',
      'proposeResolution',
      'requestAdditionalCharges',
      'startRework',
    ]);
    disputes.get.and.returnValue(of(dispute));
    const auth = jasmine.createSpyObj<AuthService>('AuthService', [
      'getMyShopProfile',
    ]);
    const shopRequests = jasmine.createSpyObj<ShopRepairRequestsService>(
      'ShopRepairRequestsService',
      ['get', 'getDirections'],
    );
    shopRequests.getDirections.and.returnValue(of(route));
    const technicians = jasmine.createSpyObj<TechniciansService>(
      'TechniciansService',
      ['myJobDetails', 'myJobDirections', 'list', 'assign'],
    );
    technicians.myJobDetails.and.returnValue(of(job));
    technicians.myJobDirections.and.returnValue(of(route));

    await TestBed.configureTestingModule({
      imports: [TechnicianDisputedJobDetailPage],
      providers: [
        provideRouter([
          {
            path: 'technician/jobs/disputed-jobs/:id',
            component: TechnicianDisputedJobDetailPage,
            data: { accountType: 'technician' },
          },
        ]),
        { provide: DisputesService, useValue: disputes },
        { provide: AuthService, useValue: auth },
        { provide: ShopRepairRequestsService, useValue: shopRequests },
        { provide: TechniciansService, useValue: technicians },
        {
          provide: CustomerPortalService,
          useValue: {
            getRepairJob: jasmine.createSpy(),
            getRepairRequests: jasmine.createSpy(),
          },
        },
      ],
    }).compileComponents();

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      '/technician/jobs/disputed-jobs/dispute-1',
      TechnicianDisputedJobDetailPage,
    );

    const page = harness.routeNativeElement as HTMLElement;
    const text = page.textContent ?? '';
    expect(page.querySelector('app-shop-disputed-job-detail-page')).not.toBeNull();
    expect(text).toContain('Dispute Details');
    expect(text).toContain('Dispute ID:');
    expect(text).toContain('Repair issue');
    expect(text).toContain('We will inspect the device again.');
    expect(text).toContain('Customer One');
    expect(text).not.toContain('Reassign Technician');
    expect(text).not.toContain('Assign Technician');
    expect(text).not.toContain('Send message');
    expect(text).not.toContain('Accept dispute');
    expect(text).not.toContain('Propose resolution');
    expect(text).not.toContain('Submit reinspection findings');
    expect(page.querySelector('.conversation-compose')).toBeNull();
    expect(disputes.get).toHaveBeenCalledWith('technician', 'dispute-1');
    expect(technicians.myJobDetails).toHaveBeenCalledWith('request-1');
    expect(auth.getMyShopProfile).not.toHaveBeenCalled();
    expect(shopRequests.get).not.toHaveBeenCalled();
    expect(shopRequests.getDirections).not.toHaveBeenCalled();
    expect(technicians.list).not.toHaveBeenCalled();
    expect(technicians.assign).not.toHaveBeenCalled();
    expect(disputes.sendMessage).not.toHaveBeenCalled();
    expect(disputes.proposeResolution).not.toHaveBeenCalled();
  });
});
