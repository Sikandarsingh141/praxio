import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ToastService } from '../../../core/toast/toast.service';
import { ShopRepairRequest } from '../../repair-requests/shop-repair-requests.models';
import { ShopRepairRequestsService } from '../../repair-requests/shop-repair-requests.service';
import { RepairWorkflowJob } from '../../../shared/models/repair-workflow.models';
import { ShopRepairPickupComponent } from './shop-repair-pickup.component';

describe('ShopRepairPickupComponent', () => {
  it('schedules, starts, and confirms pickup only when physical collection is required', async () => {
    const requests = jasmine.createSpyObj<ShopRepairRequestsService>(
      'ShopRepairRequestsService',
      ['schedulePickup', 'startPickup', 'confirmPickup', 'get'],
    );
    requests.schedulePickup.and.returnValue(of(undefined));
    requests.startPickup.and.returnValue(of(undefined));
    requests.confirmPickup.and.returnValue(of(undefined));
    requests.get.and.returnValue(
      of({
        _id: 'request-1',
        repairJob: { status: 'inspection_pending' },
      } as ShopRepairRequest),
    );
    const toast = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error']);

    await TestBed.configureTestingModule({
      imports: [ShopRepairPickupComponent],
      providers: [
        { provide: ShopRepairRequestsService, useValue: requests },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ShopRepairPickupComponent);
    const createRequest = (status: RepairWorkflowJob['status']): ShopRepairRequest => ({
      _id: 'request-1',
      appliance: 'Washing machine',
      description: 'It does not spin',
      photos: [],
      status: 'open',
      createdAt: new Date().toISOString(),
      customer: { firstName: 'Customer', lastName: 'Example' },
      shopResponse: { status: 'customer_accepted' },
      quotations: [],
      repairJob: { status, requiresPhysicalPickup: true },
    });

    fixture.componentRef.setInput('request', createRequest('confirmed'));
    fixture.detectChanges();
    expect(fixture.componentInstance.canSchedulePickup).toBeTrue();
    (fixture.nativeElement.querySelector(
      '.pickup-panel .primary-button',
    ) as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('#pickup-schedule-title')?.textContent,
    ).toContain('Schedule Pickup');

    fixture.componentInstance.pickupDate.set('2026-11-20');
    fixture.componentInstance.schedulePickup();
    expect(fixture.componentInstance.error()).toBe('Select a pickup date and time.');
    expect(requests.schedulePickup).not.toHaveBeenCalled();

    fixture.componentInstance.pickupTime.set('09:00');
    fixture.componentInstance.pickupNotes.set('Morning');
    fixture.componentInstance.schedulePickup();
    expect(requests.schedulePickup).toHaveBeenCalledWith('request-1', {
      scheduledAt: new Date('2026-11-20T09:00').toISOString(),
      notes: 'Morning',
    });

    fixture.componentRef.setInput('request', createRequest('pickup_scheduled'));
    fixture.detectChanges();
    expect(fixture.componentInstance.canStartPickup).toBeTrue();
    fixture.componentInstance.startPickup();
    expect(requests.startPickup).toHaveBeenCalledWith('request-1', 'Morning');

    fixture.componentRef.setInput('request', createRequest('pickup_in_progress'));
    fixture.detectChanges();
    expect(fixture.componentInstance.canConfirmPickup).toBeTrue();
    fixture.componentInstance.confirmPickup();
    expect(requests.confirmPickup).toHaveBeenCalledWith('request-1', {
      notes: 'Morning',
    });

    fixture.componentRef.setInput('request', createRequest('inspection_pending'));
    fixture.detectChanges();
    expect(fixture.componentInstance.needsPhysicalPickup).toBeFalse();
    expect(fixture.componentInstance.canConfirmPickup).toBeFalse();

    fixture.componentRef.setInput('request', {
      ...createRequest('confirmed'),
      repairJob: { status: 'confirmed', requiresPhysicalPickup: false },
    });
    fixture.detectChanges();
    expect(fixture.componentInstance.canSchedulePickup).toBeFalse();
    expect(fixture.nativeElement.querySelector('.pickup-panel')).toBeNull();
  });
});
