import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { RepairDispute } from '../models/disputes.models';
import { DisputesService } from './disputes.service';

describe('DisputesService', () => {
  let service: DisputesService;
  let http: HttpTestingController;

  const dispute: RepairDispute = {
    _id: 'dispute-1',
    reference: 'PRX-DSP-20261119-BD01271C',
    repairRequestId: 'repair-1',
    customerId: 'customer-1',
    shopId: 'shop-1',
    category: 'repair_quality',
    subject: 'repair quality after repair',
    description: 'Still getting the same issue.',
    expectedResolution: 'Please inspect the device and address the reported issue.',
    attachments: [],
    status: 'OPEN',
    priority: 'normal',
    messages: [],
    statusHistory: [],
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
    createdAt: '2026-11-19T12:24:47.349Z',
    updatedAt: '2026-11-19T12:24:47.349Z',
    parties: {
      customer: { id: 'customer-1', name: 'Nancy Sharma', email: 'nancy@example.com' },
      shop: { id: 'shop-1', name: 'Repair Shop', email: 'shop@example.com' },
    },
    repair: {
      id: 'repair-1',
      appliance: 'Testing-5',
      brand: 'Testing-5',
      model: 'Testing-5',
      description: 'Testing-5',
      photos: [],
      status: 'completed',
      createdAt: '2026-11-19T09:08:15.705Z',
      quotation: null,
    },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), DisputesService],
    });
    service = TestBed.inject(DisputesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('returns a raw dispute document from the customer detail endpoint', () => {
    let result: RepairDispute | undefined;
    service.get('customer', dispute._id).subscribe((value) => (result = value));

    const request = http.expectOne(
      `${environment.apiBaseUrl}/customer/disputes/${dispute._id}`,
    );
    expect(request.request.method).toBe('GET');
    request.flush(dispute);

    expect(result).toEqual(dispute);
  });

  it('continues to unwrap the standard API data envelope', () => {
    let result: RepairDispute | undefined;
    service.get('customer', dispute._id).subscribe((value) => (result = value));

    const request = http.expectOne(
      `${environment.apiBaseUrl}/customer/disputes/${dispute._id}`,
    );
    request.flush({ data: dispute });

    expect(result).toEqual(dispute);
  });
});
