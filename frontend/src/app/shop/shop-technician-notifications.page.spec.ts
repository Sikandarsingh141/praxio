import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { RegistrationNotification } from '../core/auth/auth.models';
import { NotificationRealtimeService } from '../core/notifications/notification-realtime.service';
import { ShopTechnicianNotificationsPage } from './shop-technician-notifications.page';

describe('ShopTechnicianNotificationsPage', () => {
  let http: HttpTestingController;
  let incoming: Subject<RegistrationNotification>;
  let realtime: {
    notifications$: ReturnType<Subject<RegistrationNotification>['asObservable']>;
    publishUnreadCount: jasmine.Spy;
  };

  beforeEach(async () => {
    incoming = new Subject<RegistrationNotification>();
    realtime = {
      notifications$: incoming.asObservable(),
      publishUnreadCount: jasmine.createSpy('publishUnreadCount'),
    };
    await TestBed.configureTestingModule({
      imports: [ShopTechnicianNotificationsPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: NotificationRealtimeService, useValue: realtime },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('adds live job notifications and links them to technician job details', () => {
    const fixture = TestBed.createComponent(ShopTechnicianNotificationsPage);
    fixture.detectChanges();
    http.expectOne(`${environment.apiBaseUrl}/notifications/my`).flush({
      data: { notifications: [] },
    });

    const notification: RegistrationNotification = {
      id: 'notice-1',
      title: 'Customer approved the repair estimate',
      message: 'The customer approved the inspection estimate.',
      type: 'repair_inspection_approved',
      isRead: false,
      createdAt: '2026-11-16T10:00:00.000Z',
      relatedEntityId: 'repair-1',
      relatedEntityType: 'repair_request',
      link: '/shop/repair-requests/repair-1',
    };
    incoming.next(notification);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Customer approved the repair estimate');
    expect(fixture.componentInstance.unreadCount()).toBe(1);
    expect(fixture.componentInstance.getNavigationLink(notification)).toEqual([
      '/technician/jobs',
      'repair-1',
    ]);
    expect(realtime.publishUnreadCount).toHaveBeenCalledWith(1);

    fixture.destroy();
  });
});
