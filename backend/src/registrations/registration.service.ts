import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'node:crypto';
import { Connection, Model, Types } from 'mongoose';
import { NotificationsService } from '../notifications/notifications.service';
import { UserDocument } from '../users/schemas/user.schema';
import { RegistrationAccount, UsersService } from '../users/users.service';
import {
  RegistrationRequest,
  RegistrationRequestDocument,
} from './schemas/registration-request.schema';

export interface RegistrationSubmission {
  user: UserDocument;
  registrationRequest: {
    id: string;
    registrationNumber: string;
    registrationStatus: 'pending';
    submittedAt: Date;
  };
}

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    @InjectModel(RegistrationRequest.name)
    private readonly registrationRequests: Model<RegistrationRequest>,
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  async submit(account: RegistrationAccount): Promise<RegistrationSubmission> {
    const session = await this.connection.startSession();
    let createdUser: UserDocument | undefined;
    let registrationRequest: RegistrationRequestDocument | undefined;
    let adminIds: string[] = [];

    try {
      await session.withTransaction(async () => {
        const admins = await this.usersService.findActiveAdminIds(session);
        adminIds = admins;

        createdUser = await this.usersService.createRegistrationAccount(
          { ...account, accountStatus: 'pending_approval' },
          session,
        );
        const [createdRequest] = await this.registrationRequests.create(
          [
            {
              userId: createdUser._id,
              accountType: account.accountType,
              registrationNumber: this.createRegistrationNumber(),
              registrationStatus: 'pending',
              paymentStatus:
                account.accountType === 'shop' ? 'unpaid' : 'not_required',
              submittedAt: new Date(),
            },
          ],
          { session },
        );
        if (!createdRequest) {
          throw new Error(
            'Registration request creation did not return a document',
          );
        }
        registrationRequest = createdRequest;

        if (admins.length > 0) {
          await this.notificationsService.notifyAdminsOfRegistration(
            admins,
            createdRequest._id,
            account.accountType,
            account.shopDetails?.shopName ??
              account.fullName ??
              'A new customer',
            session,
          );
        } else {
          this.logger.warn(
            `Registration ${createdRequest.registrationNumber} was saved without Admin notifications because no active Admin accounts exist.`,
          );
        }
      });
    } finally {
      await session.endSession();
    }

    if (!createdUser || !registrationRequest) {
      throw new Error('Registration transaction completed without its records');
    }

    if (adminIds.length > 0) {
      const accountLabel = account.accountType === 'shop' ? 'Shop' : 'Customer';
      const applicantName =
        account.accountType === 'shop'
          ? account.shopDetails?.shopName
          : account.fullName;
      const subject = applicantName || 'A new customer';
      await this.notificationsService.sendToUsers(
        adminIds.map((id) => new Types.ObjectId(id)),
        `New ${accountLabel} Registration`,
        `${subject} has submitted a registration request. Please review the application.`,
        'new_registration',
        registrationRequest._id,
      );
    }

    return {
      user: createdUser,
      registrationRequest: {
        id: registrationRequest._id.toString(),
        registrationNumber: registrationRequest.registrationNumber,
        registrationStatus: 'pending',
        submittedAt: registrationRequest.submittedAt,
      },
    };
  }

  async findShopRequestForUser(
    userId: string,
  ): Promise<RegistrationRequestDocument | null> {
    return this.findRequestForUser(userId, 'shop');
  }

  async findRequestForUser(
    userId: string,
    accountType: 'customer' | 'shop',
  ): Promise<RegistrationRequestDocument | null> {
    if (!Types.ObjectId.isValid(userId)) {
      return null;
    }

    return this.registrationRequests
      .findOne({
        userId: new Types.ObjectId(userId),
        accountType,
      })
      .exec();
  }

  async ensureShopRequestForUser(
    user: UserDocument,
  ): Promise<RegistrationRequestDocument> {
    if (
      user.accountType !== 'shop' ||
      user.accountStatus !== 'pending_approval'
    ) {
      throw new ServiceUnavailableException(
        'This account is not an eligible pending Shop registration.',
      );
    }

    const existing = await this.registrationRequests
      .findOne({ userId: user._id, accountType: 'shop' })
      .exec();
    if (existing) {
      return existing;
    }
    if (!hasCompleteShopRegistrationData(user)) {
      throw new ServiceUnavailableException(
        'This pending shop account is missing required registration details. Please contact support to complete your application.',
      );
    }
    const shopName = user.shopDetails.shopName;

    const session = await this.connection.startSession();
    let registrationRequest: RegistrationRequestDocument | undefined;
    let adminIds: string[] = [];
    try {
      await session.withTransaction(async () => {
        const admins = await this.usersService.findActiveAdminIds(session);
        adminIds = admins;

        const [createdRequest] = await this.registrationRequests.create(
          [
            {
              userId: user._id,
              accountType: 'shop',
              registrationNumber: this.createRegistrationNumber(),
              registrationStatus: 'pending',
              paymentStatus: 'unpaid',
              submittedAt: new Date(),
            },
          ],
          { session },
        );
        if (!createdRequest) {
          throw new Error(
            'Registration request recovery did not return a document',
          );
        }
        registrationRequest = createdRequest;
        if (admins.length > 0) {
          await this.notificationsService.notifyAdminsOfRegistration(
            admins,
            createdRequest._id,
            'shop',
            shopName,
            session,
          );
        } else {
          this.logger.warn(
            `Recovered Shop registration ${createdRequest.registrationNumber} was saved without Admin notifications because no active Admin accounts exist.`,
          );
        }
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const concurrentlyCreated = await this.registrationRequests
          .findOne({ userId: user._id, accountType: 'shop' })
          .exec();
        if (concurrentlyCreated) {
          return concurrentlyCreated;
        }
      }
      throw error;
    } finally {
      await session.endSession();
    }

    if (!registrationRequest) {
      throw new Error('Registration recovery completed without its record');
    }
    if (adminIds.length > 0) {
      await this.notificationsService.sendToUsers(
        adminIds.map((id) => new Types.ObjectId(id)),
        'New Shop Registration',
        `${shopName} has submitted a registration request. Please review the application.`,
        'new_registration',
        registrationRequest._id,
      );
    }
    return registrationRequest;
  }

  private createRegistrationNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `PRX-${date}-${randomBytes(6).toString('hex').toUpperCase()}`;
  }
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}

function hasCompleteShopRegistrationData(
  user: UserDocument,
): user is UserDocument & {
  shopDetails: NonNullable<UserDocument['shopDetails']>;
} {
  const details = user.shopDetails;
  const requiredText = [
    user.fullName,
    user.email,
    user.countryCode,
    user.mobileNumber,
    details?.shopName,
    details?.businessType,
    details?.description,
    details?.address,
    details?.city,
    details?.state,
    details?.postalCode,
  ];
  return (
    requiredText.every(
      (value) => typeof value === 'string' && value.trim().length > 0,
    ) &&
    typeof details?.yearsOfExperience === 'number' &&
    Number.isFinite(details.yearsOfExperience) &&
    Array.isArray(details.services) &&
    details.services.length > 0
  );
}
