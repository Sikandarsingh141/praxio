import { TestBed } from '@angular/core/testing';
import { ShopRepairRequestsService } from './shop-repair-requests.service';
import { ShopRepairWorkflowComponent } from './shop-repair-workflow.component';
import { ShopRepairRequest } from './shop-repair-requests.models';

describe('ShopRepairWorkflowComponent', () => {
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

    const identifiedProblem = fixture.nativeElement.querySelector(
      '[name="identifiedProblem"]',
    ) as HTMLTextAreaElement;
    const findings = fixture.nativeElement.querySelector(
      '[name="findings"]',
    ) as HTMLTextAreaElement;
    expect(fixture.componentInstance.identifiedProblem()).toBe('Broken motor');
    expect(identifiedProblem.value).toBe('Broken motor');
    expect(identifiedProblem.required).toBeTrue();
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
});
