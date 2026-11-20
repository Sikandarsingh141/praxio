import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ToastService } from '../../../core/toast/toast.service';
import { ShopRepairRequestsService } from '../../repair-requests/shop-repair-requests.service';
import { ShopRepairWorkflowComponent } from './shop-repair-workflow.component';
import { ShopRepairRequest } from '../../repair-requests/shop-repair-requests.models';

describe('ShopRepairWorkflowComponent', () => {
  it('emits inspectionStarted after the inspection action succeeds', async () => {
    const requests = jasmine.createSpyObj<ShopRepairRequestsService>(
      'ShopRepairRequestsService',
      ['startInspection', 'get'],
    );
    const startedRequest: ShopRepairRequest = {
      _id: 'request-1',
      appliance: 'Washing machine',
      description: 'It does not spin',
      photos: [],
      status: 'open',
      createdAt: new Date().toISOString(),
      customer: { firstName: 'Customer', lastName: 'Example' },
      shopResponse: { status: 'customer_accepted' },
      quotations: [],
      repairJob: { status: 'inspection_in_progress' },
    };
    requests.startInspection.and.returnValue(of(undefined));
    requests.get.and.returnValue(of(startedRequest));
    const toast = jasmine.createSpyObj<ToastService>('ToastService', [
      'success',
      'error',
    ]);

    await TestBed.configureTestingModule({
      imports: [ShopRepairWorkflowComponent],
      providers: [
        { provide: ShopRepairRequestsService, useValue: requests },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ShopRepairWorkflowComponent);
    fixture.componentRef.setInput('request', {
      ...startedRequest,
      repairJob: { status: 'inspection_pending' },
    });
    fixture.detectChanges();
    const inspectionStarted = spyOn(
      fixture.componentInstance.inspectionStarted,
      'emit',
    );

    fixture.componentInstance.startInspection();

    expect(requests.startInspection).toHaveBeenCalledOnceWith('request-1');
    expect(inspectionStarted).toHaveBeenCalledTimes(1);
    expect(requests.get).toHaveBeenCalledOnceWith('request-1');
  });

  it('restores a saved inspection draft and renders its form', async () => {
    await TestBed.configureTestingModule({
      imports: [ShopRepairWorkflowComponent],
      providers: [{ provide: ShopRepairRequestsService, useValue: {} }],
    }).compileComponents();

    const fixture = TestBed.createComponent(ShopRepairWorkflowComponent);
    const request: ShopRepairRequest = {
      _id: 'request-1',
      appliance: 'Washing machine',
      description: 'It does not spin',
      photos: [],
      status: 'open',
      createdAt: new Date().toISOString(),
      customer: { firstName: 'Customer', lastName: 'Example' },
      shopResponse: { status: 'customer_accepted' },
      quotations: [
        {
          _id: 'quotation-1',
          repairRequestId: 'request-1',
          amount: 100,
          currency: 'INR',
          message: 'Repair',
          status: 'accepted',
          createdAt: new Date().toISOString(),
        },
      ],
      repairJob: {
        status: 'inspection_in_progress',
        inspection: {
          status: 'draft',
          identifiedProblem: 'Broken motor',
          findings: 'Motor winding is damaged',
          requiredRepairWork: 'Replace the motor',
          parts: [{ name: 'Motor', quantity: 1, unitPrice: 100, total: 100 }],
          partsTotal: 100,
          labourCharge: 20,
          inspectionCharges: 10,
          otherCharges: 0,
          estimatedTotal: 130,
          images: [],
        },
      },
    };
    fixture.componentRef.setInput('request', request);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.openInspectionModal();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const problemCategory = fixture.nativeElement.querySelector(
      '[name="problemCategory"]',
    ) as HTMLSelectElement;
    const problemOther = fixture.nativeElement.querySelector(
      '[name="problemOther"]',
    ) as HTMLInputElement;
    const findings = fixture.nativeElement.querySelector(
      '[name="findings"]',
    ) as HTMLTextAreaElement;
    expect(fixture.componentInstance.identifiedProblem()).toBe('Broken motor');
    expect(fixture.componentInstance.problemCategory()).toBe('Other');
    expect(problemCategory.value).toBe('Other');
    expect(problemCategory.required).toBeTrue();
    expect(fixture.componentInstance.problemOther()).toBe('Broken motor');
    expect(problemOther.value).toBe('Broken motor');
    expect(problemOther.required).toBeTrue();
    expect(fixture.componentInstance.findings()).toBe('Motor winding is damaged');
    expect(findings.value).toBe('Motor winding is damaged');
    expect(fixture.nativeElement.textContent).toContain('Submit Inspection & Request Approval');
  });

  it('handles saved inspections with missing parts arrays', async () => {
    await TestBed.configureTestingModule({
      imports: [ShopRepairWorkflowComponent],
      providers: [{ provide: ShopRepairRequestsService, useValue: {} }],
    }).compileComponents();

    const fixture = TestBed.createComponent(ShopRepairWorkflowComponent);
    const request: ShopRepairRequest = {
      _id: 'request-1',
      appliance: 'Washing machine',
      description: 'It does not spin',
      photos: [],
      status: 'open',
      createdAt: new Date().toISOString(),
      customer: { firstName: 'Customer', lastName: 'Example' },
      shopResponse: { status: 'customer_accepted' },
      quotations: [],
      repairJob: {
        status: 'inspection_in_progress',
        inspection: {
          status: 'draft',
          identifiedProblem: 'Broken motor',
          findings: 'Motor winding is damaged',
          requiredRepairWork: 'Replace the motor',
          parts: [],
          partsTotal: 0,
          labourCharge: 20,
          inspectionCharges: 10,
          otherCharges: 0,
          estimatedTotal: 30,
          images: [],
        },
      },
    };
    const savedInspection = request.repairJob?.inspection;
    if (!savedInspection) {
      throw new Error('Inspection fixture is required.');
    }
    Object.defineProperty(savedInspection, 'parts', { value: undefined });
    fixture.componentRef.setInput('request', request);
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(fixture.componentInstance.inspectionParts()).toEqual([
      { name: '', quantity: 1, unitPrice: 0 },
    ]);
  });

  it('keeps Start Repair disabled until an accepted quote and customer approval are present', async () => {
    await TestBed.configureTestingModule({
      imports: [ShopRepairWorkflowComponent],
      providers: [{ provide: ShopRepairRequestsService, useValue: {} }],
    }).compileComponents();

    const fixture = TestBed.createComponent(ShopRepairWorkflowComponent);
    const createRequest = (
      quoteStatus: 'accepted' | 'pending',
      decidedBy?: string,
      blocksRepair = false,
    ): ShopRepairRequest => ({
      _id: 'request-1',
      appliance: 'Washing machine',
      description: 'It does not spin',
      photos: [],
      status: 'open',
      createdAt: new Date().toISOString(),
      customer: { firstName: 'Customer', lastName: 'Example' },
      shopResponse: { status: 'customer_accepted' },
      quotations: [
        {
          _id: 'quotation-1',
          repairRequestId: 'request-1',
          amount: 100,
          currency: 'INR',
          message: 'Repair',
          status: quoteStatus,
          createdAt: new Date().toISOString(),
        },
      ],
      repairJob: {
        status: 'inspection_approved',
        acceptedQuotationId: 'quotation-1',
        inspection: {
          status: 'approved',
          parts: [],
          partsTotal: 0,
          labourCharge: 0,
          inspectionCharges: 0,
          otherCharges: 0,
          estimatedTotal: 100,
          images: [],
          decidedBy,
          decidedAt: new Date().toISOString(),
        },
        additionalChargeRequests: blocksRepair
          ? [
              {
                _id: 'charge-1',
                status: 'pending',
                parts: [],
                partsTotal: 0,
                labourCharge: 0,
                otherCharges: 0,
                amount: 50,
                blocksRepair: true,
                images: [],
                requestedAt: new Date().toISOString(),
              },
            ]
          : [],
      },
    });

    fixture.componentRef.setInput('request', createRequest('accepted'));
    fixture.detectChanges();
    expect(fixture.componentInstance.canStartRepair).toBeFalse();
    expect(
      (fixture.nativeElement.querySelector('.workflow-callout button') as HTMLButtonElement)
        .disabled,
    ).toBeTrue();

    fixture.componentRef.setInput('request', createRequest('pending', 'customer-1'));
    fixture.detectChanges();
    expect(fixture.componentInstance.canStartRepair).toBeFalse();

    fixture.componentRef.setInput(
      'request',
      createRequest('accepted', 'customer-1', true),
    );
    fixture.detectChanges();
    expect(fixture.componentInstance.canStartRepair).toBeFalse();

    fixture.componentRef.setInput('request', createRequest('accepted', 'customer-1'));
    fixture.detectChanges();
    expect(fixture.componentInstance.canStartRepair).toBeTrue();
    expect(
      (fixture.nativeElement.querySelector('.workflow-callout button') as HTMLButtonElement)
        .disabled,
    ).toBeFalse();
  });
});
