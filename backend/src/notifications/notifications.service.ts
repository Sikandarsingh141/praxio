import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { UsersService } from '../users/users.service';
import { FirebaseMessagingService } from './firebase-messaging.service';
import { Notification } from './schemas/notification.schema';
import { NOTIFICATION_TYPES } from './schemas/notification.schema';
import { NOTIFICATION_ENTITY_TYPES } from './schemas/notification.schema';
import { NotificationsGateway } from './notifications.gateway';

export interface RegistrationNotification {
  id: string;
  title: string;
  message: string;
  type: (typeof NOTIFICATION_TYPES)[number];
  isRead: boolean;
  createdAt: Date;
  relatedEntityId?: string;
  relatedEntityType?: (typeof NOTIFICATION_ENTITY_TYPES)[number];
  link?: string;
}

export interface CreateUserNotification {
  title: string;
  message: string;
  type: (typeof NOTIFICATION_TYPES)[number];
  relatedEntityId: Types.ObjectId;
  relatedEntityType: (typeof NOTIFICATION_ENTITY_TYPES)[number];
  link: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notifications: Model<Notification>,
    private readonly usersService: UsersService,
    private readonly firebaseMessaging: FirebaseMessagingService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async notifyAdminsOfRegistration(
    adminIds: string[],
    registrationRequestId: Types.ObjectId,
    accountType: 'customer' | 'shop',
    applicantName: string,
    session: ClientSession,
  ): Promise<void> {
    const accountLabel = accountType === 'shop' ? 'Shop' : 'Customer';
    const subject =
      accountType === 'shop'
        ? applicantName
        : applicantName || 'A new customer';
    await this.notifications.insertMany(
      adminIds.map((recipientId) => ({
        recipientId: new Types.ObjectId(recipientId),
        title: `New ${accountLabel} Registration`,
        message: `${subject} has submitted a registration request. Please review the application.`,
        type: 'new_registration' as const,
        relatedEntityId: registrationRequestId,
        relatedEntityType: 'registration_request' as const,
        isRead: false,
      })),
      { session },
    );
  }

  async notifyShopOfRegistrationDecision(
    recipientId: Types.ObjectId,
    registrationRequestId: Types.ObjectId,
    decision: 'approved' | 'declined',
    declineReason: string | undefined,
    session: ClientSession,
  ): Promise<void> {
    const approved = decision === 'approved';
    await this.notifications.create(
      [
        {
          recipientId,
          title: approved
            ? 'Shop Registration Approved!'
            : 'Shop Registration Declined',
          message: approved
            ? 'Congratulations! Your Shop registration has been approved. You now have full access to the Reparo Shop Portal.'
            : `Your Shop registration was declined. Reason: ${declineReason ?? 'Please contact support for more information.'}`,
          type: approved ? 'registration_approved' : 'registration_declined',
          relatedEntityId: registrationRequestId,
          relatedEntityType: 'registration_request',
          isRead: false,
        },
      ],
      { session },
    );
  }

  async notifyApplicantOfRegistrationDecision(
    recipientId: Types.ObjectId,
    registrationRequestId: Types.ObjectId,
    accountType: 'customer' | 'shop',
    decision: 'approved' | 'declined',
    declineReason: string | undefined,
    session: ClientSession,
  ): Promise<void> {
    if (accountType === 'shop') {
      await this.notifyShopOfRegistrationDecision(
        recipientId,
        registrationRequestId,
        decision,
        declineReason,
        session,
      );
      return;
    }

    const approved = decision === 'approved';
    await this.notifications.create(
      [
        {
          recipientId,
          title: approved
            ? 'Customer Registration Approved!'
            : 'Customer Registration Declined',
          message: approved
            ? 'Your Customer registration has been approved. You can now access your Reparo account.'
            : `Your Customer registration was declined. Reason: ${declineReason ?? 'Please contact support for more information.'}`,
          type: approved ? 'registration_approved' : 'registration_declined',
          relatedEntityId: registrationRequestId,
          relatedEntityType: 'registration_request',
          isRead: false,
        },
      ],
      { session },
    );
  }

  async getForUser(userId: string): Promise<RegistrationNotification[]> {
    if (!Types.ObjectId.isValid(userId)) {
      return [];
    }

    const notifications = await this.notifications
      .find({
        recipientId: new Types.ObjectId(userId),
      })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .exec();
    return notifications.map((notification) => ({
      id: notification._id.toString(),
      title: notification.title,
      message: notification.message,
      type: notification.type,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      relatedEntityId: notification.relatedEntityId.toString(),
      relatedEntityType: notification.relatedEntityType,
      link: notification.link,
    }));
  }

