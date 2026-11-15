export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  type?: ToastType;
  title: string;
  message?: string;
  duration?: number;
  dismissible?: boolean;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration: number;
  remainingTime: number;
  progressPercent: number;
  paused: boolean;
  closing?: boolean;
  createdAt: number;
}
