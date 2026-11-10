import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { ClientSession, Types } from 'mongoose';
import { NotificationsService } from './notifications.service';
import { FirebaseMessagingService } from './firebase-messaging.service';
import { Notification } from './schemas/notification.schema';
import { UsersService } from '../users/users.service';
import { NotificationsGateway } from './notifications.gateway';
import { RepairRequest } from '../customer/repair-request.schema';

describe('NotificationsService', () => {
  let service: NotificationsService;
  const notifications = {
    insertMany: jest.fn().mockResolvedValue([]),
    find: jest.fn(),
    updateOne: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn().mockResolvedValue([]),
  };
  const repairRequests = {
    find: jest.fn(),
  };
  const usersService = {
    getNotificationTokens: jest.fn().mockResolvedValue([]),
    removeNotificationTokens: jest.fn().mockResolvedValue(undefined),
    registerNotificationToken: jest.fn().mockResolvedValue(undefined),
  };
  const firebaseMessaging = {
    send: jest.fn().mockResolvedValue([]),
  };
  const session = {} as ClientSession;
  const registrationRequestId = new Types.ObjectId();
  const adminId = new Types.ObjectId().toString();

  beforeEach(async () => {
    jest.clearAllMocks();
    usersService.getNotificationTokens.mockResolvedValue([]);
    firebaseMessaging.send.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getModelToken(Notification.name),
          useValue: notifications,
        },
        {
          provide: getModelToken(RepairRequest.name),
          useValue: repairRequests,
        },
        { provide: UsersService, useValue: usersService },
        { provide: FirebaseMessagingService, useValue: firebaseMessaging },
        { provide: NotificationsGateway, useValue: { notifyUser: jest.fn() } },
      ],
    }).compile();
    service = module.get<NotificationsService>(NotificationsService);
  });

  it('creates an unread Admin notification linked to the registration request', async () => {
    await service.notifyAdminsOfRegistration(
      [adminId],
      registrationRequestId,
      'shop',
      'Fixroa Repairs',
      session,
    );

    expect(notifications.insertMany).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          recipientId: new Types.ObjectId(adminId),
          title: 'New Shop Registration',
          message:
            'Fixroa Repairs has submitted a registration request. Please review the application.',
          type: 'new_registration',
          relatedEntityId: registrationRequestId,
          relatedEntityType: 'registration_request',
          isRead: false,
        }),
      ],
      { session },
    );
  });

  it('marks a notification read only for its recipient', async () => {
    const recipientId = new Types.ObjectId().toString();
    const notificationId = new Types.ObjectId().toString();
    notifications.updateOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ matchedCount: 1 }),
    });

    await service.markRead(recipientId, notificationId);

    expect(notifications.updateOne).toHaveBeenCalledWith(
      {
        _id: new Types.ObjectId(notificationId),
        recipientId: new Types.ObjectId(recipientId),
        isRead: false,
      },
      { $set: { isRead: true } },
    );
  });

  it('marks all unread notifications read for the authenticated recipient', async () => {
    const recipientId = new Types.ObjectId().toString();
    notifications.updateMany.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 2 }),
    });

    await service.markAllRead(recipientId);

    expect(notifications.updateMany).toHaveBeenCalledWith(
      { recipientId: new Types.ObjectId(recipientId), isRead: false },
      { $set: { isRead: true } },
    );
  });

  it('rejects attempts to mark another user notification as read', async () => {
    notifications.updateOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ matchedCount: 0 }),
    });

    await expect(
      service.markRead(
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('creates a decision notification for Customer registrations', async () => {
    const userId = new Types.ObjectId();

    await service.notifyApplicantOfRegistrationDecision(
      userId,
      registrationRequestId,
      'customer',
      'declined',
      'Incomplete details',
      session,
    );

    expect(notifications.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          recipientId: userId,
          title: 'Customer Registration Declined',
          message:
            'Your Customer registration was declined. Reason: Incomplete details',
          type: 'registration_declined',
          relatedEntityId: registrationRequestId,
          isRead: false,
        }),
      ],
      { session },
    );
  });

  it('sends a decline push with its reason and restricted-profile destination', async () => {
    const recipientId = new Types.ObjectId();
    usersService.getNotificationTokens.mockResolvedValue([
      { token: 'browser-token' },
    ]);

    await service.sendRegistrationDecision(
      recipientId,
      registrationRequestId,
      'customer',
      'declined',
      'Incomplete details',
    );

    expect(firebaseMessaging.send).toHaveBeenCalledWith(
      ['browser-token'],
      'Customer Registration Declined',
      expect.stringContaining('Reason: Incomplete details'),
      {
        type: 'registration_declined',
        registrationRequestId: registrationRequestId.toString(),
        link: '/customer/profile',
      },
    );
  });

  it('adds the short repair request ID to all portal and push notifications', async () => {
    const requestId = new Types.ObjectId('507f1f77bcf86cd7CEEBA068');
    const recipientId = new Types.ObjectId();

    await service.notifyUsers([recipientId], {
      title: 'New Repair Request Received',
      message: `A customer submitted a repair request. Request ID: ${requestId.toString()}.`,
      type: 'new_repair_request',
      relatedEntityId: requestId,
      relatedEntityType: 'repair_request',
      link: `/shop/repair-requests/${requestId.toString()}`,
    });

    expect(notifications.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        relatedEntityId: requestId,
        message: 'A customer submitted a repair request. Request ID: CEEBA068.',
      }),
    ]);
    expect(firebaseMessaging.send).toHaveBeenCalledWith(
      [],
      'New Repair Request Received',
      'A customer submitted a repair request. Request ID: CEEBA068.',
      expect.objectContaining({
        entityId: requestId.toString(),
      }),
    );
  });

  it('displays the short ID on older repair notifications as well', async () => {
    const requestId = new Types.ObjectId('507f1f77bcf86cd7CEEBA068');
    const recipientId = new Types.ObjectId();
    const oldNotification = {
      _id: new Types.ObjectId(),
      title: 'Repair update',
      message: `Repair request updated. Request ID: ${requestId.toString()}.`,
      type: 'new_repair_request',
      isRead: true,
      createdAt: new Date('2026-11-10T00:00:00.000Z'),
      relatedEntityId: requestId,
      relatedEntityType: 'repair_request',
      link: `/customer/repair-requests/${requestId.toString()}`,
    };
    const notificationQuery = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([oldNotification]),
    };
    const repairRequestQuery = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([{ _id: requestId }]),
    };
    notifications.find.mockReturnValue(notificationQuery);
    repairRequests.find.mockReturnValue(repairRequestQuery);

    await expect(service.getForUser(recipientId.toString())).resolves.toEqual([
      expect.objectContaining({
        message: 'Repair request updated. Request ID: CEEBA068.',
        relatedEntityId: requestId.toString(),
      }),
    ]);
  });
});