  async notifyUsers(
    recipientIds: Types.ObjectId[],
    notification: CreateUserNotification,
  ): Promise<void> {
    const uniqueRecipients = [
      ...new Map(
        recipientIds.map((recipient) => [recipient.toString(), recipient]),
      ).values(),
    ];
    if (!uniqueRecipients.length) {
      return;
    }

    const savedNotifications = await this.notifications.insertMany(
      uniqueRecipients.map((recipientId) => ({
        recipientId,
        ...notification,
        isRead: false,
      })),
    );
    savedNotifications.forEach((savedNotification) => {
      this.gateway.notifyUser(savedNotification.recipientId.toString(), {
        id: savedNotification._id.toString(),
        title: savedNotification.title,
        message: savedNotification.message,
        type: savedNotification.type,
        isRead: savedNotification.isRead,
        createdAt: savedNotification.createdAt,
        relatedEntityId: savedNotification.relatedEntityId.toString(),
        relatedEntityType: savedNotification.relatedEntityType,
        link: savedNotification.link,
      });
    });

    try {
      const registeredTokens =
        await this.usersService.getNotificationTokens(uniqueRecipients);
      const invalidTokens = await this.firebaseMessaging.send(
        registeredTokens.map(({ token }) => token),
        notification.title,
        notification.message,
        {
          type: notification.type,
          entityId: notification.relatedEntityId.toString(),
          link: notification.link,
        },
      );
      await this.usersService.removeNotificationTokens(invalidTokens);
    } catch (error) {
      this.logger.error(
        `Could not dispatch Firebase notification for ${notification.relatedEntityType} ${notification.relatedEntityId.toString()}.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    if (
      !Types.ObjectId.isValid(userId) ||
      !Types.ObjectId.isValid(notificationId)
    ) {
      throw new NotFoundException('Notification not found');
    }

    const result = await this.notifications
      .updateOne(
        {
          _id: new Types.ObjectId(notificationId),
          recipientId: new Types.ObjectId(userId),
          isRead: false,
        },
        { $set: { isRead: true } },
      )
      .exec();
    if (result.matchedCount !== 1) {
      throw new NotFoundException('Notification not found');
    }
  }

  async markAllRead(userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundException('Notification recipient not found');
    }
    await this.notifications
      .updateMany(
        { recipientId: new Types.ObjectId(userId), isRead: false },
        { $set: { isRead: true } },
      )
      .exec();
  }

  async registerDeviceToken(userId: string, token: string): Promise<void> {
    await this.usersService.registerNotificationToken(userId, token);
  }

  async removeDeviceToken(userId: string, token: string): Promise<void> {
    await this.usersService.removeNotificationTokensForUser(userId, token);
  }

  async sendToUsers(
    recipientIds: Types.ObjectId[],
    title: string,
    message: string,
    type: RegistrationNotification['type'],
    registrationRequestId: Types.ObjectId,
    link = '/auth/login',
  ): Promise<void> {
    try {
      const registeredTokens =
        await this.usersService.getNotificationTokens(recipientIds);
      const invalidTokens = await this.firebaseMessaging.send(
        registeredTokens.map(({ token }) => token),
        title,
        message,
        {
          type,
          registrationRequestId: registrationRequestId.toString(),
          link,
        },
      );
      await this.usersService.removeNotificationTokens(invalidTokens);
    } catch (error) {
      this.logger.error(
        `Could not dispatch Firebase notification for registration ${registrationRequestId.toString()}.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async sendRegistrationDecision(
    recipientId: Types.ObjectId,
    registrationRequestId: Types.ObjectId,
    accountType: 'customer' | 'shop',
    decision: 'approved' | 'declined',
    declineReason?: string,
  ): Promise<void> {
    const approved = decision === 'approved';
    const accountLabel = accountType === 'shop' ? 'Shop' : 'Customer';
    const title = approved
      ? `${accountLabel} Registration Approved!`
      : `${accountLabel} Registration Declined`;

    await this.sendToUsers(
      [recipientId],
      title,
      approved
        ? accountType === 'shop'
          ? 'Congratulations! Your Shop registration has been approved. You now have full access to the Reparo Shop Portal.'
          : 'Your Customer registration has been approved. You can now access your Reparo account.'
        : `Your ${accountLabel} registration was declined.${declineReason ? ` Reason: ${declineReason}` : ''} Sign in to view details and support instructions.`,
      approved ? 'registration_approved' : 'registration_declined',
      registrationRequestId,
      approved
        ? accountType === 'shop'
          ? '/shop'
          : '/customer'
        : accountType === 'shop'
          ? '/shop/profile'
          : '/customer/profile',
    );
  }
}
