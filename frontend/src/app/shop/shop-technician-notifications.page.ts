import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../environments/environment';
import { ApiEnvelope, RegistrationNotification } from '../core/auth/auth.models';
import { AuthService } from '../core/auth/auth.service';
import { NotificationRealtimeService } from '../core/notifications/notification-realtime.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-shop-technician-notifications-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="notifications-page">
      <header class="page-heading">
        <div>
          <p class="eyebrow">TECHNICIAN ALERTS</p>
          <h1>Notifications</h1>
          <p>Stay updated about job assignments, customer decisions, and repair progress.</p>
        </div>
        <div class="heading-actions">
          @if (unreadCount() > 0) {
            <button class="mark-all-btn" type="button" (click)="markAllRead()">
              ✓ Mark all as read
            </button>
          }
        </div>
      </header>

      @if (error()) {
        <p class="message error" role="alert">{{ error() }}</p>
      }

      <div class="filter-tabs">
        <button
          type="button"
          [class.active]="filter() === 'all'"
          (click)="filter.set('all')"
        >
          All Notifications <span>{{ notifications().length }}</span>
        </button>
        <button
          type="button"
          [class.active]="filter() === 'unread'"
          (click)="filter.set('unread')"
        >
          Unread <span>{{ unreadCount() }}</span>
        </button>
      </div>

      @if (loading()) {
        <div class="state-card" role="status">Loading your notifications…</div>
      } @else if (filteredNotifications().length) {
        <div class="notifications-list">
          @for (item of filteredNotifications(); track item.id) {
            <article class="notification-card" [class.unread]="!item.isRead">
              <div class="notif-icon" [attr.data-type]="item.type" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  @switch (item.type + '') {
                    @case ('technician_assignment') {
                      <rect x="3" y="6" width="18" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="2" />
                      <path d="M8 6V4h8v2M3 11h18" fill="none" stroke="currentColor" stroke-width="2" />
                    }
                    @case ('repair_started') {
                      <path d="m8 5 11 7-11 7z" fill="currentColor" />
                    }
                    @case ('repair_marked_complete') {
                      <path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" stroke-width="2.5" />
                    }
                    @default {
                      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" fill="none" stroke="currentColor" stroke-width="2" />
                    }
                  }
                </svg>
              </div>

              <div class="notif-body">
                <div class="notif-header">
                  <strong>{{ item.title }}</strong>
                  <time [attr.datetime]="item.createdAt">{{ item.createdAt | date: 'medium' }}</time>
                </div>
                <p>{{ item.message }}</p>
                <div class="notif-actions">
                  @if (getNavigationLink(item); as navigationLink) {
                    <a class="view-link" [routerLink]="navigationLink" (click)="markRead(item)">
                      View details →
                    </a>
                  }
                  @if (!item.isRead) {
                    <button class="text-button" type="button" (click)="markRead(item)">
                      Mark as read
                    </button>
                  }
                </div>
              </div>
            </article>
          }
        </div>
      } @else {
        <div class="state-card empty-state">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" fill="none" stroke="currentColor" stroke-width="1.8" />
          </svg>
          <strong>No notifications to show</strong>
          <p>{{ filter() === 'unread' ? 'You have read all your notifications.' : 'New job assignments and activity alerts will appear here.' }}</p>
        </div>
      }
    </section>
  `,
  styles: `
    :host { display: block; color: #17271d; }
    .notifications-page { display: grid; gap: 1.15rem; max-width: 860px; margin: 0 auto; }
    .page-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .page-heading h1 { margin: 0; font-size: clamp(1.45rem, 2vw, 1.85rem); font-weight: 800; color: #111827; }
    .page-heading p:not(.eyebrow) { margin: 0.25rem 0 0; color: #68766d; font-size: 0.85rem; }
    .eyebrow { margin: 0 0 0.2rem; color: #087c3b; font-size: 0.65rem; font-weight: 800; letter-spacing: 0.12em; }
    .mark-all-btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.55rem 0.95rem; border: 1px solid #dfe6e1; border-radius: 0.6rem; background: #fff; color: #087c3b; cursor: pointer; font: inherit; font-size: 0.75rem; font-weight: 700; transition: all 0.15s ease; &:hover { background: #eef7f0; border-color: #087c3b; } }
    .filter-tabs { display: flex; gap: 0.4rem; border-bottom: 1px solid #e5ebe6; padding-bottom: 0.6rem; }
    .filter-tabs button { display: flex; align-items: center; gap: 0.45rem; padding: 0.45rem 0.85rem; border: 0; border-radius: 0.5rem; background: transparent; color: #55665b; cursor: pointer; font: inherit; font-size: 0.76rem; font-weight: 700; }
    .filter-tabs button span { padding: 0.15rem 0.42rem; border-radius: 99px; background: #f0f3f1; color: #455249; font-size: 0.62rem; }
    .filter-tabs button.active { background: #e7f6ea; color: #077937; }
    .filter-tabs button.active span { background: #087c3b; color: #fff; }
    .notifications-list { display: grid; gap: 0.65rem; }
    .notification-card { display: flex; align-items: flex-start; gap: 0.9rem; padding: 1rem; border: 1px solid #e5ece6; border-radius: 0.8rem; background: #fff; box-shadow: 0 1px 4px rgba(20,40,28,0.03); transition: border-color 0.15s ease; }
    .notification-card.unread { border-left: 4px solid #087c3b; background: #fbfdfb; }
    .notif-icon { display: grid; width: 2.35rem; height: 2.35rem; flex-shrink: 0; place-items: center; border-radius: 0.65rem; background: #eaf6ec; color: #087c3b; svg { width: 1.25rem; height: 1.25rem; } }
    .notif-icon[data-type='repair_marked_complete'] { background: #e6f6ea; color: #087c3b; }
    .notif-body { flex: 1 1 auto; min-width: 0; }
    .notif-header { display: flex; align-items: baseline; justify-content: space-between; gap: 0.8rem; margin-bottom: 0.25rem; strong { color: #17271d; font-size: 0.82rem; } time { color: #88968d; font-size: 0.68rem; flex-shrink: 0; } }
    .notif-body p { margin: 0; color: #546459; font-size: 0.76rem; line-height: 1.5; }
    .notif-actions { display: flex; align-items: center; gap: 1rem; margin-top: 0.6rem; }
    .view-link { color: #087c3b; font-size: 0.72rem; font-weight: 750; text-decoration: none; &:hover { text-decoration: underline; } }
    .text-button { border: 0; background: transparent; color: #728377; cursor: pointer; font: inherit; font-size: 0.7rem; padding: 0; &:hover { color: #17271d; text-decoration: underline; } }
    .state-card { padding: 2.5rem; text-align: center; border: 1px solid #e5ebe6; border-radius: 0.8rem; background: #fff; color: #627267; }
    .empty-state { display: grid; place-items: center; gap: 0.45rem; svg { width: 2.5rem; height: 2.5rem; color: #9bb0a2; stroke-width: 1.5; margin-bottom: 0.25rem; } strong { color: #17271d; font-size: 0.92rem; } p { margin: 0; font-size: 0.78rem; } }
    .message.error { padding: 0.7rem 0.9rem; border-radius: 0.55rem; border: 1px solid #f2cfcb; background: #fff5f4; color: #9c3b33; font-size: 0.78rem; }
  `,
})
export class ShopTechnicianNotificationsPage implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(NotificationRealtimeService);
  private realtimeSubscription?: Subscription;

  readonly notifications = signal<RegistrationNotification[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly filter = signal<'all' | 'unread'>('all');

  readonly unreadCount = () =>
    this.notifications().filter((item) => !item.isRead).length;

  readonly filteredNotifications = () => {
    if (this.filter() === 'unread') {
      return this.notifications().filter((item) => !item.isRead);
    }
    return this.notifications();
  };

  ngOnInit(): void {
    this.load();
    this.realtimeSubscription = this.realtime.notifications$.subscribe((notification) => {
      const notifications = [
        notification,
        ...this.notifications().filter((item) => item.id !== notification.id),
      ].slice(0, 100);
      this.setNotifications(notifications);
    });
  }

  ngOnDestroy(): void {
    this.realtimeSubscription?.unsubscribe();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.http
      .get<ApiEnvelope<{ notifications: RegistrationNotification[] }>>(
        `${environment.apiBaseUrl}/notifications/my`,
      )
      .subscribe({
        next: (response) => {
          const currentIds = new Set(this.notifications().map((item) => item.id));
          const notifications = [
            ...this.notifications(),
            ...(response.data.notifications || []).filter((item) => !currentIds.has(item.id)),
          ].slice(0, 100);
          this.setNotifications(notifications);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Could not load notifications. Please try again.');
          this.loading.set(false);
        },
      });
  }

  markRead(notification: RegistrationNotification): void {
    if (!notification.isRead) {
      this.auth.markNotificationRead(notification.id).subscribe({
        next: () => {
          this.setNotifications(
            this.notifications().map((item) =>
              item.id === notification.id ? { ...item, isRead: true } : item,
            ),
          );
        },
        error: () => this.error.set('Could not update the notification. Please try again.'),
      });
    }
  }

  markAllRead(): void {
    this.auth.markAllNotificationsRead().subscribe({
      next: () => {
        this.setNotifications(
          this.notifications().map((item) => ({ ...item, isRead: true })),
        );
      },
      error: () => this.error.set('Could not mark notifications as read. Please try again.'),
    });
  }

  getNavigationLink(notification: RegistrationNotification): string[] | null {
    if (notification.relatedEntityType === 'repair_request' && notification.relatedEntityId) {
      return ['/technician/jobs', notification.relatedEntityId];
    }
    if (!notification.link) return null;
    return [notification.link];
  }

  private setNotifications(notifications: RegistrationNotification[]): void {
    this.notifications.set(notifications);
    this.realtime.publishUnreadCount(
      notifications.filter((notification) => !notification.isRead).length,
    );
  }
}
