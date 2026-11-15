import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastService } from './toast.service';
import { ToastItem } from './toast.models';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="toast-container"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="toast-card"
          [class]="'toast-' + toast.type"
          [class.toast-message-card]="!!toast.messageData"
          [class.closing]="toast.closing"
          [class.clickable]="!!toast.messageData || !!toast.onClick"
          (mouseenter)="toastService.pause(toast.id)"
          (mouseleave)="toastService.resume(toast.id)"
          (click)="onCardClick(toast)"
          role="alert"
        >
          @if (toast.messageData; as msg) {
            <!-- Premium Real-Time Message Notification Layout -->
            <div class="msg-card-inner">
              <!-- Header Row -->
              <div class="msg-header-row">
                <div class="msg-header-left">
                  <div class="msg-badge-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                  </div>
                  <h4 class="msg-header-title">New Message</h4>
                </div>

                <div class="msg-header-right">
                  <span class="msg-relative-time">{{ msg.relativeTime || 'Just now' }}</span>
                  <button
                    type="button"
                    class="toast-close-btn"
                    (click)="onClose($event, toast.id)"
                    aria-label="Close notification"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Main Content Row -->
              <div class="msg-body-row">
                <!-- Avatar -->
                <div class="msg-avatar-wrap" aria-hidden="true">
                  @if (msg.senderPhoto) {
                    <img
                      class="msg-avatar-img"
                      [src]="msg.senderPhoto"
                      [alt]="msg.senderName"
                      (error)="msg.senderPhoto = null"
                    />
                  } @else if (msg.senderInitials) {
                    <div class="msg-avatar-fallback">{{ msg.senderInitials }}</div>
                  } @else {
                    <div class="msg-avatar-icon">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                      </svg>
                    </div>
                  }
                  @if (msg.isOnline === true) {
                    <span class="msg-online-indicator" aria-label="Online"></span>
                  }
                </div>

                <!-- Message Details -->
                <div class="msg-content-col">
                  <div class="msg-sender-name">{{ msg.senderName }}</div>

                  @if (msg.repairItem || msg.requestId) {
                    <div class="msg-meta-line">
                      <span>
                        {{ msg.repairItem }}{{ msg.repairItem && msg.requestId ? ' · Request ' : '' }}{{ msg.requestId }}
                      </span>
                    </div>
                  }

                  <p class="msg-preview-text">{{ msg.content }}</p>

                  <div class="msg-sub-meta">
                    <span class="msg-unread-pill">
                      {{ msg.unreadCount || 1 }} new {{ (msg.unreadCount || 1) > 1 ? 'messages' : 'message' }}
                    </span>
                    @if (msg.time) {
                      <span class="msg-timestamp">{{ msg.time }}</span>
                    }
                  </div>
                </div>
              </div>

              <!-- Action Footer -->
              <div class="msg-action-footer">
                <!-- <button
                  type="button"
                  class="msg-view-btn"
                  (click)="onViewConversation($event, toast)"
                >
                  <span>View Conversation</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                </button> -->
              </div>
            </div>
          } @else {
            <!-- Standard Notification Layout -->
            <div class="toast-body">
              @if (toast.avatar) {
                <div class="toast-avatar-wrap" [attr.aria-hidden]="true">
                  @if (toast.avatar.imageUrl) {
                    <img
                      class="toast-avatar-img"
                      [src]="toast.avatar.imageUrl"
                      [alt]="toast.avatar.name || 'User'"
                      (error)="toast.avatar.imageUrl = null"
                    />
                  } @else {
                    <div class="toast-avatar-fallback">{{ toast.avatar.initials || 'U' }}</div>
                  }
                  @if (toast.avatar.isOnline !== false) {
                    <span class="online-indicator" aria-label="Online"></span>
                  }
                </div>
              } @else {
                <!-- Icon -->
                <div class="toast-icon-wrap" [attr.aria-hidden]="true">
                  @switch (toast.type) {
                    @case ('success') {
                      <svg class="toast-icon icon-success" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" fill="#16a34a" stroke="none" />
                        <path d="m8 12 3 3 5-6" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    }
                    @case ('error') {
                      <svg class="toast-icon icon-error" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" fill="#dc2626" stroke="none" />
                        <path d="M12 8v5M12 16.5h.01" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    }
                    @case ('warning') {
                      <svg class="toast-icon icon-warning" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" fill="#ea580c" stroke="none" />
                        <path d="M12 8v5M12 16.5h.01" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    }
                    @case ('info') {
                      <svg class="toast-icon icon-info" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" fill="#2563eb" stroke="none" />
                        <path d="M12 11v6M12 7.5h.01" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    }
                  }
                </div>
              }

              <!-- Content -->
              <div class="toast-content">
                <h4 class="toast-title">{{ toast.title }}</h4>
                @if (toast.message) {
                  <p class="toast-message">{{ toast.message }}</p>
                }
              </div>

              <!-- Close Button -->
              <button
                type="button"
                class="toast-close-btn"
                (click)="onClose($event, toast.id)"
                aria-label="Close notification"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          }

          <!-- Progress Bar -->
          <div class="toast-progress-track">
            <div
              class="toast-progress-bar"
              [style.width.%]="toast.progressPercent"
            ></div>
          </div>
        </div>
      }
    </div>
  `,
  styleUrls: ['./toast-container.component.scss'],
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  onClose(event: MouseEvent, id: string): void {
    event.stopPropagation();
    this.toastService.dismiss(id);
  }

  onCardClick(toast: ToastItem): void {
    if (toast.messageData?.destinationUrl) {
      this.toastService.dismiss(toast.id);
      if (toast.onClick) toast.onClick();
      void this.router.navigateByUrl(toast.messageData.destinationUrl);
    } else if (toast.onClick) {
      this.toastService.dismiss(toast.id);
      toast.onClick();
    }
  }

  onViewConversation(event: MouseEvent, toast: ToastItem): void {
    event.stopPropagation();
    this.onCardClick(toast);
  }
}
