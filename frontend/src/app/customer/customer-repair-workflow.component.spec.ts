import { TestBed } from '@angular/core/testing';
import { CustomerPortalService } from './customer-portal.service';
import { CustomerRepairWorkflowComponent } from './customer-repair-workflow.component';
import { CustomerRepairRequest } from './customer-portal.models';

describe('CustomerRepairWorkflowComponent', () => {
  function createRequest(
    status: 'inspection_in_progress' | 'awaiting_customer_approval',
  ): CustomerRepairRequest {
    return {
      _id: 'request-1',
      shopIds: [],
      appliance: 'Washing machine',
      description: 'It does not spin',
      status: 'open',
      createdAt: new Date().toISOString(),
      quotations: [],
      repairJob: {
        status,
        inspection: {
          status: status === 'awaiting_customer_approval' ? 'awaiting_approval' : 'draft',
          identifiedProblem: 'Broken motor',
          findings: 'Motor winding is damaged',
          requiredRepairWork: 'Replace the motor',
          parts: [],
          partsTotal: 0,
          labourCharge: 0,
          inspectionCharges: 0,
          otherCharges: 0,
          estimatedTotal: 150,
          images: [],
        },
      },
    };
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerRepairWorkflowComponent],
      providers: [{ provide: CustomerPortalService, useValue: {} }],
    }).compileComponents();
  });

  it('does not expose a shop inspection draft to the customer', () => {
    const fixture = TestBed.createComponent(CustomerRepairWorkflowComponent);
    fixture.componentRef.setInput('request', createRequest('inspection_in_progress'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('inspecting your device');
    expect(fixture.nativeElement.textContent).not.toContain('Broken motor');
    expect(fixture.nativeElement.textContent).not.toContain('150');
  });

  it('shows the submitted inspection estimate and approval action', () => {
    const fixture = TestBed.createComponent(CustomerRepairWorkflowComponent);
    fixture.componentRef.setInput('request', createRequest('awaiting_customer_approval'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Broken motor');
    expect(fixture.nativeElement.textContent).toContain('150');
    expect(fixture.nativeElement.textContent).toContain('Approve Estimate');
  });
});
