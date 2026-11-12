import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { User } from './schemas/user.schema';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  const user = {
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    id: '507f1f77bcf86cd799439011',
    email: 'person@example.com',
    passwordHash: 'bcrypt-hash',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const emailQuery = {
    select: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(user),
  };
  const idQuery = { exec: jest.fn().mockResolvedValue(user) };
  const authIdQuery = {
    select: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(user),
  };
  const updateQuery = { exec: jest.fn().mockResolvedValue(user) };
  const model = {
    create: jest.fn().mockResolvedValue(user),
    findOne: jest.fn().mockReturnValue(emailQuery),
    findById: jest.fn().mockReturnValue(idQuery),
    findByIdForAuthentication: jest.fn(),
    findByIdAndUpdate: jest.fn().mockReturnValue(updateQuery),
    findOneAndUpdate: jest.fn().mockReturnValue(updateQuery),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: model },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('normalizes email before creating a user', async () => {
    await service.create('  Person@Example.com ', 'bcrypt-hash');

    expect(model.create).toHaveBeenCalledWith({
      email: 'person@example.com',
      passwordHash: 'bcrypt-hash',
    });
  });

  it('normalizes email while saving registration account details', async () => {
    await service.createRegistrationAccount({
      email: '  Shop@Example.com ',
      passwordHash: 'bcrypt-hash',
      firstName: 'Shop',
      lastName: 'Owner',
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
    });

    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'shop@example.com',
        accountType: 'shop',
        accountStatus: 'pending_approval',
        mobileNumber: '9876543210',
      }),
    );
  });

  it('stores an opted-in Firebase token on the new user account', async () => {
    await service.createRegistrationAccount({
      email: 'person@example.com',
      passwordHash: 'bcrypt-hash',
      accountType: 'customer',
      accountStatus: 'pending_approval',
      notificationToken: 'firebase-device-token-value-1234567890',
    });

    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'person@example.com',
        notificationTokens: ['firebase-device-token-value-1234567890'],
      }),
    );
  });

  it('selects the password hash only for authentication lookup', async () => {
    await service.findByEmailForAuthentication(' Person@Example.com ');

    expect(model.findOne).toHaveBeenCalledWith({ email: 'person@example.com' });
    expect(emailQuery.select).toHaveBeenCalledWith('+passwordHash');
  });

  it('loads a user by a valid MongoDB ObjectId', async () => {
    await service.findById('507f1f77bcf86cd799439011');

    expect(model.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
  });

  it('returns no user for an invalid MongoDB ObjectId', async () => {
    await expect(service.findById('not-an-object-id')).resolves.toBeNull();
    expect(model.findById).not.toHaveBeenCalled();
  });

  it('selects the password hash only for password-change authentication', async () => {
    model.findById.mockReturnValue(authIdQuery);
    await service.findByIdForAuthentication('507f1f77bcf86cd799439011');
    expect(model.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(authIdQuery.select).toHaveBeenCalledWith('+passwordHash');
  });

  it('updates the password hash without returning it', async () => {
    await service.updatePasswordHash(
      '507f1f77bcf86cd799439011',
      'new-bcrypt-hash',
    );
    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      { $set: { passwordHash: 'new-bcrypt-hash' } },
      { new: true, runValidators: true },
    );
  });

  it('updates only the supplied profile fields and returns the saved user', async () => {
    await service.updateProfile('507f1f77bcf86cd799439011', {
      firstName: 'Updated',
      lastName: 'Name',
      profileImageData: 'data:image/png;base64,abc',
    });

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      {
        $set: {
          firstName: 'Updated',
          lastName: 'Name',
          profileImageData: 'data:image/png;base64,abc',
        },
      },
      { new: true, runValidators: true },
    );
    await expect(
      service.updateProfile('not-an-object-id', {
        firstName: 'In',
        lastName: 'Valid',
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('updates shop image data only for shop accounts', async () => {
    const shopImageData = 'data:image/png;base64,abc';
    await service.updateShopImage('507f1f77bcf86cd799439011', shopImageData);

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: '507f1f77bcf86cd799439011', accountType: 'shop' },
      { $set: { 'shopDetails.shopImageData': shopImageData } },
      { new: true, runValidators: true },
    );
  });

  it('updates only shop name and address fields for shop accounts', async () => {
    const updates = {
      shopName: '  Updated Repairs  ',
      address: '  Main Road  ',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '411001',
      landmark: '',
      location: { latitude: 18.52, longitude: 73.85 },
    };
    await service.updateShopBusinessDetails(
      '507f1f77bcf86cd799439011',
      updates,
    );

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: '507f1f77bcf86cd799439011', accountType: 'shop' },
      {
        $set: {
          'shopDetails.shopName': 'Updated Repairs',
          'shopDetails.address': 'Main Road',
          'shopDetails.city': 'Pune',
          'shopDetails.state': 'Maharashtra',
          'shopDetails.postalCode': '411001',
          'shopDetails.landmark': '',
          'shopDetails.location': { latitude: 18.52, longitude: 73.85 },
        },
      },
      { new: true, runValidators: true },
    );
  });
});
