import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { ToastService } from '../../../core/toast/toast.service';
import { CustomerPortalService } from '../../services/customer-portal.service';
import { CustomerRepairWorkflowComponent } from './customer-repair-workflow.component';
import { CustomerRepairRequest, RepairReview } from '../../models/customer-portal.models';

describe('CustomerRepairWorkflowComponent', () => {
  function createRequest(
    status:
      | 'inspection_in_progress'
      | 'awaiting_customer_approval'
      | 'ready_for_pickup'
      | 'picked_up',
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
      providers: [
        { provide: CustomerPortalService, useValue: {} },
        {
          provide: ToastService,
          useValue: { success: jasmine.createSpy(), error: jasmine.createSpy() },
        },
        { provide: Router, useValue: { navigate: jasmine.createSpy().and.resolveTo(true) } },
      ],
    }).compileComponents();
  });

  it('does not expose a shop inspection draft to the customer', () => {
    const fixture = TestBed.createComponent(CustomerRepairWorkflowComponent);
    fixture.componentRef.setInput('request', createRequest('inspection_in_progress'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('inspecting your device');
    expect(fixture.nativeElement.textContent).not.toContain('Broken motor');
    expect(fixture.nativeElement.textContent).not.toContain('150');
    expect(fixture.nativeElement.textContent).not.toContain('Confirm item received');
    expect(fixture.nativeElement.textContent).not.toContain('Rate your repair experience');
  });

  it('shows the submitted inspection estimate and approval action', () => {
    const fixture = TestBed.createComponent(CustomerRepairWorkflowComponent);
    fixture.componentRef.setInput('request', createRequest('awaiting_customer_approval'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Broken motor');
    expect(fixture.nativeElement.textContent).toContain('150');
    expect(fixture.nativeElement.textContent).toContain('Approve Estimate');
  });

  it('lets the customer confirm pickup when the repair is ready', () => {
    const request = createRequest('ready_for_pickup');
    const updatedRequest: CustomerRepairRequest = {
      ...request,
      repairJob: { ...request.repairJob!, status: 'picked_up' },
    };
    const portal = jasmine.createSpyObj<CustomerPortalService>(
      'CustomerPortalService',
      ['confirmPickup', 'getRepairJob'],
    );
    portal.confirmPickup.and.returnValue(of(undefined));
    portal.getRepairJob.and.returnValue(of(updatedRequest));
    TestBed.overrideProvider(CustomerPortalService, { useValue: portal });

    const fixture = TestBed.createComponent(CustomerRepairWorkflowComponent);
    fixture.componentRef.setInput('request', request);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    spyOn(component.requestUpdated, 'emit');
    const pickupConfirmed = spyOn(component.pickupConfirmed, 'emit');

    expect(fixture.nativeElement.textContent).toContain('Confirm item received');
    expect(fixture.nativeElement.textContent).not.toContain('Rate your repair experience');
    component.confirmPickup();

    expect(portal.confirmPickup).toHaveBeenCalledWith('request-1', {
      received: true,
      inspected: true,
      satisfaction: 'satisfied',
      comments: undefined,
      issueDescription: undefined,
    });
    expect(component.requestUpdated.emit).toHaveBeenCalledWith(updatedRequest);
    expect(pickupConfirmed).toHaveBeenCalledWith(updatedRequest);
    expect(component.submitting()).toBeFalse();
  });

  it('lets the customer review a picked-up repair and refreshes the request', () => {
    const request = createRequest('picked_up');
    const review: RepairReview = {
      _id: 'review-1',
      repairRequestId: request._id,
      overallRating: 5,
      repairQuality: 5,
      communication: 5,
      professionalism: 5,
      timeliness: 5,
      valueForMoney: 5,
      reviewText: 'Excellent repair',
      wouldRecommend: true,
      createdAt: new Date().toISOString(),
    };
    const updatedRequest: CustomerRepairRequest = {
      ...request,
      repairJob: { ...request.repairJob!, status: 'completed' },
      review,
    };
    const portal = jasmine.createSpyObj<CustomerPortalService>(
      'CustomerPortalService',
      ['submitRepairReview', 'getRepairJob'],
    );
    portal.submitRepairReview.and.returnValue(of(review));
    portal.getRepairJob.and.returnValue(of(updatedRequest));
    TestBed.overrideProvider(CustomerPortalService, { useValue: portal });

    const fixture = TestBed.createComponent(CustomerRepairWorkflowComponent);
    fixture.componentRef.setInput('request', request);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.reviewText.set('Excellent repair');
    spyOn(component.requestUpdated, 'emit');

    expect(fixture.nativeElement.textContent).toContain('Rate your repair experience');
    component.submitReview();

    expect(portal.submitRepairReview).toHaveBeenCalledWith('request-1', jasmine.objectContaining({
      overallRating: 5,
      reviewText: 'Excellent repair',
      wouldRecommend: true,
    }));
    expect(component.requestUpdated.emit).toHaveBeenCalledWith(updatedRequest);
    expect(component.submitting()).toBeFalse();
  });
});
