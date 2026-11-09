import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegistrationService } from '../registrations/registration.service';
import { StripePaymentsService } from '../payments/stripe-payments.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

describe('AuthService', () => {
  let service: AuthService;
  const now = new Date();
  const user = {
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    id: 'user-id',
    email: 'person@example.com',
    passwordHash: 'stored-hash',
    createdAt: now,
    updatedAt: now,
    accountType: 'customer',
    accountStatus: 'active',
    fullName: 'Example Person',
  };
  const usersService = {
    findByEmailForAuthentication: jest.fn(),
    findById: jest.fn(),
  };
  const registrationService = {
    submit: jest.fn(),
    findShopRequestForUser: jest.fn(),
    findRequestForUser: jest.fn().mockResolvedValue(null),
    ensureShopRequestForUser: jest.fn().mockResolvedValue(undefined),
  };
  const stripePaymentsService = {
    ensureConfigured: jest.fn(),
    createShopCheckout: jest
      .fn()
      .mockResolvedValue('https://checkout.stripe.test/session'),
    retryShopCheckout: jest
      .fn()
      .mockResolvedValue('https://checkout.stripe.test/session'),
  };
  const jwtService = { signAsync: jest.fn().mockResolvedValue('signed-token') };
  const configService = { getOrThrow: jest.fn().mockReturnValue(86400) };

  beforeEach(async () => {
    jest.clearAllMocks();
    user.passwordHash = await bcrypt.hash('a-correct-horse-battery', 4);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: RegistrationService, useValue: registrationService },
        { provide: StripePaymentsService, useValue: stripePaymentsService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('routes legacy email-only registrations through Admin approval', async () => {
    registrationService.submit.mockResolvedValue({
      user: { ...user, accountStatus: 'pending_approval' },
      registrationRequest: {
        id: 'registration-id',
        registrationNumber: 'PRX-20261108-ABCDEF',
        registrationStatus: 'pending',
        submittedAt: now,
      },
    });

    const result = await service.register(
      Object.assign(new RegisterDto(), {
        email: user.email,
        password: 'a-correct-horse-battery',
      }),
    );

    expect(registrationService.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        email: user.email,
        accountType: 'customer',
        accountStatus: 'pending_approval',
      }),
    );
    expect(result.user.accountStatus).toBe('pending_approval');
  });

  it('includes account lifecycle status in the shop profile', async () => {
    const shop = {
      ...user,
      accountType: 'shop',
      accountStatus: 'active',
      accountLifecycleStatus: 'suspended',
      shopDetails: {
        shopName: 'Example Repairs',
        address: 'Main Road',
        city: 'Pune',
        state: 'Maharashtra',
        postalCode: '411001',
        services: ['AC Repair'],
      },
    };
    usersService.findById.mockResolvedValue(shop);
    registrationService.findShopRequestForUser.mockResolvedValue({
      registrationStatus: 'approved',
      paymentStatus: 'paid',
      submittedAt: now,
      reviewedAt: now,
      declineReason: null,
    });

    await expect(service.getShopProfile('shop-id')).resolves.toMatchObject({
      adminApprovalStatus: 'approved',
      accountLifecycleStatus: 'suspended',
    });
  });

  it('submits a customer for approval with a bcrypt password hash', async () => {
    let registration: Record<string, unknown> | undefined;
    registrationService.submit.mockImplementation(
      (input: Record<string, unknown>) => {
        registration = input;
        return Promise.resolve({
          user: { ...user, ...input, _id: user._id, createdAt: now },
          registrationRequest: {
            id: 'registration-id',
            registrationNumber: 'PRX-20261108-ABCDEF',
            registrationStatus: 'pending',
            submittedAt: now,
          },
        });
      },
    );

    const result = await service.registerCustomer({
      fullName: 'Customer Example',
      email: 'person@example.com',
      countryCode: '+1',
      mobileNumber: '5551234567',
      password: 'a-correct-horse-battery',
      acceptTerms: true,
      latitude: 28.6139,
      longitude: 77.209,
    });

    expect(registration).toMatchObject({
      fullName: 'Customer Example',
      accountType: 'customer',
      accountStatus: 'pending_approval',
      location: { latitude: 28.6139, longitude: 77.209 },
    });
    expect(
      await bcrypt.compare(
        'a-correct-horse-battery',
        registration?.['passwordHash'] as string,
      ),
    ).toBe(true);
    expect(result.user.accountStatus).toBe('pending_approval');
    expect(result.registrationRequest.registrationStatus).toBe('pending');
  });

  it('persists shop details with pending approval status', async () => {
    let registration: Record<string, unknown> | undefined;
    registrationService.submit.mockImplementation(
      (input: Record<string, unknown>) => {
        registration = input;
        return Promise.resolve({
          user: { ...user, ...input, _id: user._id, createdAt: now },
          registrationRequest: {
            id: 'registration-id',
            registrationNumber: 'PRX-20261108-ABCDEF',
            registrationStatus: 'pending',
            submittedAt: now,
          },
        });
      },
    );

    const result = await service.registerShop({
      fullName: 'Shop Owner',
      email: 'shop@example.com',
      countryCode: '+91',
      mobileNumber: '9876543210',
      password: 'RepairShop123',
      profileImageData: 'data:image/png;base64,YWJj',
      shopImageData: 'data:image/png;base64,c2hvcA==',
      shopName: 'Example Repairs',
      businessType: 'Electronics Repair Shop',
      description: 'Repairs for household electronics.',
      yearsOfExperience: 5,
      address: '10 Main Street',
      street: '10 Main Street',
      area: 'Downtown',
      city: 'Springfield',
      state: 'CA',
      country: 'United States',
      postalCode: '90210',
      landmark: '',
      latitude: 28.6139,
      longitude: 77.209,
      services: ['AC Repair'],
    });

    expect(registration).toMatchObject({
      accountType: 'shop',
      accountStatus: 'pending_approval',
      profileImageData: 'data:image/png;base64,YWJj',
      shopDetails: {
        shopName: 'Example Repairs',
        address: '10 Main Street',
        street: '10 Main Street',
        area: 'Downtown',
        city: 'Springfield',
        state: 'CA',
        country: 'United States',
        postalCode: '90210',
        services: ['AC Repair'],
        location: { latitude: 28.6139, longitude: 77.209 },
        shopImageData: 'data:image/png;base64,c2hvcA==',
      },
    });
    expect(result.user.accountStatus).toBe('pending_approval');
    expect(stripePaymentsService.ensureConfigured).toHaveBeenCalled();
    expect(stripePaymentsService.createShopCheckout).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      'shop@example.com',
      'registration-id',
    );
    expect(result.checkoutUrl).toBe('https://checkout.stripe.test/session');
  });

  it('restores a missing Shop registration before resuming checkout', async () => {
    const pendingShop = {
      ...user,
      accountType: 'shop' as const,
      accountStatus: 'pending_approval' as const,
      shopDetails: { shopName: 'Example Repairs' },
    };
    usersService.findByEmailForAuthentication.mockResolvedValue(pendingShop);

    await expect(
      service.retryShopCheckout({
        email: user.email,
        password: 'a-correct-horse-battery',
      }),
    ).resolves.toBe('https://checkout.stripe.test/session');

    expect(registrationService.ensureShopRequestForUser).toHaveBeenCalledWith(
      pendingShop,
    );
    expect(stripePaymentsService.retryShopCheckout).toHaveBeenCalledWith(
      pendingShop._id.toString(),
      pendingShop.email,
    );
  });

  it('recovers the signed-in pending Shop before starting Checkout', async () => {
    const pendingShop = {
      ...user,
      accountType: 'shop' as const,
      accountStatus: 'pending_approval' as const,
      shopDetails: { shopName: 'Example Repairs' },
    };
    usersService.findById.mockResolvedValue(pendingShop);
    registrationService.findShopRequestForUser.mockResolvedValue(null);
    registrationService.ensureShopRequestForUser.mockResolvedValue({
      registrationStatus: 'pending',
      paymentStatus: 'unpaid',
    });

    await expect(
      service.createCheckoutForAuthenticatedShop(pendingShop._id.toString()),
    ).resolves.toBe('https://checkout.stripe.test/session');
    expect(registrationService.ensureShopRequestForUser).toHaveBeenCalledWith(
      pendingShop,
    );
    expect(stripePaymentsService.retryShopCheckout).toHaveBeenCalledWith(
      pendingShop._id.toString(),
      pendingShop.email,
    );
  });

  it('denies customer accounts access to Shop checkout', async () => {
    usersService.findById.mockResolvedValue({
      ...user,
      accountType: 'customer',
    });

    await expect(
      service.createCheckoutForAuthenticatedShop(user._id.toString()),
    ).rejects.toMatchObject({ status: 403 });
    expect(stripePaymentsService.retryShopCheckout).not.toHaveBeenCalled();
  });

  it('maps a duplicate phone index to a conflict response', async () => {
    registrationService.submit.mockRejectedValue({
      code: 11000,
      keyPattern: { countryCode: 1, mobileNumber: 1 },
    });

    await expect(
      service.registerCustomer({
        fullName: 'Customer Example',
        email: 'person@example.com',
        countryCode: '+1',
        mobileNumber: '5551234567',
        password: 'a-correct-horse-battery',
        acceptTerms: true,
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        message: 'An account with this mobile number already exists',
      },
    });
  });

  it('returns a signed token and safe profile for valid credentials', async () => {
    usersService.findByEmailForAuthentication.mockResolvedValue(user);

    const input = Object.assign(new LoginDto(), {
      email: user.email,
      password: 'a-correct-horse-battery',
    });
    const result = await service.login(input);

    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: '507f1f77bcf86cd799439011',
      email: user.email,
      accountType: 'customer',
      accountStatus: 'active',
    });
    expect(result).toEqual({
      accessToken: 'signed-token',
      redirectTo: '/customer',
      user: {
        id: '507f1f77bcf86cd799439011',
        email: user.email,
        createdAt: now,
        accountType: 'customer',
        accountStatus: 'active',
        accountLifecycleStatus: 'active',
        fullName: 'Example Person',
        customerAuthorization: {
          registrationStatus: 'not_found',
          accountStatus: 'active',
          accountLifecycleStatus: 'active',
          destination: '/customer',
          submittedAt: null,
          reviewedAt: null,
          declineReason: null,
        },
      },
    });
  });

  it('allows pending shops and customers to sign in to their restricted profile', async () => {
    usersService.findByEmailForAuthentication.mockResolvedValue({
      ...user,
      accountType: 'shop',
      accountStatus: 'pending_approval',
    });

    registrationService.findShopRequestForUser.mockResolvedValue({
      registrationStatus: 'pending',
      paymentStatus: 'unpaid',
      submittedAt: now,
      reviewedAt: undefined,
      declineReason: undefined,
    });

    const shopLogin = await service.login(
      Object.assign(new LoginDto(), {
        email: user.email,
        password: 'a-correct-horse-battery',
      }),
    );
    expect(shopLogin.redirectTo).toBe('/shop/profile');
    expect(shopLogin.user.shopAuthorization).toMatchObject({
      registrationStatus: 'pending',
      paymentStatus: 'unpaid',
    });
    expect(jwtService.signAsync).toHaveBeenCalled();

    jest.clearAllMocks();
    usersService.findByEmailForAuthentication.mockResolvedValue({
      ...user,
      accountType: 'customer',
      accountStatus: 'pending_approval',
    });
    registrationService.findRequestForUser.mockResolvedValue({
      registrationStatus: 'pending',
      submittedAt: now,
    });
    const customerLogin = await service.login(
      Object.assign(new LoginDto(), {
        email: user.email,
        password: 'a-correct-horse-battery',
      }),
    );
    expect(customerLogin.redirectTo).toBe('/customer/profile');
    expect(customerLogin.user.customerAuthorization).toMatchObject({
      registrationStatus: 'pending',
      destination: '/customer/profile',
    });
    expect(jwtService.signAsync).toHaveBeenCalled();
  });

  it('includes the stored profile image in the safe authenticated profile', () => {
    const profileImageData = 'data:image/png;base64,abc';

    expect(
      service.toSafeUser({
        ...user,
        profileImageData,
      } as import('../users/schemas/user.schema').UserDocument),
    ).toMatchObject({
      fullName: 'Example Person',
      profileImageUrl: profileImageData,
    });
  });

  it('routes an approved customer to the full Customer Portal', async () => {
    usersService.findByEmailForAuthentication.mockResolvedValue({
      ...user,
      accountType: 'customer',
      accountStatus: 'active',
    });
    registrationService.findRequestForUser.mockResolvedValue({
      registrationStatus: 'approved',
      submittedAt: now,
      reviewedAt: now,
    });

    const result = await service.login(
      Object.assign(new LoginDto(), {
        email: user.email,
        password: 'a-correct-horse-battery',
      }),
    );

    expect(result.redirectTo).toBe('/customer');
    expect(result.user.customerAuthorization).toMatchObject({
      registrationStatus: 'approved',
      destination: '/customer',
    });
  });

  it.each([
    [
      'paid and pending',
      'pending',
      'paid',
      'pending_approval',
      '/shop/profile',
    ],
    ['paid and declined', 'declined', 'paid', 'rejected', '/shop/profile'],
    ['paid and approved', 'approved', 'paid', 'active', '/shop'],
  ] as const)(
    'routes a %s Shop login to the appropriate portal page',
    async (
      _case,
      registrationStatus,
      paymentStatus,
      accountStatus,
      destination,
    ) => {
      usersService.findByEmailForAuthentication.mockResolvedValue({
        ...user,
        accountType: 'shop',
        accountStatus,
      });
      registrationService.findShopRequestForUser.mockResolvedValue({
        registrationStatus,
        paymentStatus,
        submittedAt: now,
        reviewedAt: now,
        declineReason:
          registrationStatus === 'declined'
            ? 'Incomplete documents'
            : undefined,
      });

      const result = await service.login(
        Object.assign(new LoginDto(), {
          email: user.email,
          password: 'a-correct-horse-battery',
        }),
      );

      expect(result.redirectTo).toBe(destination);
    },
  );

  it('uses the configured JWT expiration for access-token cookies', () => {
    expect(service.getAccessTokenTtlSeconds()).toBe(86400);
    expect(configService.getOrThrow).toHaveBeenCalledWith('JWT_EXPIRES_IN');
  });

  it('uses the same generic unauthorized response for unknown and wrong credentials', async () => {
    usersService.findByEmailForAuthentication.mockResolvedValue(null);
    await expect(
      service.login(
        Object.assign(new LoginDto(), {
          email: 'unknown@example.com',
          password: 'a-correct-horse-battery',
        }),
      ),
    ).rejects.toMatchObject({
      status: 401,
      response: {
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect',
      },
    });
    usersService.findByEmailForAuthentication.mockResolvedValue(user);
    usersService.findByEmailForAuthentication.mockResolvedValue(user);
    await expect(
      service.login(
        Object.assign(new LoginDto(), {
          email: user.email,
          password: 'incorrect-password',
        }),
      ),
    ).rejects.toMatchObject({
      status: 401,
      response: {
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect',
      },
    });
  });

  it('maps duplicate email constraints to a conflict response', async () => {
    registrationService.submit.mockRejectedValue({
      code: 11000,
      keyPattern: { email: 1 },
    });

    await expect(
      service.registerCustomer({
        fullName: 'Example Person',
        email: user.email,
        countryCode: '+1',
        mobileNumber: '5551234567',
        password: 'a-correct-horse-battery',
        acceptTerms: true,
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        message: 'An account with this email already exists',
      },
    });
  });

  it('rethrows unexpected registration persistence failures', async () => {
    const databaseError = new Error('database unavailable');
    registrationService.submit.mockRejectedValue(databaseError);

    await expect(
      service.registerCustomer({
        fullName: 'Example Person',
        email: user.email,
        countryCode: '+1',
        mobileNumber: '5551234567',
        password: 'a-correct-horse-battery',
        acceptTerms: true,
      }),
    ).rejects.toBe(databaseError);
  });
});
