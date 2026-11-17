import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ToastService } from '../../../core/toast/toast.service';
import { RepairWorkflowJob } from '../../../shared/models/repair-workflow.models';
import { TechnicianRepairDetails } from '../../../shop/technicians/technicians.models';
import { TechniciansService } from '../../../shop/technicians/technicians.service';
import { TechnicianAdditionalChargesComponent } from './technician-additional-charges.component';

describe('TechnicianAdditionalChargesComponent', () => {
  const technicians = {
    requestAdditionalCharges: jasmine.createSpy('requestAdditionalCharges'),
    myJobDetails: jasmine.createSpy('myJobDetails'),
  };
  const toast = {
    success: jasmine.createSpy('success'),
    error: jasmine.createSpy('error'),
  };

  beforeEach(async () => {
    technicians.requestAdditionalCharges.calls.reset();
    technicians.myJobDetails.calls.reset();
    await TestBed.configureTestingModule({
      imports: [TechnicianAdditionalChargesComponent],
      providers: [
        { provide: TechniciansService, useValue: technicians },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(TechnicianAdditionalChargesComponent);
    fixture.componentRef.setInput('requestId', 'request-1');
    fixture.componentRef.setInput('repairJob', {
      status: 'in_progress',
      additionalChargeRequests: [],
    } as RepairWorkflowJob);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  it('requires issue details and a positive amount before submitting', async () => {
    const { component } = createComponent();

    await component.save('submit');

    expect(component.error()).toContain('Complete the additional-work details');
    expect(technicians.requestAdditionalCharges).not.toHaveBeenCalled();
  });

  it('submits a valid request and refreshes the assigned job details', async () => {
    const refreshedRequest = { id: 'request-1' } as TechnicianRepairDetails;
    technicians.requestAdditionalCharges.and.returnValue(of({ _id: 'charge-1' }));
    technicians.myJobDetails.and.returnValue(of(refreshedRequest));
    const { component } = createComponent();
    const updated = jasmine.createSpy('requestUpdated');
    component.requestUpdated.subscribe(updated);
    component.issue.set('Damaged connector');
    component.reason.set('The connector is damaged beneath the cover.');
    component.repairDescription.set('Replace and test the connector.');
    component.parts.set([{ name: 'Connector', quantity: 1, unitPrice: 25 }]);

    await component.save('submit');

    expect(technicians.requestAdditionalCharges).toHaveBeenCalledWith(
      'request-1',
      jasmine.objectContaining({
        action: 'submit',
        issue: 'Damaged connector',
        reason: 'The connector is damaged beneath the cover.',
        repairDescription: 'Replace and test the connector.',
      }),
    );
    expect(updated).toHaveBeenCalledWith(refreshedRequest);
    expect(toast.success).toHaveBeenCalled();
  });
});
