import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { EMPTY } from 'rxjs';
import { NotificationRealtimeService } from '../../core/notifications/notification-realtime.service';
import { ShopQuotationsPage } from './shop-quotations.page';
import { ShopRepairRequestsService } from '../repair-requests/shop-repair-requests.service';

describe('ShopQuotationsPage', () => {
  it('returns customer uploaded photo and handles image fallback', () => {
    const listQuotations = jasmine.createSpy().and.returnValue(EMPTY);
    TestBed.configureTestingModule({
      providers: [
        { provide: ShopRepairRequestsService, useValue: { listQuotations } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
        {
          provide: NotificationRealtimeService,
          useValue: { notifications$: EMPTY },
        },
      ],
    });

    const fixture = TestBed.createComponent(ShopQuotationsPage);
    const component = fixture.componentInstance;
    expect(component.pageSizeOptions).toEqual([5, 10, 25, 50]);
    component.changePageSize(100);
    expect(component.limit()).toBe(10);
    expect(listQuotations).not.toHaveBeenCalled();
    component.changePageSize(50);
    expect(component.limit()).toBe(50);
    expect(listQuotations).toHaveBeenCalledWith(
      jasmine.objectContaining({ page: 1, limit: 50 }),
    );

    const mockQuoteWithPhoto: any = {
      _id: 'quote-1',
      repairRequest: {
        _id: 'req-1',
        appliance: 'Nokia Phone',
        description: 'Screen broken',
        photos: [{ data: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==', mimeType: 'image/jpeg' }],
      },
      customer: {
        firstName: 'Sikandar',
        lastName: 'Customer',
        profileImageUrl: 'Y3VzdG9tZXI=',
      },
      shop: { id: 's1', shopName: 'Sikandar Shop' },
    };

    const mockQuoteNoPhoto: any = {
      _id: 'quote-2',
      repairRequest: {
        _id: 'req-2',
        appliance: 'Mobile Phone',
        description: 'Battery issue',
        photos: [],
      },
      customer: { firstName: 'Sikandar', lastName: 'Customer' },
      shop: { id: 's1', shopName: 'Sikandar Shop' },
    };

    expect(component.getCustomerPhoto(mockQuoteWithPhoto)).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
    expect(component.getCustomerPhoto(mockQuoteNoPhoto)).toBeNull();
    expect(component.customerPhotoSource(mockQuoteWithPhoto)).toBe(
      'data:image/jpeg;base64,Y3VzdG9tZXI=',
    );

    // On photo error, fallback to null
    component.onPhotoError('quote-1');
    expect(component.getCustomerPhoto(mockQuoteWithPhoto)).toBeNull();
    component.onCustomerPhotoError('quote-1');
    expect(component.customerPhotoSource(mockQuoteWithPhoto)).toBeNull();

    fixture.destroy();
  });
});
