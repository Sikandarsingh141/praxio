import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { RegisterShopDto } from './dto/register-shop.dto';
import { UsersService } from '../users/users.service';
import {
  LocationCoordinates,
  UserDocument,
} from '../users/schemas/user.schema';
import { ACCESS_TOKEN_EXPIRES_IN } from './constants';
import {
  RegistrationService,
  RegistrationSubmission,
} from '../registrations/registration.service';
import {
  ShopPaymentStatus,
  StripePaymentsService,
} from '../payments/stripe-payments.service';

export interface SafeUser {
  id: string;
  email: string;
  createdAt: Date;
  accountType: 'customer' | 'shop' | 'admin';
  accountStatus: 'active' | 'pending_approval' | 'rejected';
  accountLifecycleStatus: 'active' | 'inactive' | 'suspended';
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  countryCode?: string;
  mobileNumber?: string;
  location?: LocationCoordinates;
  shopAuthorization?: ShopAuthorization;
  customerAuthorization?: CustomerAuthorization;
}

export interface CustomerAuthorization {
  registrationStatus: 'pending' | 'approved' | 'declined' | 'not_found';
  accountStatus: 'active' | 'pending_approval' | 'rejected';
  accountLifecycleStatus: 'active' | 'inactive' | 'suspended';
  destination: '/customer/profile' | '/customer';
  submittedAt: Date | null;
  reviewedAt: Date | null;
  declineReason: string | null;
}

export interface ShopAuthorization {
  registrationStatus: 'pending' | 'approved' | 'declined' | 'not_found';
  paymentStatus: 'not_required' | 'unpaid' | 'paid';
  accountStatus: 'active' | 'pending_approval' | 'rejected';
  accountLifecycleStatus: 'active' | 'inactive' | 'suspended';
  destination: '/shop/payment' | '/shop/profile' | '/shop';
  submittedAt: Date | null;
  reviewedAt: Date | null;
  declineReason: string | null;
}

export interface LoginResult {
  accessToken: string;
  user: SafeUser;
  redirectTo: string;
}

export interface ShopProfile {
  shopName: string;
  shopImageData?: string;
  businessType: string;
  description: string;
  yearsOfExperience: number;
  ownerFirstName: string;
  ownerLastName: string;
  email: string;
  countryCode: string;
  mobileNumber: string;
  address: string;
  street?: string;
  area?: string;
  city: string;
  state: string;
  country?: string;
  postalCode: string;
  landmark: string;
  location?: LocationCoordinates;
  businessAddress: string;
  services: string[];
  subscriptionPlan: 'Fixroa Shop monthly subscription';
  subscriptionAmountCents: number;
  subscriptionCurrency: 'usd';
  paymentStatus: ShopAuthorization['paymentStatus'];
  registrationStatus: ShopAuthorization['registrationStatus'];
  accountLifecycleStatus: ShopAuthorization['accountLifecycleStatus'];
  submittedAt: Date | null;
  adminApprovalStatus: 'pending' | 'approved' | 'declined' | 'not_submitted';
  declineReason: string | null;
}

export interface RegistrationResult {
  user: SafeUser;
  registrationRequest: RegistrationSubmission['registrationRequest'];
  checkoutUrl?: string;
}

@Injectable()
export class AuthService {
  private readonly bcryptRounds = 12;

  constructor(
    private readonly usersService: UsersService,
    private readonly registrationService: RegistrationService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly stripePaymentsService: StripePaymentsService,
  ) {}

  async register(input: RegisterDto): Promise<RegistrationResult> {
    const passwordHash = await bcrypt.hash(input.password, this.bcryptRounds);
    try {
      const submission = await this.registrationService.submit({
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        accountType: 'customer',
        accountStatus: 'active',
      });
      return {
        user: this.toSafeUser(submission.user),
        registrationRequest: submission.registrationRequest,
      };
    } catch (error) {
      this.throwRegistrationError(error);
      throw error;
    }
  }

  async registerCustomer(
    input: RegisterCustomerDto,
  ): Promise<RegistrationResult> {
    const passwordHash = await bcrypt.hash(input.password, this.bcryptRounds);
    try {
      const submission = await this.registrationService.submit({
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        ...(input.profileImageData
          ? { profileImageData: input.profileImageData }
          : {}),
        countryCode: input.countryCode,
        mobileNumber: input.mobileNumber,
        ...(input.latitude !== undefined && input.longitude !== undefined
          ? {
              location: {
                latitude: input.latitude,
                longitude: input.longitude,
              },
            }
          : {}),
        accountType: 'customer',
        accountStatus: 'active',
        ...(input.notificationToken
          ? { notificationToken: input.notificationToken }
          : {}),
      });
      return {
        user: this.toSafeUser(submission.user),
        registrationRequest: submission.registrationRequest,
      };
    } catch (error) {
      this.throwRegistrationError(error);
      throw error;
    }
  }

