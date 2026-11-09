import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RegistrationNotification } from '../auth/auth.models';

@Injectable({ providedIn: 'root' })
export class NotificationRealtimeService {
  private socket: Socket | null = null;
  private readonly incoming = new Subject<RegistrationNotification>();
  readonly notifications$ = this.incoming.asObservable();

  connect(): void {
    if (this.socket) {
      return;
    }
    const apiOrigin = new URL(environment.apiBaseUrl, globalThis.location.origin).origin;
    this.socket = io(`${apiOrigin}/notifications`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    this.socket.on('notification:new', (notification: RegistrationNotification) => {
      this.incoming.next(notification);
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}
