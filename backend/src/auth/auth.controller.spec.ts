import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { UsersService } from '../users/users.service';
import { CustomerPortalService } from '../customer/customer-portal.service';
import { RegistrationService } from '../registrations/registration.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ProfileController } from './profile.controller';
import { ShopProfileController } from './shop-profile.controller';
import { ShopPortalGuard } from './shop-portal.guard';

describe('AuthController', () => {
  let app: INestApplication<App>;
  const safeUser = {
    id: 'user-id',
    email: 'person@example.com',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const serializedUser = {
    ...safeUser,
    createdAt: safeUser.createdAt.toISOString(),
  };
  const registrationRequest = {
    id: 'registration-id',
    registrationNumber: 'PRX-20261108-ABCDEF',
    registrationStatus: 'pending',
    submittedAt: safeUser.createdAt,
  };
  const registrationResult = {
    user: {
      ...safeUser,
      accountType: 'customer',
      accountStatus: 'pending_approval',
    },
    registrationRequest,
  };
  const authService = {
    register: jest.fn().mockResolvedValue(registrationResult),
    registerCustomer: jest.fn().mockResolvedValue(registrationResult),
    registerShop: jest.fn().mockResolvedValue({
      ...registrationResult,
      checkoutUrl: 'https://checkout.stripe.test/session',
      user: {
        ...registrationResult.user,
        accountType: 'shop',
      },
    }),
    retryShopCheckout: jest
      .fn()
      .mockResolvedValue('https://checkout.stripe.test/retry'),
    login: jest.fn().mockResolvedValue({
      accessToken: 'signed-access-token',
      user: safeUser,
      redirectTo: '/customer',
    }),
    getAccessTokenTtlSeconds: jest.fn().mockReturnValue(86400),
    toSafeUser: jest.fn().mockReturnValue(safeUser),
    toAuthenticatedUser: jest.fn().mockResolvedValue(safeUser),
    changePassword: jest.fn().mockResolvedValue(undefined),
    getCurrentShopAuthorization: jest.fn().mockResolvedValue({
      registrationStatus: 'pending',
      paymentStatus: 'unpaid',
      accountStatus: 'pending_approval',
      destination: '/shop/payment',
      submittedAt: safeUser.createdAt,
      reviewedAt: null,
      declineReason: null,
    }),
    getShopProfile: jest.fn().mockResolvedValue({
      shopName: 'Example Repairs',
      shopImageData: `data:image/png;base64,${Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]).toString('base64')}`,
    }),
  };
  const usersService = {
    findById: jest.fn().mockResolvedValue(safeUser),
    updateProfile: jest.fn().mockResolvedValue(safeUser),
    updateShopImage: jest.fn().mockResolvedValue(safeUser),
    updateShopBusinessDetails: jest.fn().mockResolvedValue(safeUser),
  };
  const customerPortalService = {
    searchAddresses: jest.fn().mockResolvedValue([
      {
        label: 'Sector 70, Mohali, Punjab, India',
        latitude: 30.7,
        longitude: 76.7,
        city: 'Mohali',
        state: 'Punjab',
      },
    ]),
  };
  const configService = {
    getOrThrow: jest.fn().mockReturnValue('development'),
  };
  const testSecret = 'test-secret-that-is-long-enough-for-jwt';

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: testSecret,
          signOptions: { expiresIn: 86400 },
        }),
      ],
      controllers: [AuthController, ProfileController, ShopProfileController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: ConfigService, useValue: configService },
        { provide: UsersService, useValue: usersService },
        { provide: CustomerPortalService, useValue: customerPortalService },
        {
          provide: RegistrationService,
          useValue: { findShopRequestForUser: jest.fn() },
        },
        {
          provide: ShopPortalGuard,
          useValue: { canActivate: jest.fn().mockReturnValue(true) },
        },
        JwtAuthGuard,
      ],
    }).compile();

    app = module.createNestApplication<App>();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('suggests public geocoded locations for registration', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/addresses')
      .query({ q: 'Sector 70 Mohali' })
      .expect(200, {
        data: {
          suggestions: [
            {
              label: 'Sector 70, Mohali, Punjab, India',
              latitude: 30.7,
              longitude: 76.7,
              city: 'Mohali',
              state: 'Punjab',
            },
          ],
        },
      });
    expect(customerPortalService.searchAddresses).toHaveBeenCalledWith(
      'Sector 70 Mohali',
    );
  });

  it('registers a named account as a pending customer request', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        firstName: 'Alex',
        lastName: 'Repair',
        email: safeUser.email,
        password: 'CorrectHorse7Battery',
      })
      .expect(201);

    expect(authService.register).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Alex',
        lastName: 'Repair',
        email: safeUser.email,
      }),
    );
    expect(response.text).toContain('"accountStatus":"pending_approval"');
    expect(response.text).toContain('"registrationStatus":"pending"');
    expect(response.text).not.toContain('password');
  });

  it('retries checkout for a pending shop using its credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register/shop/checkout')
      .send({
        email: 'shop@example.com',
        password: 'RepairShop123',
      })
      .expect(200);

    expect(response.body).toEqual({
      data: { checkoutUrl: 'https://checkout.stripe.test/retry' },
    });
    expect(authService.retryShopCheckout).toHaveBeenCalledWith({
      email: 'shop@example.com',
      password: 'RepairShop123',
    });
  });

  it('creates a customer account with phone details and accepted terms', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register/customer')
      .send({
        firstName: 'Customer',
        lastName: 'Example',
        email: safeUser.email,
        countryCode: '+1',
        mobileNumber: '5551234567',
        password: 'CorrectHorse7Battery',
        acceptTerms: true,
        profileImageData: 'data:image/png;base64,YWJj',
      })
      .expect(201);

    expect(response.text).toContain('"accountStatus":"pending_approval"');
    expect(response.text).toContain('"registrationStatus":"pending"');
    expect(authService.registerCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Customer',
        lastName: 'Example',
        countryCode: '+1',
        mobileNumber: '5551234567',
        acceptTerms: true,
        profileImageData: 'data:image/png;base64,YWJj',
      }),
    );
  });

  it('creates a shop application through the dedicated endpoint', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register/shop')
      .send({
        firstName: 'Shop',
        lastName: 'Owner',
        email: 'shop@example.com',
        countryCode: '+91',
        mobileNumber: '9876543210',
        password: 'RepairShop123',
        shopImageData: 'data:image/png;base64,YWJj',
        shopName: 'Example Repairs',
        businessType: 'Electronics Repair Shop',
        description: 'Repairs for household electronics.',
        yearsOfExperience: 5,
        address: '10 Main Street',
        city: 'Springfield',
        state: 'CA',
        postalCode: '90210',
        landmark: '',
        services: ['AC Repair'],
      })
      .expect(201);

    expect(response.text).toContain('"accountStatus":"pending_approval"');
    expect(response.text).toContain('"registrationStatus":"pending"');
    expect(response.text).toContain(
      '"checkoutUrl":"https://checkout.stripe.test/session"',
    );
    expect(authService.registerShop).toHaveBeenCalledWith(
      expect.objectContaining({
        shopImageData: 'data:image/png;base64,YWJj',
        shopName: 'Example Repairs',
        services: ['AC Repair'],
      }),
    );
  });

  it('rejects invalid phone numbers and unaccepted customer terms', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register/customer')
      .send({
        firstName: 'Customer',
        lastName: 'Example',
        email: safeUser.email,
        countryCode: '+1',
        mobileNumber: '12345',
        password: 'CorrectHorse7Battery',
        acceptTerms: false,
      })
      .expect(400);

    expect(authService.registerCustomer).not.toHaveBeenCalled();
  });

  it('rejects unsupported customer profile image data', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register/customer')
      .send({
        firstName: 'Customer',
        lastName: 'Example',
        email: safeUser.email,
        countryCode: '+1',
        mobileNumber: '5551234567',
        password: 'CorrectHorse7Battery',
        acceptTerms: true,
        profileImageData: 'data:image/gif;base64,YWJj',
      })
      .expect(400);

    expect(authService.registerCustomer).not.toHaveBeenCalled();
  });

  it('does not allow public registration to assign an administrator role', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register/customer')
      .send({
        firstName: 'Customer',
        lastName: 'Example',
        email: safeUser.email,
        countryCode: '+1',
        mobileNumber: '5551234567',
        password: 'CorrectHorse7Battery',
        acceptTerms: true,
        accountType: 'admin',
      })
      .expect(400);

    expect(authService.registerCustomer).not.toHaveBeenCalled();
  });

  it('sets an HttpOnly access cookie without returning the token in JSON', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: safeUser.email,
        password: 'a-correct-horse-battery',
      })
      .expect(200);

    expect(response.body).toEqual({
      data: { user: serializedUser, redirectTo: '/customer' },
    });
    expect(response.text).not.toContain('signed-access-token');
    expect(response.headers['set-cookie'][0]).toContain('access_token=');
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.headers['set-cookie'][0]).toContain('SameSite=Lax');
    expect(response.headers['set-cookie'][0]).toContain('Path=/api');
    expect(response.headers['set-cookie'][0]).toContain('Max-Age=86400');
  });

  it('clears the access cookie on logout', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .expect(204);

    expect(response.headers['set-cookie'][0]).toContain('access_token=');
    expect(response.headers['set-cookie'][0]).toContain('Path=/api');
    expect(response.headers['set-cookie'][0]).toContain('Expires=');
  });

  it('rejects invalid registration input before calling the service', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'short' })
      .expect(400);

    expect(authService.register).not.toHaveBeenCalled();
  });

  it('accepts an 8-character password with uppercase, lowercase, and a number', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        firstName: 'Alex',
        lastName: 'Repair',
        email: safeUser.email,
        password: 'Abcdef1!',
      })
      .expect(201);

    expect(authService.register).toHaveBeenCalled();
  });

  it.each(['abcdef1!', 'ABCDEF1!', 'Abcdefgh!'])(
    'rejects a password without all required character classes: %s',
    async (password) => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          firstName: 'Alex',
          lastName: 'Repair',
          email: safeUser.email,
          password,
        })
        .expect(400);

      expect(authService.register).not.toHaveBeenCalled();
    },
  );

  it('allows the protected profile endpoint with a valid signed cookie', async () => {
    const jwtService = app.get(JwtService);
    const token = await jwtService.signAsync({
      sub: safeUser.id,
      email: safeUser.email,
    });

    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', `access_token=${token}`)
      .expect(200, { data: { user: serializedUser } });
  });

  it('updates the authenticated user name and returns the refreshed profile', async () => {
    const jwtService = app.get(JwtService);
    const token = await jwtService.signAsync({
      sub: safeUser.id,
      email: safeUser.email,
    });

    await request(app.getHttpServer())
      .patch('/api/users/me/profile')
      .set('Cookie', `access_token=${token}`)
      .send({ firstName: 'Updated', lastName: 'Person' })
      .expect(200, { data: { user: serializedUser } });

    expect(usersService.updateProfile).toHaveBeenCalledWith(safeUser.id, {
      firstName: 'Updated',
      lastName: 'Person',
    });
  });

  it('changes the authenticated user password', async () => {
    const jwtService = app.get(JwtService);
    const token = await jwtService.signAsync({
      sub: safeUser.id,
      email: safeUser.email,
    });

    await request(app.getHttpServer())
      .patch('/api/users/me/password')
      .set('Cookie', `access_token=${token}`)
      .send({
        currentPassword: 'OldPassword1',
        newPassword: 'NewPassword2',
      })
      .expect(200, { data: { changed: true } });

    expect(authService.changePassword).toHaveBeenCalledWith(
      safeUser.id,
      'OldPassword1',
      'NewPassword2',
    );
  });

  it('rejects weak new passwords', async () => {
    const jwtService = app.get(JwtService);
    const token = await jwtService.signAsync({
      sub: safeUser.id,
      email: safeUser.email,
    });

    await request(app.getHttpServer())
      .patch('/api/users/me/password')
      .set('Cookie', `access_token=${token}`)
      .send({ currentPassword: 'OldPassword1', newPassword: 'weak' })
      .expect(400);

    expect(authService.changePassword).not.toHaveBeenCalled();
  });

  it('stores a valid uploaded profile image in the user record', async () => {
    const jwtService = app.get(JwtService);
    const token = await jwtService.signAsync({
      sub: safeUser.id,
      email: safeUser.email,
    });
    const pngSignature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    await request(app.getHttpServer())
      .post('/api/users/me/profile-image')
      .set('Cookie', `access_token=${token}`)
      .attach('image', pngSignature, {
        filename: 'profile.png',
        contentType: 'image/png',
      })
      .expect(201, { data: { user: serializedUser } });

    expect(usersService.updateProfile).toHaveBeenCalledWith(safeUser.id, {
      profileImageData: `data:image/png;base64,${pngSignature.toString('base64')}`,
    });
  });

  it('rejects uploaded profile images with unsupported content', async () => {
    const jwtService = app.get(JwtService);
    const token = await jwtService.signAsync({
      sub: safeUser.id,
      email: safeUser.email,
    });

    await request(app.getHttpServer())
      .post('/api/users/me/profile-image')
      .set('Cookie', `access_token=${token}`)
      .attach('image', Buffer.from('not an image'), {
        filename: 'profile.png',
        contentType: 'image/png',
      })
      .expect(400);

    expect(usersService.updateProfile).not.toHaveBeenCalled();
  });

  it('stores a valid uploaded shop image and returns the refreshed shop profile', async () => {
    const jwtService = app.get(JwtService);
    const token = await jwtService.signAsync({
      sub: safeUser.id,
      email: safeUser.email,
      accountType: 'shop',
    });
    const pngSignature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    await request(app.getHttpServer())
      .post('/api/shops/my-profile-image')
      .set('Cookie', `access_token=${token}`)
      .attach('image', pngSignature, {
        filename: 'shop.png',
        contentType: 'image/png',
      })
      .expect(201, {
        data: {
          profile: {
            shopName: 'Example Repairs',
            shopImageData: `data:image/png;base64,${pngSignature.toString('base64')}`,
          },
        },
      });

    expect(usersService.updateShopImage).toHaveBeenCalledWith(
      safeUser.id,
      `data:image/png;base64,${pngSignature.toString('base64')}`,
    );
    expect(authService.getShopProfile).toHaveBeenCalledWith(safeUser.id);
  });

  it('updates only the authenticated shop name and address and rejects other profile fields', async () => {
    const jwtService = app.get(JwtService);
    const token = await jwtService.signAsync({
      sub: safeUser.id,
      email: safeUser.email,
      accountType: 'shop',
    });
    const businessDetailsUpdate = {
      shopName: 'Updated Repairs',
      address: 'Main Road',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '411001',
      landmark: '',
      location: { latitude: 18.52, longitude: 73.85 },
    };

    await request(app.getHttpServer())
      .patch('/api/shops/my-profile/business-details')
      .set('Cookie', `access_token=${token}`)
      .send(businessDetailsUpdate)
      .expect(200, {
        data: {
          profile: {
            shopName: 'Example Repairs',
            shopImageData: 'data:image/png;base64,iVBORw0KGgo=',
          },
        },
      });

    expect(usersService.updateShopBusinessDetails).toHaveBeenCalledWith(
      safeUser.id,
      businessDetailsUpdate,
    );
    expect(authService.getShopProfile).toHaveBeenCalledWith(safeUser.id);

    await request(app.getHttpServer())
      .patch('/api/shops/my-profile/business-details')
      .set('Cookie', `access_token=${token}`)
      .send({
        ...businessDetailsUpdate,
        firstName: 'Other',
        lastName: 'Profile',
      })
      .expect(400);
  });

  it('rejects shop images with unsupported content', async () => {
    const jwtService = app.get(JwtService);
    const token = await jwtService.signAsync({
      sub: safeUser.id,
      email: safeUser.email,
      accountType: 'shop',
    });

    await request(app.getHttpServer())
      .post('/api/shops/my-profile-image')
      .set('Cookie', `access_token=${token}`)
      .attach('image', Buffer.from('not an image'), {
        filename: 'shop.png',
        contentType: 'image/png',
      })
      .expect(400);

    expect(usersService.updateShopImage).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', undefined],
    ['invalid', 'not-a-valid-token'],
  ])('rejects a protected request with a %s token', async (_label, token) => {
    const testRequest = request(app.getHttpServer()).get('/api/users/me');
    if (token) {
      testRequest.set('Cookie', `access_token=${token}`);
    }

    await testRequest.expect(401);
  });

  it('rejects an expired signed token', async () => {
    const jwtService = app.get(JwtService);
    const token = await jwtService.signAsync(
      { sub: safeUser.id, email: safeUser.email },
      { expiresIn: -1 },
    );

    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', `access_token=${token}`)
      .expect(401);
  });
});
