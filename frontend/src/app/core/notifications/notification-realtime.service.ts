import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RegistrationNotification } from '../auth/auth.models';

@Injectable({ providedIn: 'root' })
export class NotificationRealtimeService {
  private socket: Socket | null = null;
  private readonly incoming = new Subject<RegistrationNotification>();
  private readonly unreadCount = new BehaviorSubject(0);
  readonly notifications$ = this.incoming.asObservable();
  readonly unreadCount$ = this.unreadCount.asObservable();

  publishUnreadCount(count: number): void {
    this.unreadCount.next(count);
  }

  connect(): void {
    if (this.socket) {
      return;
    }
    const apiOrigin = new URL(environment.apiBaseUrl, globalThis.location.origin).origin;
    let token: string | null = null;
    try {
      token = sessionStorage.getItem('fixora_access_token') || localStorage.getItem('fixora_access_token');
    } catch {
      // storage restricted
    }
    this.socket = io(`${apiOrigin}/notifications`, {
      withCredentials: true,
      auth: token ? { token } : undefined,
      transports: ['websocket', 'polling'],
    });
    this.socket.on('notification:new', (notification: RegistrationNotification) =>
      this.publishNotification(notification),
    );
  }

  publishNotification(notification: RegistrationNotification): void {
    this.incoming.next(notification);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}
