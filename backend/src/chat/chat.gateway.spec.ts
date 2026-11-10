import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server } from 'socket.io';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

describe('ChatGateway', () => {
  const customerId = 'customer-1';
  const shopId = 'shop-1';
  const conversationId = 'conversation-1';
  const actor = { userId: customerId, role: 'customer' as const };
  const message = {
    id: 'message-1',
    conversationId,
    senderId: customerId,
    content: 'Hello',
    attachments: [],
    createdAt: new Date(),
  };
  let gateway: ChatGateway;
  let chat: {
    getConversation: jest.Mock;
    getPresencePeerIds: jest.Mock;
    markDelivered: jest.Mock;
  };
  let emissions: Array<{ room: string; event: string; payload: unknown }>;

  beforeEach(() => {
    emissions = [];
    chat = {
      getConversation: jest.fn().mockResolvedValue({
        customerId: { toString: () => customerId },
        shopId: { toString: () => shopId },
        customerUnreadCount: 0,
        shopUnreadCount: 1,
      }),
      getPresencePeerIds: jest.fn().mockResolvedValue([shopId]),
      markDelivered: jest.fn().mockResolvedValue(undefined),
    };
    gateway = new ChatGateway(
      {} as JwtService,
      {} as ConfigService,
      chat as unknown as ChatService,
    );
    const server = {
      to: jest.fn((room: string) => ({
        emit: (event: string, payload: unknown) =>
          emissions.push({ room, event, payload }),
      })),
      in: jest.fn(() => ({
        fetchSockets: jest.fn().mockResolvedValue([{ id: 'recipient-socket' }]),
      })),
    };
    (gateway as unknown as { server: Server }).server =
      server as unknown as Server;
  });

  it('sends persisted messages to both participants without requiring a conversation room join', async () => {
    await gateway.broadcastNewMessage(actor, conversationId, message);

    expect(emissions).toContainEqual({
      room: `chat:user:${customerId}`,
      event: 'new_message',
      payload: message,
    });
    expect(emissions).toContainEqual({
      room: `chat:user:${shopId}`,
      event: 'new_message',
      payload: message,
    });
    expect(emissions).not.toContainEqual(
      expect.objectContaining({
        event: 'new_message',
        room: `chat:conversation:${conversationId}`,
      }),
    );
    expect(chat.markDelivered).toHaveBeenCalledWith(
      actor,
      conversationId,
      message.id,
      shopId,
    );
  });

  it('broadcasts to both user rooms even when the recipient has no connected sockets', async () => {
    const gatewayServer = (gateway as unknown as { server: Server }).server;
    jest.spyOn(gatewayServer, 'in').mockReturnValue({
      fetchSockets: jest.fn().mockResolvedValue([]),
    } as never);

    await gateway.broadcastNewMessage(actor, conversationId, message);

    expect(
      emissions.filter((item) => item.event === 'new_message'),
    ).toHaveLength(2);
    expect(chat.markDelivered).not.toHaveBeenCalled();
  });

  it('broadcasts online presence only to private conversation peers', async () => {
    gateway.handleConnection({
      data: { userId: customerId, role: 'customer' },
    } as never);
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(chat.getPresencePeerIds).toHaveBeenCalledWith(customerId);
    expect(emissions).toContainEqual({
      room: `chat:user:${shopId}`,
      event: 'user_online',
      payload: { userId: customerId, isOnline: true },
    });
  });
});
