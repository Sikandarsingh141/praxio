export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastAvatar {
  imageUrl?: string | null;
  name?: string;
  initials?: string;
  isOnline?: boolean;
}

export interface ToastMessageData {
  conversationId: string;
  messageId?: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string | null;
  senderInitials?: string;
  isOnline?: boolean;
  repairItem?: string;
  requestId?: string;
  content: string;
  time?: string;
  relativeTime?: string;
  unreadCount?: number;
  destinationUrl?: string;
}

export interface ToastOptions {
  type?: ToastType;
  title: string;
  message?: string;
  duration?: number;
  dismissible?: boolean;
  avatar?: ToastAvatar;
  messageData?: ToastMessageData;
  onClick?: () => void;
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
  avatar?: ToastAvatar;
  messageData?: ToastMessageData;
  onClick?: () => void;
}
