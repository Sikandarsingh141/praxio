import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, isObjectIdOrHexString, Model, Types } from 'mongoose';
import {
  LocationCoordinates,
  ShopDetails,
  User,
  UserDocument,
} from './schemas/user.schema';

export interface RegistrationAccount {
  email: string;
  passwordHash: string;
  fullName?: string;
  profileImageData?: string;
  countryCode?: string;
  mobileNumber?: string;
  location?: LocationCoordinates;
  accountType: Extract<User['accountType'], 'customer' | 'shop'>;
  accountStatus: Extract<User['accountStatus'], 'active' | 'pending_approval'>;
  accountLifecycleStatus?: Extract<
    User['accountLifecycleStatus'],
    'active' | 'inactive' | 'suspended'
  >;
  shopDetails?: ShopDetails;
  notificationToken?: string;
}

export type ShopApprovalStatus = 'active' | 'rejected';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly users: Model<User>,
  ) {}

  async create(email: string, passwordHash: string): Promise<UserDocument> {
    return this.users.create({
      email: this.normalizeEmail(email),
      passwordHash,
    });
  }

  async createRegistrationAccount(
    account: RegistrationAccount,
    session?: ClientSession,
  ): Promise<UserDocument> {
    const { notificationToken, ...accountDetails } = account;
    const user = {
      ...accountDetails,
      email: this.normalizeEmail(account.email),
      accountLifecycleStatus:
        account.accountLifecycleStatus ??
        (account.accountStatus === 'active' ? 'active' : 'inactive'),
      ...(notificationToken ? { notificationTokens: [notificationToken] } : {}),
    };
    if (!session) {
      return this.users.create(user);
    }

    const [createdUser] = await this.users.create([user], { session });
    if (!createdUser) {
      throw new Error('User creation did not return a document');
    }
    return createdUser;
  }

  async findByEmailForAuthentication(
    email: string,
  ): Promise<UserDocument | null> {
    return this.users
      .findOne({ email: this.normalizeEmail(email) })
      .select('+passwordHash')
      .exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    if (!isObjectIdOrHexString(id)) {
      return null;
    }
    return this.users.findById(id).exec();
  }

  async updateProfile(
    id: string,
    updates: { fullName?: string; profileImageData?: string },
  ): Promise<UserDocument> {
    if (!isObjectIdOrHexString(id)) {
      throw new NotFoundException('User account was not found');
    }

    const user = await this.users
      .findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true },
      )
      .exec();
    if (!user) {
      throw new NotFoundException('User account was not found');
    }
    return user;
  }

  async updateShopImage(id: string, shopImageData: string): Promise<UserDocument> {
    if (!isObjectIdOrHexString(id)) {
      throw new NotFoundException('Shop account was not found');
    }

    const user = await this.users
      .findOneAndUpdate(
        { _id: id, accountType: 'shop' },
        { $set: { 'shopDetails.shopImageData': shopImageData } },
        { new: true, runValidators: true },
      )
      .exec();
    if (!user) {
      throw new NotFoundException('Shop account was not found');
    }
    return user;
  }

  async findPendingShopAccounts(): Promise<UserDocument[]> {
    return this.users
      .find({ accountType: 'shop', accountStatus: 'pending_approval' })
      .sort({ createdAt: 1 })
      .exec();
  }

  async findActiveAdminIds(session?: ClientSession): Promise<string[]> {
    const query = this.users
      .find({
        accountType: 'admin',
        accountStatus: 'active',
        $or: [
          { accountLifecycleStatus: 'active' },
          { accountLifecycleStatus: { $exists: false } },
        ],
      })
      .select('_id');
    if (session) {
      query.session(session);
    }
    const admins = await query.lean().exec();
    return admins.map((admin) => admin._id.toString());
  }

  async registerNotificationToken(
    userId: string,
    token: string,
  ): Promise<void> {
    if (!isObjectIdOrHexString(userId)) {
      return;
    }

    const result = await this.users
      .updateOne(
        { _id: new Types.ObjectId(userId) },
        { $addToSet: { notificationTokens: token } },
      )
      .exec();
    if (result.matchedCount !== 1) {
      throw new NotFoundException('Authenticated user account was not found');
    }
  }

  async getNotificationTokens(
    userIds: Types.ObjectId[],
  ): Promise<Array<{ userId: string; token: string }>> {
    if (!userIds.length) {
      return [];
    }

    const users = await this.users
      .find({ _id: { $in: userIds } })
      .select('_id +notificationTokens')
      .lean()
      .exec();
    return users.flatMap((user) =>
      (user.notificationTokens ?? []).map((token) => ({
        userId: user._id.toString(),
        token,
      })),
    );
  }

  async removeNotificationTokens(tokens: string[]): Promise<void> {
    if (tokens.length) {
      await this.users
        .updateMany(
          { notificationTokens: { $in: tokens } },
          { $pull: { notificationTokens: { $in: tokens } } },
        )
        .exec();
    }
  }

  async removeNotificationTokensForUser(
    userId: string,
    token: string,
  ): Promise<void> {
    if (!isObjectIdOrHexString(userId)) {
      return;
    }

    await this.users
      .updateOne(
        { _id: new Types.ObjectId(userId) },
        { $pull: { notificationTokens: token } },
      )
      .exec();
  }

  async updateRegistrationAccountStatus(
    id: string,
    accountType: 'customer' | 'shop',
    accountStatus: 'active' | 'rejected',
    session: ClientSession,
  ): Promise<boolean> {
    if (!isObjectIdOrHexString(id)) {
      return false;
    }

    const result = await this.users
      .updateOne(
        {
          _id: new Types.ObjectId(id),
          accountType,
          accountStatus: { $in: ['pending_approval', 'active', 'rejected'] },
        },
        {
          $set: {
            accountStatus,
            accountLifecycleStatus:
              accountStatus === 'active' ? 'active' : 'inactive',
          },
        },
        { runValidators: true, session },
      )
      .exec();
    return result.matchedCount === 1;
  }

  async updatePendingShopStatus(
    id: string,
    accountStatus: ShopApprovalStatus,
    session?: ClientSession,
  ): Promise<UserDocument | null> {
    if (!isObjectIdOrHexString(id)) {
      return null;
    }

    return this.users
      .findOneAndUpdate(
        { _id: id, accountType: 'shop', accountStatus: 'pending_approval' },
        {
          $set: {
            accountStatus,
            accountLifecycleStatus: 'inactive',
          },
        },
        { new: true, runValidators: true, ...(session ? { session } : {}) },
      )
      .exec();
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