  async registerShop(input: RegisterShopDto): Promise<RegistrationResult> {
    this.stripePaymentsService.ensureConfigured();
    const passwordHash = await bcrypt.hash(input.password, this.bcryptRounds);
    try {
      const submission = await this.registrationService.submit({
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        ...(input.profileImageData
          ? { profileImageData: input.profileImageData }
          : {}),
        countryCode: input.countryCode,
        mobileNumber: input.mobileNumber,
        accountType: 'shop',
        accountStatus: 'pending_approval',
        ...(input.notificationToken
          ? { notificationToken: input.notificationToken }
          : {}),
        shopDetails: {
          shopName: input.shopName,
          ...(input.shopImageData
            ? { shopImageData: input.shopImageData }
            : {}),
          businessType: input.businessType,
          description: input.description,
          yearsOfExperience: input.yearsOfExperience,
          address: input.address,
          ...(input.street ? { street: input.street } : {}),
          ...(input.area ? { area: input.area } : {}),
          city: input.city,
          state: input.state,
          ...(input.country ? { country: input.country } : {}),
          postalCode: input.postalCode,
          landmark: input.landmark ?? '',
          services: input.services,
          ...(input.latitude !== undefined && input.longitude !== undefined
            ? {
                location: {
                  latitude: input.latitude,
                  longitude: input.longitude,
                },
              }
            : {}),
        },
      });
      if (!submission.registrationRequest) {
        throw new Error(
          'Shop registration did not return its registration request',
        );
      }
      return {
        user: this.toSafeUser(submission.user),
        registrationRequest: submission.registrationRequest,
        checkoutUrl: await this.stripePaymentsService.createShopCheckout(
          submission.user._id.toString(),
          submission.user.email,
          submission.registrationRequest.id,
        ),
      };
    } catch (error) {
      this.throwRegistrationError(error);
      throw error;
    }
  }

