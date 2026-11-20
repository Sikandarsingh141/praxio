import { Subject, of } from 'rxjs';
import { fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { NotificationRealtimeService } from '../../core/notifications/notification-realtime.service';
import { ShopRepairRequestPage } from './shop-repair-requests.models';
import { ShopRepairRequestsPage } from './shop-repair-requests.page';
import { ShopRepairRequestsService } from './shop-repair-requests.service';

describe('ShopRepairRequestsPage', () => {
  it('loads once on entry and refreshes repair requests only on realtime updates', fakeAsync(() => {
    const emptyPage: ShopRepairRequestPage = {
      requests: [],
      page: 1,
      limit: 10,
      total: 0,
      summary: { total: 0, new: 0, pending: 0, accepted: 0, declined: 0, expired: 0 },
    };
    const notifications = new Subject<{ type: string }>();
    const requests = {
      list: jasmine.createSpy().and.returnValue(of(emptyPage)),
    };
    const component = new ShopRepairRequestsPage(
      requests as unknown as ShopRepairRequestsService,
      { notifications$: notifications.asObservable() } as unknown as NotificationRealtimeService,
      { snapshot: { data: {} } } as ActivatedRoute,
    );
    component.ngOnInit();

    expect(requests.list).toHaveBeenCalledTimes(1);

    tick(15000);
    expect(requests.list).toHaveBeenCalledTimes(1);

    notifications.next({ type: 'new_repair_request' });
    expect(requests.list).toHaveBeenCalledTimes(2);

    component.ngOnDestroy();
  }));

  it('correctly retrieves customer uploaded photo when present, and returns null when absent', () => {
    const component = new ShopRepairRequestsPage(
      {} as unknown as ShopRepairRequestsService,
      { notifications$: of() } as unknown as NotificationRealtimeService,
      { snapshot: { data: {} } } as ActivatedRoute,
    );

    const withPhoto = {
      _id: 'req-1',
      photos: [{ mimeType: 'image/jpeg', data: 'data:image/jpeg;base64,abc123' }],
    } as any;
    expect(component.getCustomerPhoto(withPhoto)).toBe('data:image/jpeg;base64,abc123');

    const withRawBase64 = {
      _id: 'req-2',
      photos: [{ mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUg==' }],
    } as any;
    expect(component.getCustomerPhoto(withRawBase64)).toBe('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==');

    const withoutPhoto = {
      _id: 'req-3',
      photos: [],
    } as any;
    expect(component.getCustomerPhoto(withoutPhoto)).toBeNull();

    // After photo load error, returns null fallback
    component.onPhotoError(withPhoto);
    expect(component.getCustomerPhoto(withPhoto)).toBeNull();
  });

  it('normalizes customer profile photos and falls back when an image fails', () => {
    const component = new ShopRepairRequestsPage(
      {} as unknown as ShopRepairRequestsService,
      { notifications$: of() } as unknown as NotificationRealtimeService,
      { snapshot: { data: {} } } as ActivatedRoute,
    );
    const request = {
      _id: 'request-1',
      customer: { profileImageUrl: 'Y3VzdG9tZXI=' },
    } as any;

    expect(component.customerPhotoSource(request)).toBe(
      'data:image/jpeg;base64,Y3VzdG9tZXI=',
    );
    component.onCustomerPhotoError(request);
    expect(component.customerPhotoSource(request)).toBeNull();
  });

  it('keeps API-backed request page sizes within the server limit', () => {
    const component = new ShopRepairRequestsPage(
      {} as unknown as ShopRepairRequestsService,
      { notifications$: of() } as unknown as NotificationRealtimeService,
      { snapshot: { data: {} } } as ActivatedRoute,
    );

    expect(component.pageSizeOptions).toEqual([5, 10, 25, 50]);
    component.changePageSize(100);
    expect(component.pageSize()).toBe(10);
  });
});
