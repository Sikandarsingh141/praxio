import { Subject, of } from 'rxjs';
import { fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { NotificationRealtimeService } from '../core/notifications/notification-realtime.service';
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
});
