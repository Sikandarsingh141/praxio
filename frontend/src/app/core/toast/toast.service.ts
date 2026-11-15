import { Injectable, NgZone, inject, signal } from '@angular/core';
import { ToastItem, ToastOptions, ToastType } from './toast.models';

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 5000,
  info: 5000,
  warning: 7000,
  error: 8000,
};

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly ngZone = inject(NgZone);
  private readonly _toasts = signal<ToastItem[]>([]);
  readonly toasts = this._toasts.asReadonly();

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastTick = Date.now();
  private idCounter = 0;

  show(options: ToastOptions): string {
    const type: ToastType = options.type || 'info';
    const duration = options.duration ?? (options.messageData ? 9000 : DEFAULT_DURATIONS[type]);
    const title = options.title.trim();
    const message = options.message?.trim();

    // Group incoming messages from the same conversation
    if (options.messageData?.conversationId) {
      const existingMessageToast = this._toasts().find(
        (t) =>
          !t.closing &&
          t.messageData?.conversationId === options.messageData?.conversationId,
      );

      if (existingMessageToast) {
        const nextUnreadCount = (existingMessageToast.messageData?.unreadCount ?? 1) + 1;
        this._toasts.update((items) =>
          items.map((t) =>
            t.id === existingMessageToast.id
              ? {
                  ...t,
                  message,
                  remainingTime: duration,
                  progressPercent: 100,
                  paused: false,
                  onClick: options.onClick ?? t.onClick,
                  messageData: {
                    ...options.messageData!,
                    unreadCount: nextUnreadCount,
                  },
                }
              : t,
          ),
        );
        this.ensureTimerRunning();
        return existingMessageToast.id;
      }
    }

    // Prevent duplicate non-message notifications
    const existing = this._toasts().find(
      (t) => !t.closing && t.type === type && t.title === title && (t.message || '') === (message || '')
    );

    if (existing) {
      // Refresh duration of existing toast rather than stacking duplicate
      this._toasts.update((items) =>
        items.map((t) =>
          t.id === existing.id
            ? { ...t, remainingTime: duration, progressPercent: 100, paused: false }
            : t
        )
      );
      this.ensureTimerRunning();
      return existing.id;
    }

    const id = `toast-${++this.idCounter}-${Date.now()}`;
    const newToast: ToastItem = {
      id,
      type,
      title,
      message,
      duration,
      remainingTime: duration,
      progressPercent: 100,
      paused: false,
      closing: false,
      createdAt: Date.now(),
      avatar: options.avatar,
      messageData: options.messageData,
      onClick: options.onClick,
    };

    this._toasts.update((items) => [...items, newToast]);
    this.ensureTimerRunning();
    return id;
  }

  success(title: string, message?: string, options?: Partial<ToastOptions>): string {
    return this.show({ ...options, type: 'success', title, message });
  }

  error(title: string, message?: string, options?: Partial<ToastOptions>): string {
    return this.show({ ...options, type: 'error', title, message });
  }

  warning(title: string, message?: string, options?: Partial<ToastOptions>): string {
    return this.show({ ...options, type: 'warning', title, message });
  }

  info(title: string, message?: string, options?: Partial<ToastOptions>): string {
    return this.show({ ...options, type: 'info', title, message });
  }

  showRealtimeMessage(data: {
    conversationId: string;
    messageId?: string;
    senderId: string;
    senderName: string;
    senderPhoto?: string | null;
    isOnline?: boolean;
    repairItem?: string;
    requestId?: string;
    content: string;
    time?: string;
    relativeTime?: string;
    destinationUrl: string;
    onClick?: () => void;
  }): string {
    const rawName = (data.senderName || 'User').trim();
    const initials =
      rawName
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('') || rawName.slice(0, 1).toUpperCase();

    return this.show({
      type: 'info',
      title: 'New Message',
      message: `${rawName}: ${data.content}`,
      duration: 9000,
      avatar: {
        imageUrl: data.senderPhoto,
        name: rawName,
        initials,
        isOnline: data.isOnline,
      },
      messageData: {
        conversationId: data.conversationId,
        messageId: data.messageId,
        senderId: data.senderId,
        senderName: rawName,
        senderPhoto: data.senderPhoto,
        senderInitials: initials,
        isOnline: data.isOnline,
        repairItem: data.repairItem || 'Repair Request',
        requestId: data.requestId || '',
        content: data.content,
        time:
          data.time ||
          new Intl.DateTimeFormat(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          }).format(new Date()),
        relativeTime: data.relativeTime || 'Just now',
        unreadCount: 1,
        destinationUrl: data.destinationUrl,
      },
      onClick: data.onClick,
    });
  }

  dismiss(id: string): void {
    const toast = this._toasts().find((t) => t.id === id);
    if (!toast || toast.closing) return;

    // Trigger smooth exit animation
    this._toasts.update((items) =>
      items.map((t) => (t.id === id ? { ...t, closing: true } : t))
    );

    setTimeout(() => {
      this._toasts.update((items) => items.filter((t) => t.id !== id));
      if (this._toasts().length === 0) {
        this.stopTimer();
      }
    }, 280);
  }

  clear(): void {
    this._toasts.set([]);
    this.stopTimer();
  }

  pause(id: string): void {
    this._toasts.update((items) =>
      items.map((t) => (t.id === id ? { ...t, paused: true } : t))
    );
  }

  resume(id: string): void {
    this._toasts.update((items) =>
      items.map((t) => (t.id === id ? { ...t, paused: false } : t))
    );
    this.ensureTimerRunning();
  }

  private ensureTimerRunning(): void {
    if (this.intervalId !== null) return;
    this.lastTick = Date.now();

    this.ngZone.runOutsideAngular(() => {
      this.intervalId = setInterval(() => {
        const now = Date.now();
        const delta = now - this.lastTick;
        this.lastTick = now;

        const currentToasts = this._toasts();
        if (currentToasts.length === 0) {
          this.stopTimer();
          return;
        }

        let hasChanges = false;
        const expiredIds: string[] = [];

        const updated = currentToasts.map((toast) => {
          if (toast.paused || toast.closing) {
            return toast;
          }
          const remaining = Math.max(0, toast.remainingTime - delta);
          const percent = toast.duration > 0 ? (remaining / toast.duration) * 100 : 0;
          hasChanges = true;

          if (remaining <= 0) {
            expiredIds.push(toast.id);
          }

          return {
            ...toast,
            remainingTime: remaining,
            progressPercent: Math.max(0, Math.min(100, percent)),
          };
        });

        if (hasChanges) {
          this.ngZone.run(() => {
            this._toasts.set(updated);
            expiredIds.forEach((id) => this.dismiss(id));
          });
        }
      }, 50);
    });
  }

  private stopTimer(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
