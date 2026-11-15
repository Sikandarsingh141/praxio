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
    const duration = options.duration ?? DEFAULT_DURATIONS[type];
    const title = options.title.trim();
    const message = options.message?.trim();

    // Prevent duplicate notifications
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
