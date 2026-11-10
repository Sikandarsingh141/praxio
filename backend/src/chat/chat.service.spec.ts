import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Connection, Model, Types } from 'mongoose';
import { RepairRequest } from '../customer/repair-request.schema';
import { RegistrationService } from '../registrations/registration.service';
import { User } from '../users/schemas/user.schema';
import { ChatService } from './chat.service';
import { ChatConversation, ChatMessage } from './schemas/chat.schema';

describe('ChatService', () => {
  const customerId = new Types.ObjectId();
  const shopId = new Types.ObjectId();
  const requestId = new Types.ObjectId();
  const conversationId = new Types.ObjectId();

  let users: {
    findById: jest.Mock;
    find: jest.Mock;
  };
  let repairRequests: {
    findById: jest.Mock;
    find: jest.Mock;
  };
  let conversations: {
    findById: jest.Mock;
    find: jest.Mock;
    countDocuments: jest.Mock;
    aggregate: jest.Mock;
  };
  let messages: {
    find: jest.Mock;
    aggregate: jest.Mock;
  };
  let service: ChatService;

  beforeEach(() => {
    users = { findById: jest.fn(), find: jest.fn() };
    repairRequests = { findById: jest.fn(), find: jest.fn() };
    conversations = {
      findById: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      aggregate: jest.fn(),
    };
    messages = { find: jest.fn(), aggregate: jest.fn() };
    service = new ChatService(
      {} as Connection,
      conversations as unknown as Model<ChatConversation>,
      messages as unknown as Model<ChatMessage>,
      repairRequests as unknown as Model<RepairRequest>,
      users as unknown as Model<User>,
      {
        findShopRequestForUser: jest.fn(),
      } as unknown as RegistrationService,
    );
  });

  it('derives the chat role from the active database user', async () => {
    const query = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({
        accountType: 'customer',
        accountStatus: 'active',
        accountLifecycleStatus: 'active',
      }),
    };
    users.findById.mockReturnValue(query);

    await expect(service.actorForUser(customerId.toString())).resolves.toEqual({
      userId: customerId.toString(),
      role: 'customer',
    });
  });

  it('rejects inactive and non-chat account types', async () => {
    const query = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({
        accountType: 'admin',
        accountStatus: 'active',
        accountLifecycleStatus: 'active',
      }),
    };
    users.findById.mockReturnValue(query);

    await expect(
      service.actorForUser(customerId.toString()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not allow a customer to start a conversation for another customer request', async () => {
    const query = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({
        customerId: new Types.ObjectId(),
        shopIds: [shopId],
      }),
    };
    repairRequests.findById.mockReturnValue(query);

    await expect(
      service.createOrGetConversation(
        { userId: customerId.toString(), role: 'customer' },
        requestId.toString(),
        shopId.toString(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects non-participants from conversation history', async () => {
    conversations.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: conversationId,
        participants: [customerId, shopId],
      }),
    });

    await expect(
      service.getConversation(
        { userId: new Types.ObjectId().toString(), role: 'customer' },
        conversationId.toString(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('validates conversation pagination boundaries', async () => {
    await expect(
      service.listConversations(
        { userId: customerId.toString(), role: 'customer' },
        'all',
        '',
        0,
        25,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('searches conversations by the short repair request ID', async () => {
    const query = {
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    users.find.mockReturnValue(query);
    repairRequests.find.mockReturnValue(query);
    conversations.find.mockReturnValue(query);
    conversations.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });
    messages.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });

    await service.listConversations(
      { userId: customerId.toString(), role: 'customer' },
      'all',
      'PRX-CEEBA068',
      1,
      25,
    );

    expect(repairRequests.find).toHaveBeenCalledWith({
      $or: [
        { appliance: /PRX-CEEBA068/i },
        {
          $expr: {
            $regexMatch: {
              input: { $toString: '$_id' },
              regex: 'CEEBA068$',
              options: 'i',
            },
          },
        },
      ],
    });
  });

  it('returns the total unread message count for the actor role', async () => {
    conversations.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([{ total: 3 }]),
    });

    await expect(
      service.getUnreadMessageCount({
        userId: customerId.toString(),
        role: 'customer',
      }),
    ).resolves.toBe(3);

    expect(conversations.aggregate).toHaveBeenCalledWith([
      { $match: { participants: customerId } },
      { $group: { _id: null, total: { $sum: '$customerUnreadCount' } } },
    ]);
  });

  it('loads at most 20 messages with a stable timestamp and id cursor', async () => {
    conversations.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        participants: [customerId, shopId],
      }),
    });
    const query = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    messages.find.mockReturnValue(query);

    const cursor = new Date('2025-01-01T00:00:00.000Z');
    const cursorId = new Types.ObjectId();
    await expect(
      service.getMessages(
        { userId: customerId.toString(), role: 'customer' },
        conversationId.toString(),
        cursor.toISOString(),
        cursorId.toString(),
      ),
    ).resolves.toEqual({ messages: [], hasMore: false });

    expect(messages.find).toHaveBeenCalledWith({
      conversationId,
      $or: [
        { createdAt: { $lt: cursor } },
        { createdAt: cursor, _id: { $lt: cursorId } },
      ],
    });
    expect(query.limit).toHaveBeenCalledWith(21);
  });

  it('searches only messages in conversations the actor belongs to and escapes search syntax', async () => {
    conversations.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        participants: [customerId, shopId],
      }),
    });
    const query = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    messages.find.mockReturnValue(query);

    await expect(
      service.searchMessages(
        { userId: customerId.toString(), role: 'customer' },
        conversationId.toString(),
        'repair.*',
        1,
      ),
    ).resolves.toEqual({ messages: [], page: 1, hasMore: false });

    expect(messages.find).toHaveBeenCalledWith({
      conversationId,
      isDeleted: false,
      content: { $regex: 'repair\\.\\*', $options: 'i' },
    });
    expect(query.limit).toHaveBeenCalledWith(21);
  });

  it('returns only private conversation peers for presence updates', async () => {
    const otherShopId = new Types.ObjectId();
    conversations.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        { customerId, shopId },
        { customerId, shopId: otherShopId },
      ]),
    });

    const peers = await service.getPresencePeerIds(customerId.toString());

    expect(peers).toEqual([shopId.toString(), otherShopId.toString()]);
  });
});
