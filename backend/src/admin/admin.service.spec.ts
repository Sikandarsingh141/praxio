import { Types } from 'mongoose';
import { RegistrationRequest } from '../registrations/schemas/registration-request.schema';
import { User } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  const usersService = {
    findById: jest.fn(),
    findPendingShopAccounts: jest.fn(),
    updatePendingShopStatus: jest.fn(),
    updateRegistrationAccountStatus: jest.fn(),
  };
  const session = {
    withTransaction: jest.fn(),
    endSession: jest.fn().mockResolvedValue(undefined),
  };
  const connection = { startSession: jest.fn().mockResolvedValue(session) };
  const pendingRequest = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439012'),
    userId: new Types.ObjectId('507f1f77bcf86cd799439011'),
    accountType: 'customer',
    registrationStatus: 'pending',
    paymentStatus: 'not_required',
  };
  const requestQuery = {
    session: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(pendingRequest),
  };
  const updateQuery = {
    exec: jest.fn().mockResolvedValue({
      ...pendingRequest,
      registrationStatus: 'approved',
    }),
  };
  const userLookupQuery = {
    session: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  };
  const statusUpdateQuery = { exec: jest.fn() };
  const registrationRequests = {
    findOne: jest.fn().mockReturnValue(requestQuery),
    findOneAndUpdate: jest.fn().mockReturnValue(updateQuery),
    aggregate: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        {
          _id: pendingRequest._id,
          userId: pendingRequest.userId,
          registrationNumber: 'PRX-20260101-ABCDEF',
          applicantName: 'Customer Example',
          shopName: null,
          email: 'customer@example.com',
          countryCode: '+1',
          mobileNumber: '5551234567',
          accountType: 'customer',
          accountStatus: 'active',
          registrationStatus: 'approved',
          submittedAt: new Date('2026-01-01T00:00:00.000Z'),
          reviewedAt: new Date('2026-01-02T00:00:00.000Z'),
          declineReason: null,
        },
      ]),
    }),
  };
  const usersModel = {
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
    findById: jest.fn().mockReturnValue(userLookupQuery),
    findOneAndUpdate: jest.fn().mockReturnValue(statusUpdateQuery),
  };
  const auditLogs = {
    create: jest.fn().mockResolvedValue(undefined),
    find: jest.fn(),
    aggregate: jest.fn(),
  };
  const historyQuery = {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  };
  const repairRequestsModel = {
    find: jest.fn().mockReturnValue(historyQuery),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
  };
  const repairQuotationsModel = {
    find: jest.fn().mockReturnValue(historyQuery),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
  };
  const repairReviewsModel = {
    countDocuments: jest
      .fn()
      .mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
    aggregate: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    }),
  };
  const notificationsService = {
    notifyShopOfRegistrationDecision: jest.fn().mockResolvedValue(undefined),
    notifyApplicantOfRegistrationDecision: jest
      .fn()
      .mockResolvedValue(undefined),
    sendRegistrationDecision: jest.fn().mockResolvedValue(undefined),
    notifyUsers: jest.fn().mockResolvedValue(undefined),
  };
  const service = new AdminService(
    usersService as unknown as UsersService,
    usersModel as unknown as import('mongoose').Model<User>,
    registrationRequests as unknown as import('mongoose').Model<RegistrationRequest>,
    auditLogs as unknown as import('mongoose').Model<
      import('./schemas/admin-audit-log.schema').AdminAuditLog
    >,
    repairRequestsModel as unknown as import('mongoose').Model<
      import('../customer/repair-request.schema').RepairRequest
    >,
    repairQuotationsModel as unknown as import('mongoose').Model<
      import('../customer/repair-request.schema').RepairQuotation
    >,
    connection as unknown as import('mongoose').Connection,
    notificationsService as unknown as NotificationsService,
    repairReviewsModel as unknown as import('mongoose').Model<
      import('../customer/repair-request.schema').RepairReview
    >,
  );
  const pendingShop = {
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    fullName: 'Shop Owner',
    email: 'shop@example.com',
    countryCode: '+91',
    mobileNumber: '9876543210',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    passwordHash: 'must-not-be-returned',
    shopDetails: {
      shopName: 'Example Repairs',
      services: ['AC Repair'],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repairReviewsModel.countDocuments.mockReturnValue({
      exec: jest.fn().mockResolvedValue(0),
    });
    repairReviewsModel.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });
    session.withTransaction.mockImplementation(
      async (callback: () => Promise<unknown>) => callback(),
    );
    requestQuery.exec.mockResolvedValue(pendingRequest);
    userLookupQuery.exec.mockResolvedValue({
      _id: pendingRequest.userId,
      accountType: 'customer',
      accountStatus: 'active',
      accountLifecycleStatus: 'active',
    });

    statusUpdateQuery.exec.mockResolvedValue({ _id: pendingRequest.userId });
    pendingRequest.accountType = 'customer';
    pendingRequest.paymentStatus = 'not_required';
    updateQuery.exec.mockResolvedValue({
      ...pendingRequest,
      registrationStatus: 'approved',
    });
    registrationRequests.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        {
          _id: pendingRequest._id,
          userId: pendingRequest.userId,
          registrationNumber: 'PRX-20260101-ABCDEF',
          applicantName: 'Customer Example',
          shopName: null,
          email: 'customer@example.com',
          countryCode: '+1',
          mobileNumber: '5551234567',
          accountType: 'customer',
          accountStatus: 'active',
          registrationStatus: 'approved',
          submittedAt: new Date('2026-01-01T00:00:00.000Z'),
          reviewedAt: new Date('2026-01-02T00:00:00.000Z'),
          declineReason: null,
        },
      ]),
    });
    usersModel.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        {
          requests: [
            {
              _id: pendingRequest.userId,
              userId: pendingRequest.userId,
              registrationRequestId: pendingRequest._id,
              registrationNumber: 'PRX-20260101-ABCDEF',
              applicantName: 'Customer Example',
              shopName: null,
              email: 'customer@example.com',
              countryCode: '+1',
              mobileNumber: '5551234567',
              accountType: 'customer',
              accountStatus: null,
              registrationStatus: 'pending',
              submittedAt: new Date('2026-01-01T00:00:00.000Z'),
              reviewedAt: null,
              declineReason: null,
            },
          ],
          metadata: [{ total: 1 }],
        },
      ]),
    });
  });

  it('lists only confirmed repair jobs and applies the requested workflow filter', async () => {
    const jobsQuery = {
      exec: jest
        .fn()
        .mockResolvedValue([
          {
            jobs: [{ _id: new Types.ObjectId(), repairJob: { status: 'completed' } }],
            metadata: [{ total: 1 }],
          },
        ]),
    };
    repairRequestsModel.aggregate.mockReturnValue(jobsQuery);

    const result = await service.getRepairJobMonitor({
      status: 'completed',
      requestId: '507f1f77bcf86cd799439015',
      page: 2,
      limit: 10,
    });

    expect(result).toMatchObject({ page: 2, limit: 10, total: 1 });
    expect(result.jobs).toHaveLength(1);
    const pipeline = repairRequestsModel.aggregate.mock.calls[0][0];
    expect(pipeline[0]).toEqual({
      $match: expect.objectContaining({
        _id: new Types.ObjectId('507f1f77bcf86cd799439015'),
        acceptedQuotationId: { $exists: true },
        'repairJob.status': 'completed',
      }),
    });
    expect(pipeline.at(-1)).toEqual({
      $facet: expect.objectContaining({
        jobs: expect.arrayContaining([{ $skip: 10 }, { $limit: 10 }]),
      }),
    });
    expect(pipeline[1].$lookup).toMatchObject({
      pipeline: [
        {
          $project: {
            fullName: 1,
            email: 1,
            countryCode: 1,
            mobileNumber: 1,
          },
        },
      ],
    });
    expect(pipeline[5].$lookup).toMatchObject({
      pipeline: [
        {
          $project: {
            shopDetails: 1,
            fullName: 1,
            email: 1,
            countryCode: 1,
            mobileNumber: 1,
          },
        },
      ],
    });
    const jobProjection = pipeline.at(-1)?.$facet.jobs[3].$project;
    expect(jobProjection).toMatchObject({
      serviceType: 1,
      preferredServiceDate: 1,
      quotation: {
        amount: '$quotation.amount',
        proposedSolution: '$quotation.proposedSolution',
      },
      shop: {
        email: '$shop.email',
        mobileNumber: '$shop.mobileNumber',
      },
      repairJob: {
        inspection: {
          findings: 1,
          parts: 1,
        },
        history: 1,
      },
    });
  });

  it('filters repair jobs by date and escaped search across repair, customer, and shop fields', async () => {
    repairRequestsModel.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([{ jobs: [], metadata: [{ total: 0 }] }]),
    });

    await service.getRepairJobMonitor({
      search: 'AC (repair)',
      from: '2026-01-01',
      to: '2026-01-31',
    });

    const pipeline = repairRequestsModel.aggregate.mock.calls[0][0];
    expect(pipeline[0].$match).toEqual(
      expect.objectContaining({
        createdAt: {
          $gte: new Date('2026-01-01T00:00:00.000Z'),
          $lte: new Date('2026-01-31T23:59:59.999Z'),
        },
      }),
    );
    expect(pipeline).toContainEqual({
      $match: {
        $or: expect.arrayContaining([
          { appliance: /AC \(repair\)/i },
          { 'customer.email': /AC \(repair\)/i },
          { 'shop.shopDetails.shopName': /AC \(repair\)/i },
        ]),
      },
    });
  });

  it('rejects invalid repair status filters and review page sizes', async () => {
    await expect(
      service.getRepairJobMonitor({ status: 'not-a-status' }),
    ).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      service.getRepairReviewMonitor({ page: 1, limit: 101 }),
    ).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      service.getRepairJobMonitor({ requestId: 'invalid-id' }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.getRepairJobMonitor({ from: '2026-02-01', to: '2026-01-01' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(repairRequestsModel.aggregate).not.toHaveBeenCalled();
    expect(repairReviewsModel.aggregate).not.toHaveBeenCalled();
  });

  it('returns only public shop application details', async () => {
    usersService.findPendingShopAccounts.mockResolvedValue([pendingShop]);

    await expect(service.getPendingShops()).resolves.toEqual([
      {
        id: '507f1f77bcf86cd799439011',
        ownerName: 'Shop Owner',
        email: 'shop@example.com',
        countryCode: '+91',
        mobileNumber: '9876543210',
        createdAt: pendingShop.createdAt,
        shop: pendingShop.shopDetails,
      },
    ]);
  });

  it('lists customer and shop accounts with their registration status', async () => {
    await expect(
      service.getUsers({
        page: 1,
        limit: 10,
        status: 'pending',
        accountType: 'customer',
      }),
    ).resolves.toMatchObject({
      total: 1,
      requests: [
        {
          email: 'customer@example.com',
          accountType: 'customer',
          accountStatus: null,
          registrationStatus: 'pending',
          registrationRequestId: pendingRequest._id.toString(),
        },
      ],
    });
    expect(usersModel.aggregate).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid dashboard date filters before querying analytics', async () => {
    await expect(
      service.getDashboardOverview('2026-02-30', '2026-03-01'),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('returns an empty but valid date-filtered dashboard overview', async () => {
    const emptyResult = () => ({ exec: jest.fn().mockResolvedValue([]) });
    const emptyCount = () => ({ exec: jest.fn().mockResolvedValue(0) });
    usersModel.aggregate.mockReturnValue(emptyResult());
    usersModel.countDocuments.mockReturnValue(emptyCount());
    repairRequestsModel.aggregate.mockReturnValue(emptyResult());
    repairRequestsModel.countDocuments.mockReturnValue(emptyCount());
    repairQuotationsModel.aggregate.mockReturnValue(emptyResult());
    repairQuotationsModel.countDocuments.mockReturnValue(emptyCount());
    auditLogs.aggregate.mockReturnValue(emptyResult());

    const overview = await service.getDashboardOverview(
      '2026-03-01',
      '2026-03-07',
    );

    expect(overview.range).toEqual({
      from: '2026-03-01T00:00:00.000Z',
      to: '2026-03-07T23:59:59.999Z',
    });
    expect(overview.repairs.completionRate).toBe(0);
    expect(overview.quotations.acceptanceRate).toBe(0);
    expect(overview.revenue.available).toBe(false);
    expect(overview.trends).toHaveLength(7);
    expect(overview.recentActivities).toEqual([]);
  });

  it('returns a safe user profile with shop, registration, and map details', async () => {
    const userId = new Types.ObjectId('507f1f77bcf86cd799439011');
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    usersService.findById.mockResolvedValue({
      _id: userId,
      fullName: 'Shop Owner',
      email: 'shop@example.com',
      countryCode: '+91',
      mobileNumber: '9876543210',
      accountType: 'shop',
      accountStatus: 'active',
      createdAt,
      passwordHash: 'must-not-be-returned',
      shopDetails: {
        shopName: 'Example Repairs',
        businessType: 'Repair',
        description: 'Repair services',
        yearsOfExperience: 5,
        address: 'Main Road',
        city: 'Delhi',
        state: 'Delhi',
        postalCode: '110001',
        landmark: '',
        services: ['AC Repair'],
        location: { latitude: 28.6139, longitude: 77.209 },
      },
    });

    requestQuery.exec.mockResolvedValue({
      registrationNumber: 'PRX-20260101-ABCDEF',
      registrationStatus: 'approved',
      submittedAt: createdAt,
      reviewedAt: createdAt,
      paymentStatus: 'paid',
      paymentAmountCents: 2900,
      paymentCurrency: 'usd',
      paidAt: createdAt,
    });

    const profile = await service.getUserDetails(userId.toString());

    expect(profile).toMatchObject({
      id: userId.toString(),
      fullName: 'Shop Owner',
      accountType: 'shop',
      location: { latitude: 28.6139, longitude: 77.209 },
      shop: {
        shopName: 'Example Repairs',
        services: ['AC Repair'],
      },
      registration: {
        registrationNumber: 'PRX-20260101-ABCDEF',
        status: 'approved',
        paymentStatus: 'paid',
      },
    });
    expect(profile).not.toHaveProperty('passwordHash');
    expect(usersService.findById).toHaveBeenCalledWith(userId.toString());
    expect(registrationRequests.findOne).toHaveBeenCalledWith({
      userId,
    });
  });

  it('marks an accepted repair as active and keeps its repair workflow status', async () => {
    const userId = new Types.ObjectId('507f1f77bcf86cd799439011');
    const acceptedQuotationId = new Types.ObjectId('507f1f77bcf86cd799439016');
    usersService.findById.mockResolvedValue({
      _id: userId,
      fullName: 'Shop Owner',
      email: 'shop@example.com',
      accountType: 'shop',
      accountStatus: 'active',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      shopDetails: { shopName: 'Example Repairs' },
    });
    requestQuery.exec.mockResolvedValue(null);
    historyQuery.exec.mockResolvedValue([
      {
        _id: new Types.ObjectId('507f1f77bcf86cd799439014'),
        appliance: 'Washing machine',
        description: 'Not draining',
        status: 'open',
        repairJob: {
          status: 'confirmed',
          acceptedQuotationId,
        },
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]);
    repairQuotationsModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        {
          _id: acceptedQuotationId,
          repairRequestId: new Types.ObjectId('507f1f77bcf86cd799439014'),
          amount: 1500,
          currency: 'INR',
          status: 'accepted',
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ]),
    });

    const profile = await service.getUserDetails(userId.toString());

    expect(profile.repairActivity[0]).toMatchObject({
      status: 'active',
      repairStatus: 'confirmed',
    });
  });

  it('suspends an approved account atomically, audits it, and notifies the intended user', async () => {
    requestQuery.exec.mockResolvedValue({ registrationStatus: 'approved' });

    await expect(
      service.updateUserStatus(
        pendingRequest.userId.toString(),
        '507f1f77bcf86cd799439013',
        'suspended',
        'Repeated policy violations',
      ),
    ).resolves.toEqual({ accountStatus: 'suspended' });

    expect(usersModel.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: pendingRequest.userId,
        accountLifecycleStatus: 'active',
      },
      { $set: { accountLifecycleStatus: 'suspended' } },
      expect.objectContaining({ session }),
    );
    expect(auditLogs.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          action: 'account_suspended',
          previousAccountStatus: 'active',
          newAccountStatus: 'suspended',
          reason: 'Repeated policy violations',
        }),
      ],
      { session },
    );
    expect(notificationsService.notifyUsers).toHaveBeenCalledWith(
      [pendingRequest.userId],
      expect.objectContaining({
        type: 'account_suspended',
        relatedEntityType: 'user_account',
      }),
    );
  });

  it('rejects account status changes for registrations that are not approved', async () => {
    requestQuery.exec.mockResolvedValue({ registrationStatus: 'pending' });

    await expect(
      service.updateUserStatus(
        pendingRequest.userId.toString(),
        '507f1f77bcf86cd799439013',
        'suspended',
        'Reason',
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(usersModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(auditLogs.create).not.toHaveBeenCalled();
  });

  it('returns not found for missing user profiles', async () => {
    usersService.findById.mockResolvedValue(null);

    await expect(
      service.getUserDetails('507f1f77bcf86cd799439011'),
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it('blocks approval of legacy shop accounts without verified payment', async () => {
    requestQuery.exec.mockResolvedValue(null);

    await expect(
      service.approveShop('507f1f77bcf86cd799439011'),
    ).rejects.toMatchObject({
      status: 409,
      response: { message: 'Shop registration must be paid before approval' },
    });

    expect(usersService.updatePendingShopStatus).not.toHaveBeenCalled();
  });

  it('rejects a pending shop through the user persistence service', async () => {
    requestQuery.exec.mockResolvedValue(null);
    usersService.updatePendingShopStatus.mockResolvedValue({
      ...pendingShop,
      accountStatus: 'rejected',
    });

    await service.rejectShop(
      '507f1f77bcf86cd799439011',
      '507f1f77bcf86cd799439013',
      'Incomplete documents',
    );

    expect(usersService.updatePendingShopStatus).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      'rejected',
      session,
    );
  });

  it('does not approve a legacy application without a registration payment record', async () => {
    requestQuery.exec.mockResolvedValue(null);
    usersService.updatePendingShopStatus.mockResolvedValue(null);

    await expect(
      service.approveShop('507f1f77bcf86cd799439011'),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('approves a new customer registration and activates the account in one transaction', async () => {
    usersService.updateRegistrationAccountStatus.mockResolvedValue(true);

    const result = await service.approveRegistration(
      pendingRequest._id.toString(),
      '507f1f77bcf86cd799439013',
    );

    expect(registrationRequests.findOne).toHaveBeenCalledWith({
      _id: pendingRequest._id.toString(),
      registrationStatus: { $in: ['pending', 'approved', 'declined'] },
    });

    expect(registrationRequests.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(usersService.updateRegistrationAccountStatus).toHaveBeenCalledWith(
      pendingRequest.userId.toString(),
      'customer',
      'active',
      session,
    );
    expect(result.accountStatus).toBe('active');
    expect(result.registrationStatus).toBe('approved');
    expect(session.endSession).toHaveBeenCalled();
    expect(auditLogs.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          action: 'registration_approved',
          previousApprovalStatus: 'pending',
          newApprovalStatus: 'approved',
        }),
      ],
      { session },
    );
  });

  it('does not approve an unpaid shop registration', async () => {
    pendingRequest.accountType = 'shop';
    pendingRequest.paymentStatus = 'unpaid';
    requestQuery.exec.mockResolvedValue(pendingRequest);

    await expect(
      service.approveRegistration(
        pendingRequest._id.toString(),
        '507f1f77bcf86cd799439013',
      ),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        message: 'Shop registration must be paid before approval',
      },
    });

    expect(registrationRequests.findOneAndUpdate).not.toHaveBeenCalled();
    pendingRequest.accountType = 'customer';
    pendingRequest.paymentStatus = 'not_required';
  });

  it('sends an approval notification to a paid shop owner within the review transaction', async () => {
    pendingRequest.accountType = 'shop';
    pendingRequest.paymentStatus = 'paid';
    requestQuery.exec.mockResolvedValue(pendingRequest);
    usersService.updateRegistrationAccountStatus.mockResolvedValue(true);
    registrationRequests.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        {
          _id: pendingRequest._id,
          userId: pendingRequest.userId,
          registrationNumber: 'PRX-20260101-ABCDEF',
          applicantName: 'Shop Owner',
          shopName: 'Example Repairs',
          email: 'shop@example.com',
          accountType: 'shop',
          accountStatus: 'active',
          registrationStatus: 'approved',
          paymentStatus: 'paid',
          submittedAt: new Date('2026-01-01T00:00:00.000Z'),
          reviewedAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      ]),
    });

    await service.approveRegistration(
      pendingRequest._id.toString(),
      '507f1f77bcf86cd799439013',
    );

    expect(
      notificationsService.notifyApplicantOfRegistrationDecision,
    ).toHaveBeenCalledWith(
      pendingRequest.userId,
      pendingRequest._id,
      'shop',
      'approved',
      undefined,
      session,
    );
    expect(notificationsService.sendRegistrationDecision).toHaveBeenCalledWith(
      pendingRequest.userId,
      pendingRequest._id,
      'shop',
      'approved',
      undefined,
    );
    pendingRequest.accountType = 'customer';
    pendingRequest.paymentStatus = 'not_required';
  });

  it('rejects a repeated decision without writing another review', async () => {
    pendingRequest.registrationStatus = 'approved';

    await expect(
      service.approveRegistration(
        pendingRequest._id.toString(),
        '507f1f77bcf86cd799439013',
      ),
    ).rejects.toMatchObject({ status: 409 });

    expect(registrationRequests.findOneAndUpdate).not.toHaveBeenCalled();
    expect(usersService.updateRegistrationAccountStatus).not.toHaveBeenCalled();
    pendingRequest.registrationStatus = 'pending';
  });

  it('keeps registration unchanged when the account status update fails', async () => {
    usersService.updateRegistrationAccountStatus.mockResolvedValue(false);

    await expect(
      service.approveRegistration(
        pendingRequest._id.toString(),
        '507f1f77bcf86cd799439013',
      ),
    ).rejects.toMatchObject({ status: 409 });

    expect(session.endSession).toHaveBeenCalled();
  });

  it('does not re-approve a declined registration through the review workflow', async () => {
    pendingRequest.registrationStatus = 'declined';
    await expect(
      service.approveRegistration(
        pendingRequest._id.toString(),
        '507f1f77bcf86cd799439013',
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(registrationRequests.findOneAndUpdate).not.toHaveBeenCalled();
    expect(usersService.updateRegistrationAccountStatus).not.toHaveBeenCalled();
    pendingRequest.registrationStatus = 'pending';
  });

  it('does not decline an already approved registration', async () => {
    pendingRequest.registrationStatus = 'approved';
    await expect(
      service.declineRegistration(
        pendingRequest._id.toString(),
        '507f1f77bcf86cd799439013',
        { reason: 'Eligibility could not be verified.' },
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(registrationRequests.findOneAndUpdate).not.toHaveBeenCalled();
    expect(usersService.updateRegistrationAccountStatus).not.toHaveBeenCalled();
    pendingRequest.registrationStatus = 'pending';
  });
});
