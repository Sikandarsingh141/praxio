import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { EMPTY } from 'rxjs';
import { NotificationRealtimeService } from '../../core/notifications/notification-realtime.service';
import { CustomerQuotation } from '../models/customer-portal.models';
import { CustomerPortalService } from '../services/customer-portal.service';
import { CustomerQuotationsPage } from './customer-quotations.page';

describe('CustomerQuotationsPage', () => {
  it('shows the request workflow status for accepted quotations', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: CustomerPortalService, useValue: {} },
        { provide: ActivatedRoute, useValue: {} },
        {
          provide: NotificationRealtimeService,
          useValue: { notifications$: EMPTY },
        },
      ],
    });

    const fixture = TestBed.createComponent(CustomerQuotationsPage);
    const request = {
      _id: 'request-id',
      appliance: 'Mobile',
      description: 'Screen issue',
      status: 'completed',
      repairJob: { status: 'completed' },
    } satisfies CustomerQuotation['repairRequest'];

    expect(fixture.componentInstance.repairStatusLabel(request)).toBe('Repair Completed');
    expect(
      fixture.componentInstance.repairStatusLabel({
        ...request,
        status: 'open',
        repairJob: { status: 'ready_for_pickup' },
      }),
    ).toBe('Ready for Pickup');
    expect(
      fixture.componentInstance.repairStatusLabel({
        ...request,
        status: 'cancelled',
        repairJob: undefined,
      }),
    ).toBe('Repair Cancelled');

    const quoteWithPhoto: any = {
      _id: 'q-1',
      repairRequest: {
        _id: 'req-1',
        photos: [{ data: 'data:image/png;base64,abc1234', mimeType: 'image/png' }],
      },
    };
    expect(fixture.componentInstance.getCustomerPhoto(quoteWithPhoto)).toBe('data:image/png;base64,abc1234');
    fixture.componentInstance.onPhotoError('q-1');
    expect(fixture.componentInstance.getCustomerPhoto(quoteWithPhoto)).toBeNull();

    fixture.destroy();
  });
});
