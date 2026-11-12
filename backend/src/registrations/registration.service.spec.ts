import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Notification } from '../notifications/schemas/notification.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { RegistrationRequest } from './schemas/registration-request.schema';
import { RegistrationService } from './registration.service';

describe('RegistrationService', () => {
  let service: RegistrationService;
  const session = {
    withTransaction: jest.fn(),
    endSession: jest.fn().mockResolvedValue(undefined),
  };
  const connection = { startSession: jest.fn().mockResolvedValue(session) };
  const createdUser = {
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  } as unknown as UserDocument;
  const createdRequest = {
    _id: { toString: () => '507f1f77bcf86cd799439012' },
    registrationNumber: 'PRX-20260101-ABCDEF',
    submittedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const usersService = {
    findActiveAdminIds: jest
      .fn()
      .mockResolvedValue(['507f1f77bcf86cd799439013']),
    createRegistrationAccount: jest.fn().mockResolvedValue(createdUser),
  };
  const notificationsService = {
    notifyAdminsOfRegistration: jest.fn().mockResolvedValue(undefined),
    sendToUsers: jest.fn().mockResolvedValue(undefined),
  };
  const registrationRequestsModel = {
    create: jest.fn().mockResolvedValue([createdRequest]),
    findOne: jest.fn(),
  };
  const existingRequestQuery = {
    exec: jest.fn().mockResolvedValue(null),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    existingRequestQuery.exec.mockResolvedValue(null);
    registrationRequestsModel.findOne.mockReturnValue(existingRequestQuery);
    usersService.findActiveAdminIds.mockResolvedValue([
      '507f1f77bcf86cd799439013',
    ]);
    session.withTransaction.mockImplementation(
      async (callback: () => Promise<void>) => callback(),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrationService,
        { provide: UsersService, useValue: usersService },
        { provide: NotificationsService, useValue: notificationsService },
        {
          provide: getModelToken(RegistrationRequest.name),
          useValue: registrationRequestsModel,
        },
        { provide: getModelToken(Notification.name), useValue: {} },
        { provide: getConnectionToken(), useValue: connection },
      ],
    }).compile();

    service = module.get<RegistrationService>(RegistrationService);
  });

  it('creates a pending account, registration request, and admin notification atomically', async () => {
    const result = await service.submit({
      email: 'person@example.com',
      passwordHash: 'bcrypt-hash',
      firstName: 'Customer',
      lastName: 'Example',
      countryCode: '+1',
      mobileNumber: '5551234567',
      accountType: 'customer',
      accountStatus: 'active',
    });

    expect(usersService.createRegistrationAccount).toHaveBeenCalledWith(
      expect.objectContaining({ accountStatus: 'pending_approval' }),
      session,
    );
    expect(registrationRequestsModel.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          userId: createdUser._id,
          accountType: 'customer',
          registrationStatus: 'pending',
        }),
      ],
      { session },
    );
    expect(
      notificationsService.notifyAdminsOfRegistration,
    ).toHaveBeenCalledWith(
      ['507f1f77bcf86cd799439013'],
      createdRequest._id,
      'customer',
      'Customer Example',
      session,
    );
    expect(notificationsService.sendToUsers).toHaveBeenCalledWith(
      [new Types.ObjectId('507f1f77bcf86cd799439013')],
      'New Customer Registration',
      'Customer Example has submitted a registration request. Please review the application.',
      'new_registration',
      createdRequest._id,
    );
    expect(result).toEqual({
      user: createdUser,
      registrationRequest: {
        id: '507f1f77bcf86cd799439012',
        registrationNumber: createdRequest.registrationNumber,
        registrationStatus: 'pending',
        submittedAt: createdRequest.submittedAt,
      },
    });
    expect(session.endSession).toHaveBeenCalled();
  });

  it('creates a pending registration without Admin notifications when no Admin is active', async () => {
    usersService.findActiveAdminIds.mockResolvedValue([]);

    const result = await service.submit({
      email: 'person@example.com',
      passwordHash: 'bcrypt-hash',
      accountType: 'customer',
      accountStatus: 'active',
    });

    expect(usersService.createRegistrationAccount).toHaveBeenCalled();
    expect(registrationRequestsModel.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          userId: createdUser._id,
          accountType: 'customer',
          registrationStatus: 'pending',
        }),
      ],
      { session },
    );
    expect(
      notificationsService.notifyAdminsOfRegistration,
    ).not.toHaveBeenCalled();
    expect(result.registrationRequest.registrationStatus).toBe('pending');
    expect(session.endSession).toHaveBeenCalled();
  });

  it('marks shop registrations as unpaid until Stripe confirms checkout', async () => {
    await service.submit({
      email: 'shop@example.com',
      passwordHash: 'bcrypt-hash',
      firstName: 'Shop',
      lastName: 'Owner',
      countryCode: '+91',
      mobileNumber: '9876543210',
      accountType: 'shop',
      accountStatus: 'active',
      shopDetails: {
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
      },
    });

    expect(usersService.createRegistrationAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        accountType: 'shop',
        shopDetails: {
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
        },
      }),
      session,
    );
    expect(registrationRequestsModel.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          userId: createdUser._id,
          accountType: 'shop',
          paymentStatus: 'unpaid',
        }),
      ],
      { session },
    );
  });

  it('looks up a registration using the authenticated user id and account type', async () => {
    const request = { userId: new Types.ObjectId(), accountType: 'customer' };
    existingRequestQuery.exec.mockResolvedValue(request);

    await expect(
      service.findRequestForUser('507f1f77bcf86cd799439011', 'customer'),
    ).resolves.toBe(request);
    expect(registrationRequestsModel.findOne).toHaveBeenCalledWith({
      userId: new Types.ObjectId('507f1f77bcf86cd799439011'),
      accountType: 'customer',
    });
  });

  it('recreates a missing pending Shop registration from the saved account details', async () => {
    const shopUser = {
      _id: { toString: () => '507f1f77bcf86cd799439011' },
      email: 'shop@example.com',
      fullName: 'Shop Owner',
      countryCode: '+91',
      mobileNumber: '9876543210',
      accountType: 'shop',
      accountStatus: 'pending_approval',
      shopDetails: {
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
      },
    } as unknown as UserDocument;

    await expect(service.ensureShopRequestForUser(shopUser)).resolves.toBe(
      createdRequest,
    );
    expect(registrationRequestsModel.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          userId: shopUser._id,
          accountType: 'shop',
          registrationStatus: 'pending',
          paymentStatus: 'unpaid',
        }),
      ],
      { session },
    );
    expect(
      notificationsService.notifyAdminsOfRegistration,
    ).toHaveBeenCalledWith(
      ['507f1f77bcf86cd799439013'],
      createdRequest._id,
      'shop',
      'Example Repairs',
      session,
    );
  });

  it('refuses to recover a pending Shop with incomplete saved details', async () => {
    const shopUser = {
      _id: { toString: () => '507f1f77bcf86cd799439011' },
      email: 'shop@example.com',
      accountType: 'shop',
      accountStatus: 'pending_approval',
      shopDetails: { shopName: 'Example Repairs' },
    } as unknown as UserDocument;

    await expect(
      service.ensureShopRequestForUser(shopUser),
    ).rejects.toMatchObject({
      status: 503,
      response: {
        message:
          'This pending shop account is missing required registration details. Please contact support to complete your application.',
      },
    });
    expect(registrationRequestsModel.create).not.toHaveBeenCalled();
  });

  it('reuses an existing Shop registration instead of creating another', async () => {
    existingRequestQuery.exec.mockResolvedValue(createdRequest);
    const shopUser = {
      _id: { toString: () => '507f1f77bcf86cd799439011' },
      email: 'shop@example.com',
      fullName: 'Shop Owner',
      countryCode: '+91',
      mobileNumber: '9876543210',
      accountType: 'shop',
      accountStatus: 'pending_approval',
      shopDetails: {
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
      },
    } as unknown as UserDocument;

    await expect(service.ensureShopRequestForUser(shopUser)).resolves.toBe(
      createdRequest,
    );
    expect(registrationRequestsModel.create).not.toHaveBeenCalled();
    expect(session.withTransaction).not.toHaveBeenCalled();
  });
});
