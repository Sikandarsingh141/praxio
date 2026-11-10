import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { ACCESS_TOKEN_COOKIE } from '../auth/constants';
import {
  ChatActor,
  ChatDeletedMessageResult,
  ChatMessageResult,
  ChatService,
} from './chat.service';

type ChatSocketData = {
  userId?: string;
  role?: 'customer' | 'shop';
};
type ChatSocket = Omit<Socket, 'data'> & { data: ChatSocketData };

@WebSocketGateway({
  namespace: '/chat',
  path: '/api/socket.io',
  cors: { origin: true, credentials: true },
})
export class ChatGateway implements OnGatewayInit, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  private server!: Namespace;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly chat: ChatService,
  ) {}

  afterInit(server: Namespace) {
    this.server = server;
    server.use((client, next) => {
      void this.authenticate(client as ChatSocket).then(
        () => next(),
        (error: unknown) => {
          this.logger.debug(
            `Rejected chat socket connection: ${error instanceof Error ? error.message : String(error)}`,
          );
          next(new Error('Unauthorized chat connection.'));
        },
      );
    });
  }

  handleDisconnect(client: ChatSocket) {
    const userId = client.data.userId;
    if (userId) {
      for (const room of client.rooms) {
        if (room.startsWith('chat:conversation:')) {
          client.to(room).emit('user_stopped_typing', { userId });
        }
      }
    }
  }

  @SubscribeMessage('join_conversation')
  async joinConversation(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: { conversationId?: unknown },
  ) {
    const actor = this.actor(client);
    const conversationId = this.string(body?.conversationId);
    await this.chat.getConversation(actor, conversationId);
    await client.join(this.conversationRoom(conversationId));
    client.emit('conversation_joined', { conversationId });
  }

  @SubscribeMessage('leave_conversation')
  async leaveConversation(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: { conversationId?: unknown },
  ) {
    await this.chat.getConversation(
      this.actor(client),
      this.string(body?.conversationId),
    );
    const conversationId = this.string(body?.conversationId);
    if (client.rooms.has(this.conversationRoom(conversationId))) {
      await client.leave(this.conversationRoom(conversationId));
    }
  }

  @SubscribeMessage('send_message')
  async sendMessage(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: Record<string, unknown>,
  ) {
    const actor = this.actor(client);
    const conversationId = this.string(body?.conversationId);
    const message = await this.chat.sendMessage(actor, conversationId, {
      content: typeof body.content === 'string' ? body.content : '',
      attachmentIds: this.stringArray(body.attachmentIds),
      repliedToMessageId:
        typeof body.repliedToMessageId === 'string'
          ? body.repliedToMessageId
          : undefined,
      clientMessageId:
        typeof body.clientMessageId === 'string'
          ? body.clientMessageId
          : undefined,
    });
    await this.broadcastNewMessage(actor, conversationId, message);
    client.emit('message_sent', message);
  }

  @SubscribeMessage('edit_message')
  async editMessage(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: Record<string, unknown>,
  ) {
    const actor = this.actor(client);
    const message = await this.chat.editMessage(
      actor,
      this.string(body.messageId),
      this.string(body.content),
    );
    this.broadcastMessageEdited(actor, message);
  }

  @SubscribeMessage('delete_message')
  async deleteMessage(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: Record<string, unknown>,
  ) {
    const result = await this.chat.deleteMessage(
      this.actor(client),
      this.string(body.messageId),
    );
    this.broadcastMessageDeleted(this.actor(client), result);
  }

  @SubscribeMessage('reply_message')
  async replyMessage(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: Record<string, unknown>,
  ) {
    const actor = this.actor(client);
    const conversationId = this.string(body.conversationId);
    const message = await this.chat.sendMessage(actor, conversationId, {
      content: typeof body.content === 'string' ? body.content : '',
      repliedToMessageId: this.string(body.repliedToMessageId),
      clientMessageId:
        typeof body.clientMessageId === 'string'
          ? body.clientMessageId
          : undefined,
    });
    await this.broadcastNewMessage(actor, conversationId, message);
  }

  @SubscribeMessage('mark_messages_read')
  async markRead(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: { conversationId?: unknown },
  ) {
    const actor = this.actor(client);
    const conversationId = this.string(body?.conversationId);
    const result = await this.chat.markRead(actor, conversationId);
    this.broadcastRead(actor, conversationId, result.readerId);
  }

  @SubscribeMessage('typing_start')
  async typingStart(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: { conversationId?: unknown },
  ) {
    const actor = this.actor(client);
    const conversationId = this.string(body?.conversationId);
    await this.chat.getConversation(actor, conversationId);
    client.to(this.conversationRoom(conversationId)).emit('user_typing', {
      userId: actor.userId,
      role: actor.role,
    });
  }

  @SubscribeMessage('typing_stop')
  async typingStop(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() body: { conversationId?: unknown },
  ) {
    const actor = this.actor(client);
    const conversationId = this.string(body?.conversationId);
    await this.chat.getConversation(actor, conversationId);
    client
      .to(this.conversationRoom(conversationId))
      .emit('user_stopped_typing', {
        userId: actor.userId,
      });
  }

  async broadcastNewMessage(
    actor: ChatActor,
    conversationId: string,
    message: unknown,
  ): Promise<void> {
    try {
      const conversation = await this.chat.getConversation(
        actor,
        conversationId,
      );
      const customerId = conversation.customerId.toString();
      const shopId = conversation.shopId.toString();
      const recipientId = actor.role === 'customer' ? shopId : customerId;
      const unreadCount =
        actor.role === 'customer'
          ? conversation.shopUnreadCount
          : conversation.customerUnreadCount;
      const preview = {
        conversationId,
        lastMessage: this.getMessagePreview(message),
        lastMessageAt: this.getMessageTimestamp(message),
      };

      for (const userId of new Set([customerId, shopId])) {
        const room = this.userRoom(userId);
        this.server.to(room).emit('new_message', message);
        this.server.to(room).emit('conversation_updated', preview);
      }
      this.server
        .to(this.userRoom(recipientId))
        .emit('unread_count_updated', { conversationId, unreadCount });

      const connectedSockets = await this.server
        .in(this.userRoom(recipientId))
        .fetchSockets();
      const messageId = this.getMessageId(message);
      if (!connectedSockets.length || !messageId) return;

      await this.chat.markDelivered(
        actor,
        conversationId,
        messageId,
        recipientId,
      );
      this.server.to(this.userRoom(customerId)).emit('message_delivered', {
        conversationId,
        messageId,
        recipientId,
      });
      this.server.to(this.userRoom(shopId)).emit('message_delivered', {
        conversationId,
        messageId,
        recipientId,
      });
    } catch (error) {
      this.logger.warn(
        `Could not broadcast chat message: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  broadcastMessageEdited(actor: ChatActor, message: ChatMessageResult) {
    void this.chat
      .getConversation(actor, message.conversationId)
      .then((conversation) => {
        this.server
          .to(this.conversationRoom(message.conversationId))
          .emit('message_edited', message);
        const preview = {
          conversationId: message.conversationId,
          lastMessage: conversation.lastMessage ?? '',
          lastMessageAt: conversation.lastMessageAt,
        };
        this.emitConversationUpdate(
          conversation.customerId.toString(),
          conversation.shopId.toString(),
          preview,
        );
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `Could not broadcast edited chat message: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
  }

  broadcastMessageDeleted(actor: ChatActor, message: ChatDeletedMessageResult) {
    void this.chat
      .getConversation(actor, message.conversationId)
      .then(() => {
        this.server
          .to(this.conversationRoom(message.conversationId))
          .emit('message_deleted', message);
        this.server
          .to(this.conversationRoom(message.conversationId))
          .emit('conversation_updated', {
            conversationId: message.conversationId,
            lastMessage: message.lastMessage,
            lastMessageAt: message.lastMessageAt,
          });
        void this.chat
          .getConversation(actor, message.conversationId)
          .then((conversation) =>
            this.emitConversationUpdate(
              conversation.customerId.toString(),
              conversation.shopId.toString(),
              {
                conversationId: message.conversationId,
                lastMessage: message.lastMessage,
                lastMessageAt: message.lastMessageAt,
              },
            ),
          );
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `Could not broadcast deleted chat message: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
  }

  broadcastRead(actor: ChatActor, conversationId: string, readerId: string) {
    void this.chat
      .getConversation(actor, conversationId)
      .then(() => {
        this.server
          .to(this.conversationRoom(conversationId))
          .emit('messages_read', { conversationId, readerId });
        this.server
          .to(this.conversationRoom(conversationId))
          .emit('message_read', { conversationId, readerId });
        this.server
          .to(this.userRoom(readerId))
          .emit('unread_count_updated', { conversationId, unreadCount: 0 });
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `Could not broadcast chat read status: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
  }

  private getMessageId(message: unknown): string | undefined {
    if (
      typeof message === 'object' &&
      message !== null &&
      'id' in message &&
      typeof message.id === 'string'
    ) {
      return message.id;
    }
    return undefined;
  }

  private getMessagePreview(message: unknown): string {
    if (typeof message !== 'object' || message === null) return 'New message';
    if ('isDeleted' in message && message.isDeleted === true) {
      return 'This message was deleted.';
    }
    if (
      'content' in message &&
      typeof message.content === 'string' &&
      message.content
    ) {
      return message.content.slice(0, 500);
    }
    if (
      'attachments' in message &&
      Array.isArray(message.attachments) &&
      message.attachments.length > 0
    ) {
      const attachment = message.attachments[0] as { fileName?: unknown };
      return typeof attachment.fileName === 'string'
        ? attachment.fileName
        : 'Attachment';
    }
    return 'Attachment';
  }

  private getMessageTimestamp(message: unknown): Date | undefined {
    if (
      typeof message === 'object' &&
      message !== null &&
      'createdAt' in message &&
      message.createdAt instanceof Date
    ) {
      return message.createdAt;
    }
    return undefined;
  }

  private emitConversationUpdate(
    customerId: string,
    shopId: string,
    update: Record<string, unknown>,
  ) {
    this.server
      .to(this.userRoom(customerId))
      .emit('conversation_updated', update);
    this.server.to(this.userRoom(shopId)).emit('conversation_updated', update);
  }

  private actor(client: ChatSocket): ChatActor {
    if (!client.data.userId || !client.data.role) {
      throw new WsException('Authenticated chat socket required.');
    }
    return { userId: client.data.userId, role: client.data.role };
  }

  private async authenticate(client: ChatSocket): Promise<void> {
    const origin = client.handshake.headers.origin;
    const allowed = this.config
      .getOrThrow<string>('FRONTEND_ORIGINS')
      .split(',')
      .map((item) => item.trim());
    const token = this.getAccessToken(client);
    if (!origin || !allowed.includes(origin) || !token) {
      throw new Error('Missing or disallowed chat connection credentials.');
    }

    const payload = await this.jwt.verifyAsync<{ sub?: unknown }>(token);
    if (typeof payload.sub !== 'string') {
      throw new Error('Invalid chat connection identity.');
    }
    const actor = await this.chat.actorForUser(payload.sub);
    client.data.userId = actor.userId;
    client.data.role = actor.role;
    await client.join(this.userRoom(actor.userId));
  }

  private getAccessToken(client: ChatSocket) {
    const cookieHeader = client.handshake.headers.cookie;
    const cookie = cookieHeader
      ?.split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${ACCESS_TOKEN_COOKIE}=`));
    return cookie
      ? decodeURIComponent(cookie.slice(ACCESS_TOKEN_COOKIE.length + 1))
      : undefined;
  }

  private string(value: unknown): string {
    if (typeof value !== 'string' || value.length > 200) {
      throw new WsException('Invalid chat event payload.');
    }
    return value;
  }

  private stringArray(value: unknown): string[] {
    if (value === undefined) return [];
    if (
      !Array.isArray(value) ||
      value.length > 5 ||
      value.some((item) => typeof item !== 'string')
    ) {
      throw new WsException('Invalid attachment payload.');
    }
    const values: unknown[] = value;
    return values.map((item) => {
      if (typeof item !== 'string') {
        throw new WsException('Invalid attachment payload.');
      }
      return item;
    });
  }

  private userRoom(userId: string) {
    return `chat:user:${userId}`;
  }

  private conversationRoom(conversationId: string) {
    return `chat:conversation:${conversationId}`;
  }
}
