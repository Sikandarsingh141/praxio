import { DatePipe } from '@angular/common';
import { Component, inject, NgZone, OnDestroy, OnInit, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { getAuthErrorMessage } from '../auth/auth-error-message';
import { AuthService } from '../auth/auth.service';
import { RegistrationNotification } from '../auth/auth.models';
import { FirebaseMessagingService } from './firebase-messaging.service';
import type { Unsubscribe } from 'firebase/messaging';
import { Subscription } from 'rxjs';
import { NotificationRealtimeService } from './notification-realtime.service';

@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="notification-center">
      <button
        class="notification-trigger"
        type="button"
        aria-label="Notifications"
        [attr.aria-expanded]="isOpen()"
        (click)="toggle()"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        @if (unreadCount()) {
          <span class="notification-count">{{ unreadCount() > 99 ? '99+' : unreadCount() }}</span>
        }
      </button>

      @if (liveMessage(); as message) {
        <aside class="live-notice" role="status">
          <div>
            <strong>{{ message.title }}</strong>
            <span>{{ message.body }}</span>
          </div>
          <button type="button" aria-label="Dismiss notification" (click)="dismissLiveMessage()">
            ×
          </button>
        </aside>
      }

      @if (isOpen()) {
        <section class="notification-panel" aria-label="Notifications">
          <header class="notification-heading">
            <h2>Notifications</h2>
            <div class="notification-heading-actions">
              @if (unreadCount()) {
                <span class="unread-total">{{ unreadCount() }} unread</span>
              }
              @if (unreadCount()) {
                <button type="button" class="mark-all-read" (click)="markAllRead()">
                  Mark all read
                </button>
              }
              <button
                type="button"
                class="close-panel"
                aria-label="Close notifications"
                (click)="close()"
              >
                ×
              </button>
            </div>
          </header>
          @if (browserNotificationsSupported) {
            <div class="push-banner">
              <span class="push-icon" aria-hidden="true">♧</span>
              <div>
                <strong>Enable browser notifications</strong>
                <p>
                  Receive alerts while using Reparo. Push notifications when the app is closed
                  require Firebase Cloud Messaging setup.
                </p>
                @if (pushMessage()) {
                  <small role="status">{{ pushMessage() }}</small>
                }
              </div>
              <button type="button" [disabled]="enablingPush()" (click)="enablePush()">
                {{ enablingPush() ? 'Enabling…' : 'Enable' }}
              </button>
            </div>
          } @else {
            <p class="push-hint">This browser does not support browser notifications.</p>
          }
          @if (errorMessage()) {
            <p class="notification-error" role="alert">{{ errorMessage() }}</p>
          }
          <div class="notification-filters">
            <div class="notification-tabs" role="group" aria-label="Filter notifications">
              <button type="button" [class.active]="filter() === 'all'" (click)="setFilter('all')">
                All <span>{{ notifications().length }}</span>
              </button>
              <button
                type="button"
                [class.active]="filter() === 'unread'"
                (click)="setFilter('unread')"
              >
                Unread <span>{{ unreadCount() }}</span>
              </button>
              <button
                type="button"
                [class.active]="filter() === 'read'"
                (click)="setFilter('read')"
              >
                Read <span>{{ readCount() }}</span>
              </button>
            </div>
            <label class="type-filter">
              <span class="visually-hidden">Filter by notification type</span>
              <select [value]="typeFilter()" (change)="setTypeFilter($event)">
                <option value="all">All types</option>
                @for (type of notificationTypes(); track type) {
                  <option [value]="type">{{ typeLabel(type) }}</option>
                }
              </select>
            </label>
          </div>
          @if (loading()) {
            <p class="notification-empty" role="status">Loading notifications…</p>
          } @else if (!filteredNotifications().length) {
            <p class="notification-empty">You’re all caught up.</p>
          } @else {
            <ul class="notification-list">
              @for (notification of visibleNotifications(); track notification.id) {
                <li [class.unread]="!notification.isRead">
                  <button
                    class="notification-item"
                    type="button"
                    [attr.aria-label]="notification.title + (notification.isRead ? '' : ', unread')"
                    (click)="markRead(notification)"
                  >
                    <span
                      class="notification-kind"
                      [attr.data-kind]="notificationKind(notification)"
                      aria-hidden="true"
                      >{{ notificationIcon(notification) }}</span
                    >
                    <span class="notification-copy">
                      <strong class="notification-title">{{ notification.title }}</strong>
                      <span class="notification-message">{{ notification.message }}</span>
                      <time
                        ><span aria-hidden="true">▣</span>
                        {{ notification.createdAt | date: 'MMM d, y, h:mm a' }}</time
                      >
                    </span>
                    @if (!notification.isRead) {
                      <span class="unread-dot" aria-label="Unread"></span>
                    }
                  </button>
                </li>
              }
            </ul>
          }
          @if (filteredNotifications().length > 5) {
            <button type="button" class="view-all" (click)="toggleShowAll()">
              <span aria-hidden="true">↗</span>
              {{ showAll() ? 'Show fewer notifications' : 'View all notifications' }}
            </button>
          }
        </section>
      }
    </div>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
    }

    .notification-center {
      position: relative;
      z-index: 20;
    }

    .notification-trigger {
      position: relative;
      display: grid;
      width: 42px;
      height: 42px;
      place-items: center;
      border: 1px solid #dfe4ec;
      border-radius: 12px;
      background: #fff;
      color: #33443a;
      cursor: pointer;
    }

    .notification-trigger svg {
      width: 20px;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 1.7;
    }

    .notification-count {
      position: absolute;
      top: -5px;
      right: -5px;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      border-radius: 999px;
      background: #dc2626;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      line-height: 18px;
      text-align: center;
    }

    .live-notice {
      position: absolute;
      z-index: 21;
      top: calc(100% + 10px);
      right: 0;
      display: flex;
      width: min(440px, calc(100vw - 24px));
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px;
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      background: #eff6ff;
      box-shadow: 0 12px 32px #0f172a24;
      color: #1e293b;
    }

    .live-notice div {
      display: grid;
      gap: 5px;
    }

    .live-notice strong {
      font-size: 13px;
    }

    .live-notice span {
      color: #475569;
      font-size: 13px;
      line-height: 1.4;
    }

    .live-notice button {
      border: 0;
      background: transparent;
      color: #64748b;
      cursor: pointer;
      font: inherit;
      font-size: 20px;
      line-height: 1;
    }

    .notification-panel {
      position: absolute;
      z-index: 20;
      top: calc(100% + 10px);
      right: 0;
      display: flex;
      width: min(440px, calc(100vw - 24px));
      max-height: min(82vh, 660px);
      flex-direction: column;
      overflow: hidden;
      border: 1px solid #dce5df;
      border-radius: 16px;
      background: #fff;
      box-shadow: 0 18px 50px #10241a30;
      color: #17211b;
    }

    .notification-heading {
      display: flex;
      flex: 0 0 auto;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 15px 16px 13px;
      border-bottom: 1px solid #e7ece8;
    }

    .notification-heading-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .unread-total {
      padding: 5px 9px;
      border-radius: 8px;
      background: #e1f3e5;
      color: #176b34;
      font-size: 11px;
      font-weight: 750;
    }

    .mark-all-read {
      padding: 5px 4px;
      border: 0;
      background: transparent;
      color: #087c3b;
      cursor: pointer;
      font: inherit;
      font-size: 11px;
      font-weight: 700;
    }

    .notification-heading h2 {
      margin: 0;
      font-size: 17px;
      font-weight: 750;
    }

    .close-panel {
      border: 0;
      background: transparent;
      color: #536157;
      cursor: pointer;
      font-size: 22px;
      line-height: 1;
    }

    .push-hint,
    .notification-empty {
      margin: 14px 16px;
    }

    .push-banner {
      display: grid;
      grid-template-columns: 38px minmax(0, 1fr) auto;
      align-items: center;
      gap: 10px;
      margin: 9px 11px 8px;
      padding: 10px;
      border: 1px solid #e0efe3;
      border-radius: 12px;
      background: linear-gradient(110deg, #eff9f0, #f8fcf8);
    }

    .push-icon {
      display: grid;
      width: 36px;
      height: 36px;
      place-items: center;
      border-radius: 10px;
      background: #dcf2e1;
      color: #087c3b;
      font-size: 21px;
    }

    .push-banner strong {
      color: #1a2a20;
      font-size: 12px;
    }

    .push-banner p {
      margin: 3px 0 0;
      color: #526258;
      font-size: 10px;
      line-height: 1.4;
    }

    .push-banner small {
      display: block;
      margin-top: 3px;
      color: #176b34;
      font-size: 10px;
    }

    .push-banner button {
      min-height: 30px;
      padding: 5px 10px;
      border: 1px solid #a9d2b2;
      border-radius: 8px;
      background: #fff;
      color: #176b34;
      cursor: pointer;
      font: inherit;
      font-size: 11px;
      font-weight: 700;
    }

    .push-banner button:disabled {
      cursor: wait;
      opacity: 0.65;
    }

    .push-hint {
      color: #64748b;
      font-size: 12px;
    }

    .notification-filters {
      display: flex;
      flex: 0 0 auto;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 12px;
    }

    .notification-tabs {
      display: flex;
      min-width: 0;
      gap: 5px;
    }

    .notification-tabs button,
    .type-filter select {
      min-height: 31px;
      padding: 5px 9px;
      border: 1px solid #dfe7e2;
      border-radius: 8px;
      background: #fff;
      color: #435248;
      font: inherit;
      font-size: 10px;
      font-weight: 650;
      white-space: nowrap;
    }

    .notification-tabs button {
      cursor: pointer;
    }

    .notification-tabs button span {
      margin-left: 3px;
      color: #718078;
    }

    .notification-tabs button.active {
      border-color: #087c3b;
      background: #087c3b;
      color: #fff;
    }

    .notification-tabs button.active span {
      color: #d7f0dc;
    }

    .type-filter select {
      max-width: 105px;
      cursor: pointer;
    }

    .notification-error {
      margin: 5px 14px;
      color: #b91c1c;
      font-size: 12px;
    }

    .notification-empty {
      color: #64748b;
      font-size: 12px;
    }

    .notification-list {
      flex: 1 1 auto;
      overflow: auto;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .notification-list li {
      border-top: 1px solid #edf1ed;
    }

    .notification-list li.unread {
      background: linear-gradient(100deg, #eff8f0, #f9fcf9);
    }

    .notification-item {
      display: flex;
      width: 100%;
      align-items: flex-start;
      gap: 11px;
      padding: 10px 12px;
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font: inherit;
      text-align: left;
    }

    .notification-item:hover {
      background: #f7faf7;
    }

    .notification-kind {
      display: grid;
      width: 36px;
      height: 36px;
      flex: 0 0 auto;
      place-items: center;
      border-radius: 10px;
      background: #eaf3ff;
      color: #2471d4;
      font-size: 19px;
      font-weight: 700;
    }

    .notification-kind[data-kind='dispute'] {
      background: #fff0ef;
      color: #e04439;
    }

    .notification-kind[data-kind='repair'] {
      background: #f1eaff;
      color: #7544c8;
    }

    .notification-kind[data-kind='account'] {
      background: #e8f6ec;
      color: #16803c;
    }

    .notification-kind[data-kind='quotation'] {
      background: #eaf3ff;
      color: #2471d4;
    }

    .notification-copy {
      display: grid;
      min-width: 0;
      flex: 1;
      gap: 3px;
    }

    .notification-title {
      overflow: hidden;
      color: #17211b;
      font-size: 12px;
      font-weight: 750;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .notification-message {
      display: -webkit-box;
      overflow: hidden;
      color: #526258;
      font-size: 11px;
      line-height: 1.35;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }

    .notification-item time {
      display: flex;
      align-items: center;
      gap: 5px;
      margin-top: 2px;
      color: #77867c;
      font-size: 10px;
    }

    .unread-dot {
      width: 8px;
      height: 8px;
      flex: 0 0 auto;
      margin: 6px 0 0 2px;
      border-radius: 50%;
      background: #087c3b;
    }

    .view-all {
      display: flex;
      width: 100%;
      flex: 0 0 auto;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px;
      border: 0;
      border-top: 1px solid #e7ece8;
      background: #fff;
      color: #087c3b;
      cursor: pointer;
      font: inherit;
      font-size: 13px;
      font-weight: 750;
    }

    .view-all:hover {
      background: #f6faf6;
    }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
    }

    @media (max-width: 480px) {
      .notification-panel {
        position: fixed;
        top: 62px;
        right: 12px;
        width: calc(100vw - 24px);
        max-height: calc(100vh - 76px);
      }

      .notification-tabs {
        gap: 3px;
      }

      .notification-tabs button {
        padding-inline: 6px;
      }

      .type-filter select {
        max-width: 90px;
        padding-inline: 5px;
      }
    }
  `,
})
export class NotificationCenterComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly firebaseMessaging = inject(FirebaseMessagingService);
  private readonly zone = inject(NgZone);
  private readonly realtime = inject(NotificationRealtimeService);
  private realtimeSubscription: Subscription | null = null;
  private unsubscribeFromMessages: Unsubscribe | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private liveMessageTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly knownNotificationIds = new Set<string>();
  private hasLoadedNotifications = false;
  private refreshInProgress = false;
  private destroyed = false;

  readonly notifications = signal<RegistrationNotification[]>([]);
  readonly isOpen = signal(false);
  readonly opened = output<void>();
  readonly filter = signal<'all' | 'unread' | 'read'>('all');
  readonly typeFilter = signal('all');
  readonly showAll = signal(false);
  readonly loading = signal(false);
  readonly enablingPush = signal(false);
  readonly errorMessage = signal('');
  readonly pushMessage = signal('');
  readonly liveMessage = signal<{ title: string; body: string } | null>(null);
  readonly pushConfigured = this.firebaseMessaging.isConfigured();
  readonly browserNotificationsSupported = typeof Notification !== 'undefined';
  readonly unreadCount = () =>
    this.notifications().filter((notification) => !notification.isRead).length;
  readonly readCount = () => this.notifications().length - this.unreadCount();
  readonly notificationTypes = () => [...new Set(this.notifications().map((item) => item.type))];
  readonly filteredNotifications = () =>
    this.notifications().filter((notification) => {
      const matchesReadState =
        this.filter() === 'all' ||
        (this.filter() === 'unread' && !notification.isRead) ||
        (this.filter() === 'read' && notification.isRead);
      return (
        matchesReadState && (this.typeFilter() === 'all' || notification.type === this.typeFilter())
      );
    });
  readonly visibleNotifications = () =>
    this.showAll() ? this.filteredNotifications() : this.filteredNotifications().slice(0, 5);

  setFilter(filter: 'all' | 'unread' | 'read'): void {
    this.filter.set(filter);
    this.showAll.set(false);
  }

  setTypeFilter(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    this.typeFilter.set(target.value);
    this.showAll.set(false);
  }

  toggleShowAll(): void {
    this.showAll.update((showAll) => !showAll);
  }

  typeLabel(type: string): string {
    return type.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  notificationKind(notification: RegistrationNotification): string {
    if (notification.type.includes('dispute') || notification.type.includes('resolution'))
      return 'dispute';
    if (notification.type.includes('quotation')) return 'quotation';
    if (notification.type.includes('repair')) return 'repair';
    if (notification.type.includes('account') || notification.type.includes('registration'))
      return 'account';
    return 'quotation';
  }

  notificationIcon(notification: RegistrationNotification): string {
    const kind = this.notificationKind(notification);
    if (kind === 'dispute') return '▢';
    if (kind === 'repair') return '⚒';
    if (kind === 'account') return '✓';
    return '▤';
  }

  ngOnInit(): void {
    this.refresh();
    this.realtime.connect();
    this.realtimeSubscription = this.realtime.notifications$.subscribe((notification) =>
      this.zone.run(() => this.receiveRealtimeNotification(notification)),
    );
    this.zone.runOutsideAngular(() => {
      this.refreshTimer = setInterval(() => {
        if (!document.hidden) {
          this.zone.run(() => this.refresh(true));
        }
      }, 5000);
    });
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    void this.firebaseMessaging
      .listen(() => this.refresh(true))
      .then((unsubscribe) => {
        if (this.destroyed) {
          unsubscribe?.();
        } else {
          this.unsubscribeFromMessages = unsubscribe;
        }
      })
      .catch((error: unknown) =>
        this.errorMessage.set(
          getAuthErrorMessage(error, 'Unable to start real-time notification listening.'),
        ),
      );
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.unsubscribeFromMessages?.();
    this.realtimeSubscription?.unsubscribe();
    this.realtime.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    if (this.liveMessageTimeout) {
      clearTimeout(this.liveMessageTimeout);
    }
  }

  toggle(): void {
    const opening = !this.isOpen();
    this.isOpen.set(opening);
    if (opening) {
      this.opened.emit();
      this.refresh();
    }
  }

  private readonly onVisibilityChange = (): void => {
    if (!document.hidden) {
      this.refresh(true);
    }
  };

  close(): void {
    this.isOpen.set(false);
  }

  private handleIncomingNotification(notification: RegistrationNotification): void {
    this.liveMessage.set({
      title: notification.title,
      body: notification.message,
    });
    if (this.liveMessageTimeout) {
      clearTimeout(this.liveMessageTimeout);
    }

    this.liveMessageTimeout = setTimeout(() => this.dismissLiveMessage(), 8000);

    const isRegistrationDecision =
      notification.type === 'registration_approved' ||
      notification.type === 'registration_declined';
    const isAccountStatusChange =
      notification.type === 'account_activated' ||
      notification.type === 'account_deactivated' ||
      notification.type === 'account_suspended';
    const isShop = notification.title.startsWith('Shop ');
    const approved = notification.type === 'registration_approved';
    const link =
      notification.link ??
      (approved
        ? isShop
          ? '/shop'
          : '/customer'
        : isShop
          ? '/shop/profile'
          : '/customer/profile');
    this.firebaseMessaging
      .showBrowserNotification(notification.title, notification.message, link)
      .catch((error: unknown) =>
        this.errorMessage.set(
          getAuthErrorMessage(error, 'Unable to display the browser notification.'),
        ),
      );

    if (!isRegistrationDecision && !isAccountStatusChange) {
      return;
    }

    this.auth.loadCurrentUser(true).subscribe({
      next: (user) => {
        const destination =
          user?.shopAuthorization?.destination ?? user?.customerAuthorization?.destination;
        const currentUrl = this.router.url;
        const shouldRouteToProfile =
          (destination === '/customer/profile' &&
            currentUrl.startsWith('/customer') &&
            !currentUrl.startsWith('/customer/profile')) ||
          (destination === '/shop/profile' &&
            currentUrl.startsWith('/shop') &&
            !currentUrl.startsWith('/shop/profile'));
        const shouldRouteToPortal =
          (destination === '/customer' && currentUrl.startsWith('/customer/profile')) ||
          (destination === '/shop' && currentUrl.startsWith('/shop/profile'));
        if (destination && (shouldRouteToProfile || shouldRouteToPortal)) {
          void this.router.navigateByUrl(destination);
        }
      },
      error: (error: unknown) =>
        this.errorMessage.set(getAuthErrorMessage(error, 'Unable to refresh your account status.')),
    });
  }

  private receiveRealtimeNotification(notification: RegistrationNotification): void {
    if (this.knownNotificationIds.has(notification.id)) {
      return;
    }
    this.knownNotificationIds.add(notification.id);
    this.notifications.update((items) => [notification, ...items].slice(0, 100));
    this.handleIncomingNotification(notification);
  }

  dismissLiveMessage(): void {
    this.liveMessage.set(null);
    if (this.liveMessageTimeout) {
      clearTimeout(this.liveMessageTimeout);
      this.liveMessageTimeout = null;
    }
  }

  refresh(checkForNew = false): void {
    this.loadNotifications(checkForNew);
  }

  private loadNotifications(checkForNew: boolean): void {
    if (this.refreshInProgress || this.destroyed) {
      return;
    }
    this.refreshInProgress = true;
    this.errorMessage.set('');
    if (!this.hasLoadedNotifications) {
      this.loading.set(true);
    }
    this.auth.getMyNotifications(checkForNew).subscribe({
      next: (notifications) => {
        if (checkForNew && this.hasLoadedNotifications) {
          for (const notification of notifications) {
            if (
              !this.knownNotificationIds.has(notification.id) &&
              notification.type !== 'new_registration'
            ) {
              this.handleIncomingNotification(notification);
            }
          }
        }
        notifications.forEach((notification) => this.knownNotificationIds.add(notification.id));
        this.hasLoadedNotifications = true;
        this.notifications.set(notifications);
      },
      error: (error: unknown) => {
        this.errorMessage.set(
          getAuthErrorMessage(error, 'Unable to load your notifications. Please try again.'),
        );
        this.refreshInProgress = false;
        this.loading.set(false);
      },
      complete: () => {
        this.refreshInProgress = false;
        this.loading.set(false);
      },
    });
  }

  async enablePush(): Promise<void> {
    if (this.enablingPush()) {
      return;
    }
    this.enablingPush.set(true);
    this.pushMessage.set('');
    this.errorMessage.set('');
    try {
      await this.firebaseMessaging.requestBrowserPermission();
      if (!this.pushConfigured) {
        this.pushMessage.set(
          'Browser alerts are enabled while the app is open. Firebase setup is required for alerts while it is closed.',
        );
        this.enablingPush.set(false);
        return;
      }
      const token = await this.firebaseMessaging.requestDeviceToken();
      this.auth.registerNotificationToken(token).subscribe({
        next: () => this.pushMessage.set('Browser notifications are enabled on this device.'),
        error: (error: unknown) =>
          this.errorMessage.set(
            getAuthErrorMessage(error, 'Unable to register this device for notifications.'),
          ),
        complete: () => this.enablingPush.set(false),
      });
    } catch (error) {
      this.errorMessage.set(getAuthErrorMessage(error, 'Unable to enable browser notifications.'));
      this.enablingPush.set(false);
    }
  }

  markRead(notification: RegistrationNotification): void {
    if (!notification.isRead) {
      this.auth.markNotificationRead(notification.id).subscribe({
        next: () =>
          this.notifications.update((items) =>
            items.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
          ),
        error: (error: unknown) =>
          this.errorMessage.set(
            getAuthErrorMessage(error, 'Unable to update this notification. Please try again.'),
          ),
      });
    }
    if (notification.link) {
      this.close();
      void this.router.navigateByUrl(notification.link);
    }
  }

  markAllRead(): void {
    this.auth.markAllNotificationsRead().subscribe({
      next: () =>
        this.notifications.update((items) => items.map((item) => ({ ...item, isRead: true }))),
      error: (error: unknown) =>
        this.errorMessage.set(
          getAuthErrorMessage(error, 'Unable to mark all notifications as read.'),
        ),
    });
  }
}