  async retryShopCheckout(
    input: Pick<RegisterShopDto, 'email' | 'password'>,
  ): Promise<string> {
    const user = await this.usersService.findByEmailForAuthentication(
      input.email,
    );
    const passwordMatches = user
      ? await bcrypt.compare(input.password, user.passwordHash)
      : await bcrypt.hash(input.password, this.bcryptRounds).then(() => false);
    if (!user || !passwordMatches) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect',
      });
    }
    if (
      user.accountType !== 'shop' ||
      user.accountStatus !== 'pending_approval'
    ) {
      throw new ForbiddenException({
        code: 'SHOP_PAYMENT_UNAVAILABLE',
        message: 'This shop account is not awaiting payment.',
      });
    }
    await this.registrationService.ensureShopRequestForUser(user);
    return this.stripePaymentsService.retryShopCheckout(
      user._id.toString(),
      user.email,
    );
  }

  async login(input: LoginDto): Promise<LoginResult> {
    const user = await this.usersService.findByEmailForAuthentication(
      input.email,
    );
    const passwordMatches = user
      ? await bcrypt.compare(input.password, user.passwordHash)
      : await bcrypt.hash(input.password, this.bcryptRounds).then(() => false);
    if (!user || !passwordMatches) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect',
      });
    }

    const accountType = user.accountType ?? 'customer';
    const accountStatus = user.accountStatus ?? 'active';
    const accountLifecycleStatus =
      user.accountLifecycleStatus ??
      (accountStatus === 'active' ? 'active' : 'inactive');
    if (
      accountType === 'admin' &&
      (accountStatus !== 'active' || accountLifecycleStatus !== 'active')
    ) {
      throw new ForbiddenException({
        code: 'ACCOUNT_NOT_ACTIVE',
        message: 'This account cannot sign in yet.',
      });
    }

    const safeUser = await this.toAuthenticatedUser(user);
    const accessToken = await this.jwtService.signAsync({
      sub: user._id.toString(),
      email: user.email,
      accountType,
      accountStatus: safeUser.accountStatus,
    });
    return {
      accessToken,
      user: safeUser,
      redirectTo:
        safeUser.shopAuthorization?.destination ??
        safeUser.customerAuthorization?.destination ??
        (accountType === 'admin' ? '/admin' : '/customer'),
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersService.findByIdForAuthentication(userId);
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException({
        code: 'INVALID_CURRENT_PASSWORD',
        message: 'Current password is incorrect.',
      });
    }
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      throw new BadRequestException(
        'Choose a password different from your current password.',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, this.bcryptRounds);
    await this.usersService.updatePasswordHash(userId, passwordHash);
  }

  getAccessTokenTtlSeconds(): number {
    return this.configService.getOrThrow<number>(ACCESS_TOKEN_EXPIRES_IN);
  }

  toSafeUser(user: UserDocument): SafeUser {
    return {
      id: user._id.toString(),
      email: user.email,
      createdAt: user.createdAt,
      accountType: user.accountType ?? 'customer',
      accountStatus: user.accountStatus ?? 'active',
      accountLifecycleStatus:
        user.accountLifecycleStatus ??
        (user.accountStatus === 'active' ? 'active' : 'inactive'),
      ...(user.firstName || user.fullName
        ? { firstName: user.firstName ?? this.legacyFirstName(user.fullName) }
        : {}),
      ...(user.lastName || user.fullName
        ? { lastName: user.lastName ?? this.legacyLastName(user.fullName) }
        : {}),
      ...(user.profileImageData
        ? { profileImageUrl: user.profileImageData }
        : {}),
      ...(user.countryCode ? { countryCode: user.countryCode } : {}),
      ...(user.mobileNumber ? { mobileNumber: user.mobileNumber } : {}),
      ...(user.location ? { location: user.location } : {}),
    };
  }

  async toAuthenticatedUser(user: UserDocument): Promise<SafeUser> {
    const safeUser = this.toSafeUser(user);
    const accountType = user.accountType ?? 'customer';
    if (accountType === 'customer') {
      const customerAuthorization = await this.getCustomerAuthorization(user);
      return {
        ...safeUser,
        accountStatus: customerAuthorization.accountStatus,
        accountLifecycleStatus: customerAuthorization.accountLifecycleStatus,
        customerAuthorization,
      };
    }
    if (accountType !== 'shop') {
      return safeUser;
    }

    return {
      ...safeUser,
      shopAuthorization: await this.getShopAuthorization(user),
    };
  }

  async getCustomerAuthorization(
    user: UserDocument,
  ): Promise<CustomerAuthorization> {
    const normalizedUser =
      (user.accountType ?? 'customer') === 'customer' &&
      (user.accountStatus === 'pending_approval' ||
        user.accountStatus === 'rejected') &&
      (!user.accountLifecycleStatus ||
        user.accountLifecycleStatus === 'inactive')
        ? ((await this.usersService.activateLegacyCustomerAccount(
            user._id.toString(),
          )) ?? user)
        : user;
    const accountStatus = normalizedUser.accountStatus ?? 'active';
    const accountLifecycleStatus =
      normalizedUser.accountLifecycleStatus ??
      (accountStatus === 'active' ? 'active' : 'inactive');

    return {
      registrationStatus: 'not_found',
      accountStatus,
      accountLifecycleStatus,
      destination:
        accountStatus === 'active' && accountLifecycleStatus === 'active'
          ? '/customer'
          : '/customer/profile',
      submittedAt: null,
      reviewedAt: null,
      declineReason: null,
    };
  }

  async getShopAuthorization(user: UserDocument): Promise<ShopAuthorization> {
    let request = await this.registrationService.findShopRequestForUser(
      user._id.toString(),
    );
    if (
      !request &&
      user.accountType === 'shop' &&
      user.accountStatus === 'pending_approval'
    ) {
      request = await this.registrationService.ensureShopRequestForUser(user);
    }
    const registrationStatus = request?.registrationStatus ?? 'not_found';
    const paymentStatus = request?.paymentStatus ?? 'not_required';
    const accountStatus = user.accountStatus ?? 'active';
    const accountLifecycleStatus =
      user.accountLifecycleStatus ??
      (accountStatus === 'active' ? 'active' : 'inactive');
    const approved =
      registrationStatus === 'approved' &&
      paymentStatus === 'paid' &&
      accountStatus === 'active' &&
      accountLifecycleStatus === 'active';
    return {
      registrationStatus,
      paymentStatus,
      accountStatus,
      accountLifecycleStatus,
      destination: approved ? '/shop' : '/shop/profile',
      submittedAt: request?.submittedAt ?? null,
      reviewedAt: request?.reviewedAt ?? null,
      declineReason: request?.declineReason ?? null,
    };
  }

  async getCurrentShopPaymentStatus(
    userId: string,
  ): Promise<ShopPaymentStatus> {
    const user = await this.requireShopUser(userId);
    await this.getShopAuthorization(user);
    return this.stripePaymentsService.getPaymentStatus(user._id.toString());
  }

  async createCheckoutForAuthenticatedShop(userId: string): Promise<string> {
    const user = await this.requireShopUser(userId);
    await this.getShopAuthorization(user);
    return this.stripePaymentsService.retryShopCheckout(
      user._id.toString(),
      user.email,
    );
  }

  async getShopProfile(userId: string): Promise<ShopProfile> {
    const user = await this.usersService.findById(userId);
    if (!user || user.accountType !== 'shop') {
      throw new ForbiddenException('Shop profile is not available.');
    }

    const authorization = await this.getShopAuthorization(user);
    const shopDetails = user.shopDetails;
    if (!shopDetails) {
      throw new ForbiddenException('Shop profile is not available.');
    }

    return {
      shopName: shopDetails.shopName,
      ...(shopDetails.shopImageData
        ? { shopImageData: shopDetails.shopImageData }
        : {}),
      businessType: shopDetails.businessType,
      description: shopDetails.description,
      yearsOfExperience: shopDetails.yearsOfExperience,
      ownerFirstName: user.firstName ?? this.legacyFirstName(user.fullName),
      ownerLastName: user.lastName ?? this.legacyLastName(user.fullName),
      email: user.email,
      countryCode: user.countryCode ?? '',
      mobileNumber: user.mobileNumber ?? '',
      address: shopDetails.address,
      ...(shopDetails.street ? { street: shopDetails.street } : {}),
      ...(shopDetails.area ? { area: shopDetails.area } : {}),
      city: shopDetails.city,
      state: shopDetails.state,
      ...(shopDetails.country ? { country: shopDetails.country } : {}),
      postalCode: shopDetails.postalCode,
      landmark: shopDetails.landmark ?? '',
      ...(shopDetails.location ? { location: shopDetails.location } : {}),
      businessAddress: [
        shopDetails.address,
        shopDetails.street,
        shopDetails.area,
        shopDetails.landmark,
        shopDetails.city,
        shopDetails.state,
        shopDetails.country,
        shopDetails.postalCode,
      ]
        .filter(Boolean)
        .join(', '),
      services: shopDetails.services,
      subscriptionPlan: 'Fixroa Shop monthly subscription',
      subscriptionAmountCents: 2900,
      subscriptionCurrency: 'usd',
      paymentStatus: authorization.paymentStatus,
      registrationStatus: authorization.registrationStatus,
      accountLifecycleStatus: authorization.accountLifecycleStatus,
      submittedAt: authorization.submittedAt,
      adminApprovalStatus:
        authorization.registrationStatus === 'not_found'
          ? 'not_submitted'
          : authorization.registrationStatus,
      declineReason: authorization.declineReason,
    };
  }

  private legacyFirstName(value?: string): string {
    return value?.trim().split(/\s+/)[0] ?? '';
  }

  private legacyLastName(value?: string): string {
    return value?.trim().split(/\s+/).slice(1).join(' ') ?? '';
  }

  async getCurrentShopAuthorization(
    userId: string,
  ): Promise<ShopAuthorization> {
    const user = await this.usersService.findById(userId);
    if (!user || user.accountType !== 'shop') {
      throw new ForbiddenException(
        'Shop registration status is not available.',
      );
    }

    return this.getShopAuthorization(user);
  }

  private async requireShopUser(userId: string): Promise<UserDocument> {
    const user = await this.usersService.findById(userId);
    if (!user || user.accountType !== 'shop') {
      throw new ForbiddenException('Shop payment access is not available.');
    }
    return user;
  }

  private throwRegistrationError(error: unknown): void {
    if (!this.isDuplicateEntryError(error)) {
      return;
    }

    const keyPattern = this.isRecord(error) ? error.keyPattern : undefined;
    const duplicateEmail =
      this.isRecord(keyPattern) && Object.hasOwn(keyPattern, 'email');
    throw new ConflictException(
      duplicateEmail
        ? 'An account with this email already exists'
        : 'An account with this mobile number already exists',
    );
  }

  private isDuplicateEntryError(error: unknown): boolean {
    if (!this.isRecord(error) || error.code !== 11000) {
      return false;
    }

    return (
      this.isRecord(error.keyPattern) &&
      (Object.hasOwn(error.keyPattern, 'email') ||
        (Object.hasOwn(error.keyPattern, 'countryCode') &&
          Object.hasOwn(error.keyPattern, 'mobileNumber')))
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
