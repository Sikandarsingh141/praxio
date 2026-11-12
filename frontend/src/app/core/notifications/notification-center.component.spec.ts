import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { FirebaseMessagingService } from './firebase-messaging.service';
import { NotificationCenterComponent } from './notification-center.component';

describe('NotificationCenterComponent', () => {
  let http: HttpTestingController;
  let firebaseMessaging: jasmine.SpyObj<FirebaseMessagingService>;

  beforeEach(async () => {
    firebaseMessaging = jasmine.createSpyObj<FirebaseMessagingService>('FirebaseMessagingService', [
      'isConfigured',
      'listen',
      'showBrowserNotification',
      'requestBrowserPermission',
    ]);
    firebaseMessaging.isConfigured.and.returnValue(false);
    firebaseMessaging.listen.and.returnValue(Promise.resolve(null));
    firebaseMessaging.showBrowserNotification.and.returnValue(Promise.resolve());
    firebaseMessaging.requestBrowserPermission.and.returnValue(Promise.resolve());
    await TestBed.configureTestingModule({
      imports: [NotificationCenterComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: FirebaseMessagingService, useValue: firebaseMessaging },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('does not poll notifications while the portal remains open', fakeAsync(() => {
    const fixture = TestBed.createComponent(NotificationCenterComponent);
    fixture.detectChanges();
    http.expectOne(`${environment.apiBaseUrl}/notifications/my`).flush({
      data: { notifications: [] },
    });

    tick(15000);

    http.expectNone(`${environment.apiBaseUrl}/notifications/my`);
    expect(fixture.componentInstance.notifications()).toEqual([]);
    fixture.destroy();
  }));

  it('lists the signed-in user notifications and marks an item read', () => {
    const fixture = TestBed.createComponent(NotificationCenterComponent);
    fixture.detectChanges();
    http.expectOne(`${environment.apiBaseUrl}/notifications/my`).flush({
      data: {
        notifications: [
          {
            id: '507f1f77bcf86cd799439011',
            title: 'New Customer Registration',
            message: 'A customer submitted a request.',
            type: 'new_registration',
            isRead: false,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.notification-count').textContent).toContain('1');
    (fixture.nativeElement.querySelector('.notification-trigger') as HTMLButtonElement).click();
    http.expectOne(`${environment.apiBaseUrl}/notifications/my`).flush({
      data: {
        notifications: [
          {
            id: '507f1f77bcf86cd799439011',
            title: 'New Customer Registration',
            message: 'A customer submitted a request.',
            type: 'new_registration',
            isRead: false,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('New Customer Registration');

    (fixture.nativeElement.querySelector('.notification-item') as HTMLButtonElement).click();
    http
      .expectOne(`${environment.apiBaseUrl}/notifications/507f1f77bcf86cd799439011/read`)
      .flush({ data: { read: true } });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.notification-count')).toBeNull();
  });

  it('refreshes for a decline, displays it immediately, and reloads the account status', () => {
    const fixture = TestBed.createComponent(NotificationCenterComponent);
    fixture.detectChanges();
    http.expectOne(`${environment.apiBaseUrl}/notifications/my`).flush({
      data: { notifications: [] },
    });
    fixture.componentInstance.refresh(true);

    http.expectOne(`${environment.apiBaseUrl}/notifications/my`).flush({
      data: {
        notifications: [
          {
            id: 'declined-notification',
            title: 'Customer Registration Declined',
            message: 'Your registration was declined. Reason: Incomplete details',
            type: 'registration_declined',
            isRead: false,
            createdAt: '2026-01-02T00:00:00.000Z',
          },
        ],
      },
    });
    http.expectOne(`${environment.apiBaseUrl}/users/me`).flush({
      data: {
        user: {
          id: 'customer-id',
          email: 'customer@example.com',
          createdAt: '2026-01-01T00:00:00.000Z',
          accountType: 'customer',
          accountStatus: 'rejected',
          customerAuthorization: {
            registrationStatus: 'declined',
            accountStatus: 'rejected',
            destination: '/customer/profile',
            submittedAt: '2026-01-01T00:00:00.000Z',
            reviewedAt: '2026-01-02T00:00:00.000Z',
            declineReason: 'Incomplete details',
          },
        },
      },
    });
    fixture.componentInstance.isOpen.set(true);
    fixture.detectChanges();

    expect(firebaseMessaging.showBrowserNotification).toHaveBeenCalledWith(
      'Customer Registration Declined',
      'Your registration was declined. Reason: Incomplete details',
      '/customer/profile',
    );
    expect(fixture.nativeElement.querySelector('.live-notice').textContent).toContain(
      'Customer Registration Declined',
    );
    expect(fixture.nativeElement.textContent).toContain('Customer Registration Declined');
    expect(fixture.nativeElement.querySelector('.notification-count').textContent).toContain('1');
  });

  it('lets the user enable browser alerts without Firebase configured', async () => {
    const fixture = TestBed.createComponent(NotificationCenterComponent);
    fixture.detectChanges();
    http.expectOne(`${environment.apiBaseUrl}/notifications/my`).flush({
      data: { notifications: [] },
    });
    (fixture.nativeElement.querySelector('.notification-trigger') as HTMLButtonElement).click();
    http.expectOne(`${environment.apiBaseUrl}/notifications/my`).flush({
      data: { notifications: [] },
    });
    fixture.detectChanges();

    await fixture.componentInstance.enablePush();
    fixture.detectChanges();

    expect(firebaseMessaging.requestBrowserPermission).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'Browser alerts are enabled while the app is open.',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Firebase setup is required for alerts while it is closed.',
    );
  });

  it('shows an approval notification through the same live update path', () => {
    const fixture = TestBed.createComponent(NotificationCenterComponent);
    fixture.detectChanges();
    http.expectOne(`${environment.apiBaseUrl}/notifications/my`).flush({
      data: { notifications: [] },
    });

    fixture.componentInstance.refresh(true);
    http.expectOne(`${environment.apiBaseUrl}/notifications/my`).flush({
      data: {
        notifications: [
          {
            id: 'approved-notification',
            title: 'Customer Registration Approved!',
            message: 'Your Customer registration has been approved.',
            type: 'registration_approved',
            isRead: false,
            createdAt: '2026-01-02T00:00:00.000Z',
          },
        ],
      },
    });
    http.expectOne(`${environment.apiBaseUrl}/users/me`).flush({
      data: {
        user: {
          id: 'customer-id',
          email: 'customer@example.com',
          createdAt: '2026-01-01T00:00:00.000Z',
          accountType: 'customer',
          accountStatus: 'active',
          customerAuthorization: {
            registrationStatus: 'approved',
            accountStatus: 'active',
            destination: '/customer',
            submittedAt: '2026-01-01T00:00:00.000Z',
            reviewedAt: '2026-01-02T00:00:00.000Z',
            declineReason: null,
          },
        },
      },
    });
    fixture.detectChanges();

    expect(firebaseMessaging.showBrowserNotification).toHaveBeenCalledWith(
      'Customer Registration Approved!',
      'Your Customer registration has been approved.',
      '/customer',
    );
    expect(fixture.componentInstance.liveMessage()?.title).toBe('Customer Registration Approved!');
  });

  it('filters notifications by read state and type and supports mark all read', () => {
    const fixture = TestBed.createComponent(NotificationCenterComponent);
    fixture.detectChanges();
    const notifications = [
      {
        id: 'dispute-1',
        title: 'New dispute message',
        message: 'A new dispute message arrived.',
        type: 'dispute_message' as const,
        isRead: false,
        createdAt: '2026-01-03T00:00:00.000Z',
      },
      {
        id: 'repair-1',
        title: 'Repair completed',
        message: 'Repair marked complete.',
        type: 'repair_job_completed' as const,
        isRead: false,
        createdAt: '2026-01-02T00:00:00.000Z',
      },
      {
        id: 'quotation-1',
        title: 'New quotation submitted',
        message: 'A quotation was submitted.',
        type: 'new_repair_quotation' as const,
        isRead: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      ...[1, 2, 3].map((index) => ({
        id: `read-${index}`,
        title: `Read notification ${index}`,
        message: 'Previously read.',
        type: 'account_activated' as const,
        isRead: true,
        createdAt: '2025-12-31T00:00:00.000Z',
      })),
    ];
    http.expectOne(`${environment.apiBaseUrl}/notifications/my`).flush({ data: { notifications } });
    (fixture.nativeElement.querySelector('.notification-trigger') as HTMLButtonElement).click();
    http.expectOne(`${environment.apiBaseUrl}/notifications/my`).flush({ data: { notifications } });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('3 unread');
    expect(fixture.nativeElement.textContent).toContain('All 6');
    expect(fixture.nativeElement.textContent).toContain('Unread 3');
    expect(fixture.nativeElement.textContent).toContain('Read 3');
    expect(fixture.nativeElement.textContent).toContain('View all notifications');

    const unreadTab = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.notification-tabs button',
      ) as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes('Unread')) as HTMLButtonElement;
    unreadTab.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.notification-item').length).toBe(3);

    const typeFilter = fixture.nativeElement.querySelector(
      '.type-filter select',
    ) as HTMLSelectElement;
    typeFilter.value = 'repair_job_completed';
    typeFilter.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.notification-item').length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Repair completed');

    const allTab = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.notification-tabs button',
      ) as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes('All')) as HTMLButtonElement;
    allTab.click();
    typeFilter.value = 'all';
    typeFilter.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.mark-all-read') as HTMLButtonElement).click();
    http
      .expectOne(`${environment.apiBaseUrl}/notifications/read-all`)
      .flush({ data: { read: true } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('3 unread');
    expect(fixture.nativeElement.querySelector('.notification-count')).toBeNull();
  });
});
