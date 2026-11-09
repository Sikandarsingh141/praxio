import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { ACCESS_TOKEN_COOKIE } from '../auth/constants';

interface NotificationTokenPayload {
  sub?: unknown;
  email?: unknown;
}

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const origin = client.handshake.headers.origin;
      const allowedOrigins = this.config
        .getOrThrow<string>('FRONTEND_ORIGINS')
        .split(',')
        .map((value) => value.trim());
      if (!origin || !allowedOrigins.includes(origin)) {
        client.disconnect(true);
        return;
      }
      const token = this.getAccessToken(client);
      if (!token) {
        client.disconnect(true);
        return;
      }
      const payload =
        await this.jwt.verifyAsync<NotificationTokenPayload>(token);
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string'
      ) {
        client.disconnect(true);
        return;
      }
      await client.join(this.userRoom(payload.sub));
    } catch (error) {
      this.logger.debug(
        `Rejected unauthenticated notification socket: ${error instanceof Error ? error.message : String(error)}`,
      );
      client.disconnect(true);
    }
  }

  notifyUser(userId: string, notification: Record<string, unknown>): void {
    this.server
      .to(this.userRoom(userId))
      .emit('notification:new', notification);
  }

  private getAccessToken(client: Socket): string | undefined {
    const cookieHeader = client.handshake.headers.cookie;
    if (!cookieHeader) {
      return undefined;
    }
    const cookie = cookieHeader
      .split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith(`${ACCESS_TOKEN_COOKIE}=`));
    if (!cookie) {
      return undefined;
    }
    const token = cookie.slice(ACCESS_TOKEN_COOKIE.length + 1);
    return token ? decodeURIComponent(token) : undefined;
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }
}
