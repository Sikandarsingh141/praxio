import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { AdditionalChargeRequestInput } from '../../shared/models/repair-workflow.models';
import { TechniciansService } from './technicians.service';

describe('TechniciansService directions', () => {
  let service: TechniciansService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TechniciansService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(TechniciansService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads directions through the authenticated technician job endpoint', () => {
    const route = {
      distanceMeters: 4200,
      durationSeconds: 780,
      description: 'Fastest route',
      path: [{ latitude: 30.72, longitude: 76.72 }],
    };
    let result: typeof route | undefined;

    service.myJobDirections('request/123').subscribe((value) => {
      result = value;
    });

    const request = http.expectOne(
      `${environment.apiBaseUrl}/technician/jobs/request%2F123/directions`,
    );
    expect(request.request.method).toBe('GET');
    request.flush({ data: { route } });
    expect(result).toEqual(route);
  });

  it('submits additional-charge requests through the authenticated technician endpoint', () => {
    const input: AdditionalChargeRequestInput = {
      action: 'submit',
      issue: 'Damaged connector',
      reason: 'The connector was damaged beneath the cover.',
      repairDescription: 'Replace and test the connector.',
      parts: [{ name: 'Connector', quantity: 1, unitPrice: 25 }],
    };
    let result: { _id: string } | undefined;

    service.requestAdditionalCharges('request/123', input).subscribe((value) => {
      result = value;
    });

    const request = http.expectOne(
      `${environment.apiBaseUrl}/technician/jobs/request%2F123/additional-charges`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
    request.flush({ data: { chargeRequest: { _id: 'charge-1' } } });
    expect(result).toEqual({ _id: 'charge-1' });
  });
});
