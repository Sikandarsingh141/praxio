import { Types } from 'mongoose';
import { RegistrationRequest } from '../registrations/schemas/registration-request.schema';
import { User } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ShopSubscriptionInvoice } from '../payments/schemas/shop-subscription-invoice.schema';
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
    find: jest.fn(),
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
  const financialQuery = {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  };
  const subscriptionInvoices = {
    find: jest.fn().mockReturnValue(financialQuery),
  };
  const usersModel = {
    aggregate: jest.fn(),
    countDocuments: jest.fn(),
    findById: jest.fn().mockReturnValue(userLookupQuery),
    find: jest.fn().mockReturnValue(financialQuery),
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
    subscriptionInvoices as unknown as import('mongoose').Model<ShopSubscriptionInvoice>,
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
    financialQuery.exec.mockResolvedValue([]);
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
    registrationRequests.find.mockReturnValue(financialQuery);
    subscriptionInvoices.find.mockReturnValue(financialQuery);
    usersModel.find.mockReturnValue(financialQuery);
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

  it('lists completed repairs from either persisted completion status', async () => {
    const jobsQuery = {
      exec: jest.fn().mockResolvedValue([
        {
          jobs: [
            { _id: new Types.ObjectId(), repairJob: { status: 'completed' } },
          ],
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
        $or: [
          {
            $and: [
              { 'repairJob.status': 'completed' },
              { acceptedQuotationId: { $exists: true } },
            ],
          },
          {
            $and: [
              { 'repairJob.status': { $exists: false } },
              { status: 'completed' },
            ],
          },
        ],
      }),
    });
    expect(pipeline).toContainEqual({
      $addFields: {
        repairJob: {
          $cond: [
            {
              $and: [
                { $eq: ['$status', 'completed'] },
                {
                  $eq: [{ $ifNull: ['$repairJob.status', null] }, null],
                },
              ],
            },
            {
              $mergeObjects: [
                { $ifNull: ['$repairJob', {}] },
                { status: 'completed' },
              ],
            },
            '$repairJob',
          ],
        },
      },
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
        $cond: [
          { $ifNull: ['$quotation._id', false] },
          expect.objectContaining({
            amount: '$quotation.amount',
            proposedSolution: '$quotation.proposedSolution',
          }),
          null,
        ],
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

  it('includes request-level completed repairs in the all-status monitor', async () => {
    repairRequestsModel.aggregate.mockReturnValue({
      exec: jest
        .fn()
        .mockResolvedValue([{ jobs: [], metadata: [{ total: 0 }] }]),
    });

    await service.getRepairJobMonitor({ status: 'all' });

    const pipeline = repairRequestsModel.aggregate.mock.calls[0][0];
    expect(pipeline[0].$match).toEqual({
      $or: [
        {
          $and: [
            { 'repairJob.status': { $exists: true } },
            { acceptedQuotationId: { $exists: true } },
          ],
        },
        {
          $and: [
            { 'repairJob.status': { $exists: false } },
            { status: 'completed' },
          ],
        },
      ],
    });
  });

  it.each(['inspection_pending', 'disputed'])(
    'accepts the %s repair status filter',
    async (status) => {
      repairRequestsModel.aggregate.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue([{ jobs: [], metadata: [{ total: 0 }] }]),
      });

      await service.getRepairJobMonitor({ status });

      expect(repairRequestsModel.aggregate.mock.calls[0][0][0]).toEqual({
        $match: {
          'repairJob.status': status,
          acceptedQuotationId: { $exists: true },
        },
      });
    },
  );

  it('filters repair jobs by date and escaped search across repair, customer, and shop fields', async () => {
    repairRequestsModel.aggregate.mockReturnValue({
      exec: jest
        .fn()
        .mockResolvedValue([{ jobs: [], metadata: [{ total: 0 }] }]),
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
        ownerFirstName: 'Shop',
        ownerLastName: 'Owner',
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
        limit: 5,
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

  it('accepts five-item pages for the Shop account filter', async () => {
    await service.getUsers({
      page: 1,
      limit: 5,
      status: 'all',
      accountType: 'shop',
    });

    expect(usersModel.aggregate.mock.calls[0][0][0]).toEqual({
      $match: { accountType: 'shop' },
    });
  });

  it('keeps customer locations when filtering shops by approval in the all map view', async () => {
    await service.getUsers({
      page: 1,
      limit: 20,
      accountType: 'all',
      approvalStatus: 'pending',
      includeCustomersWithApprovalStatus: true,
    });

    expect(usersModel.aggregate.mock.calls[0][0]).toContainEqual({
      $match: {
        $or: [
          { accountType: 'customer' },
          { computedRegistrationStatus: 'pending' },
        ],
      },
    });
  });

  it('filters Active Repairs using the map statistics status definition', async () => {
    usersModel.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });
    repairRequestsModel.aggregate.mockImplementation(
      (pipeline: Array<Record<string, unknown>>) => ({
        exec: jest
          .fn()
          .mockResolvedValue(
            pipeline.some((stage) => '$facet' in stage)
              ? [{ entities: [], metadata: [{ total: 0 }] }]
              : [],
          ),
      }),
    );

    await service.getMapData({ type: 'requests', status: 'active' });

    const requestPipeline = repairRequestsModel.aggregate.mock.calls.find(
      ([pipeline]) =>
        (pipeline as Array<Record<string, unknown>>).some(
          (stage) => '$facet' in stage,
        ),
    )?.[0] as Array<Record<string, unknown>>;
    expect(requestPipeline).toContainEqual({
      $match: {
        mapStatus: {
          $nin: [
            'pending',
            'completed',
            'repair_declined',
            'disputed',
            'cancelled',
          ],
        },
      },
    });
  });

  it('returns all filtered valid request markers without list pagination', async () => {
    const requestId = new Types.ObjectId('507f1f77bcf86cd799439015');
    const requestPipeline = [
      {
        _id: requestId,
        appliance: 'Phone',
        mapStatus: 'pending',
        customerLatitude: 30.7,
        customerLongitude: 76.7,
      },
      {
        _id: new Types.ObjectId('507f1f77bcf86cd799439016'),
        appliance: 'Laptop',
        mapStatus: 'pending',
        customerLocation: { latitude: 43.65, longitude: -79.38 },
      },
      {
        _id: new Types.ObjectId('507f1f77bcf86cd799439017'),
        appliance: 'No coordinates',
        mapStatus: 'pending',
        customerLatitude: 91,
        customerLongitude: 0,
      },
    ];
    repairRequestsModel.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(requestPipeline),
    });

    const result = await service.getMapData({
      type: 'requests',
      mapOnly: true,
      page: 1,
      limit: 20,
      status: 'pending',
    });

    expect(result.markers).toEqual([
      {
        id: requestId.toString(),
        type: 'request',
        name: 'Phone',
        status: 'pending',
        location: { latitude: 30.7, longitude: 76.7 },
      },
      {
        id: '507f1f77bcf86cd799439016',
        type: 'request',
        name: 'Laptop',
        status: 'pending',
        location: { latitude: 43.65, longitude: -79.38 },
      },
    ]);
    expect(result.entities).toEqual([]);
    expect(usersModel.aggregate).not.toHaveBeenCalled();
    const pipeline = repairRequestsModel.aggregate.mock.calls[0][0];
    expect(pipeline).toContainEqual({ $match: { mapStatus: 'pending' } });
    expect(
      pipeline.some(
        (stage) => '$facet' in stage || '$skip' in stage || '$limit' in stage,
      ),
    ).toBe(false);
  });

  it('matches a displayed eight-character request ID during map search', async () => {
    usersModel.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });
    repairRequestsModel.aggregate.mockImplementation(
      (pipeline: Array<Record<string, unknown>>) => ({
        exec: jest
          .fn()
          .mockResolvedValue(
            pipeline.some((stage) => '$facet' in stage)
              ? [{ entities: [], metadata: [{ total: 0 }] }]
              : [],
          ),
      }),
    );

    await service.getMapData({
      type: 'requests',
      page: 1,
      limit: 20,
      search: '666E727C',
    });

    const requestPipeline = repairRequestsModel.aggregate.mock.calls.find(
      ([pipeline]) =>
        (pipeline as Array<Record<string, unknown>>).some(
          (stage) => '$facet' in stage,
        ),
    )?.[0] as Array<Record<string, unknown>>;
    const searchConditions = requestPipeline
      .filter(
        (stage) =>
          '$match' in stage &&
          typeof stage['$match'] === 'object' &&
          stage['$match'] !== null &&
          '$or' in stage['$match'],
      )
      .flatMap((stage) => {
        const match = stage['$match'] as {
          $or: Array<Record<string, unknown>>;
        };
        return match.$or;
      });
    expect(requestPipeline).toContainEqual({
      $addFields: { mapRequestIdText: { $toString: '$_id' } },
    });
    expect(searchConditions).toContainEqual({
      mapRequestIdText: { $regex: '666E727C$', $options: 'i' },
    });
  });

  it('rejects invalid dashboard date filters before querying analytics', async () => {
    await expect(
      service.getDashboardOverview('2026-02-30', '2026-03-01'),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('uses the repair workflow status as the admin dashboard status source', async () => {
    const emptyResult = () => ({ exec: jest.fn().mockResolvedValue([]) });
    const emptyCount = () => ({ exec: jest.fn().mockResolvedValue(0) });
    usersModel.aggregate.mockReturnValue(emptyResult());
    usersModel.countDocuments.mockReturnValue(emptyCount());
    repairRequestsModel.countDocuments.mockReturnValue(emptyCount());
    let dashboardStatusExpression: unknown;
    let recentRepairStatusExpression: unknown;
    repairRequestsModel.aggregate.mockImplementation(
      (pipeline: Array<Record<string, unknown>>) => {
        const statusStage = pipeline.find(
          (stage) =>
            '$addFields' in stage &&
            typeof stage['$addFields'] === 'object' &&
            stage['$addFields'] !== null &&
            'dashboardStatus' in
              (stage['$addFields'] as Record<string, unknown>),
        );
        if (statusStage) {
          dashboardStatusExpression = (
            statusStage['$addFields'] as Record<string, unknown>
          )['dashboardStatus'];
        }
        const recentRepairsStage = pipeline.find(
          (stage) =>
            '$project' in stage &&
            typeof stage['$project'] === 'object' &&
            stage['$project'] !== null &&
            'appliance' in (stage['$project'] as Record<string, unknown>),
        );
        if (recentRepairsStage) {
          recentRepairStatusExpression = (
            recentRepairsStage['$project'] as Record<string, unknown>
          ).status;
        }
        return {
          exec: jest.fn().mockResolvedValue(
            statusStage
              ? [
                  { _id: 'completed', count: 1 },
                  { _id: 'open', count: 2 },
                ]
              : [],
          ),
        };
      },
    );
    let completedShopStatusMatch: unknown;
    repairQuotationsModel.aggregate.mockImplementation(
      (pipeline: Array<Record<string, unknown>>) => {
        const completedMatch = pipeline.find(
          (stage) =>
            '$match' in stage &&
            typeof stage['$match'] === 'object' &&
            stage['$match'] !== null &&
            '$expr' in (stage['$match'] as Record<string, unknown>),
        );
        if (completedMatch) {
          completedShopStatusMatch = (
            completedMatch['$match'] as Record<string, unknown>
          ).$expr;
        }
        return emptyResult();
      },
    );
    repairQuotationsModel.countDocuments.mockReturnValue(emptyCount());
    auditLogs.aggregate.mockReturnValue(emptyResult());

    const overview = await service.getDashboardOverview(
      '2026-03-01',
      '2026-03-07',
    );

    expect(overview.repairs.completed).toBe(1);
    expect(overview.repairStatuses).toContainEqual({
      status: 'completed',
      count: 1,
    });
    expect(dashboardStatusExpression).toEqual({
      $ifNull: ['$repairJob.status', '$status'],
    });
    expect(recentRepairStatusExpression).toEqual({
      $ifNull: ['$repairJob.status', '$status'],
    });
    expect(completedShopStatusMatch).toEqual({
      $eq: [
        { $ifNull: ['$repair.repairJob.status', '$repair.status'] },
        'completed',
      ],
    });
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
    expect(overview.subscriptionFinancials.currencyTotals).toEqual([]);
    expect(overview.trends).toHaveLength(7);
    expect(overview.recentActivities).toEqual([]);
  });

  it('includes unpaid shop registrations in receivables and paid invoices in revenue', async () => {
    const emptyResult = () => ({ exec: jest.fn().mockResolvedValue([]) });
    const emptyCount = () => ({ exec: jest.fn().mockResolvedValue(0) });
    const queryResult = (value: unknown[]) => ({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(value),
    });
    usersModel.aggregate.mockReturnValue(emptyResult());
    usersModel.countDocuments.mockReturnValue(emptyCount());
    repairRequestsModel.aggregate.mockReturnValue(emptyResult());
    repairRequestsModel.countDocuments.mockReturnValue(emptyCount());
    repairQuotationsModel.aggregate.mockReturnValue(emptyResult());
    repairQuotationsModel.countDocuments.mockReturnValue(emptyCount());
    auditLogs.aggregate.mockReturnValue(emptyResult());

    const userId = new Types.ObjectId('507f1f77bcf86cd799439011');
    const registrationRequestId = new Types.ObjectId(
      '507f1f77bcf86cd799439012',
    );
    const checkoutInvoiceId = 'in_paid_initial';
    subscriptionInvoices.find.mockReturnValue(
      queryResult([
        {
          stripeInvoiceId: 'in_open_overdue',
          registrationRequestId,
          userId,
          totalAmountCents: 2900,
          amountPaidCents: 1000,
          refundedAmountCents: 0,
          currency: 'usd',
          status: 'open',
          generatedAt: new Date('2026-03-02T00:00:00.000Z'),
          dueAt: new Date('2026-03-05T00:00:00.000Z'),
          events: [
            {
              eventId: 'evt_failed',
              type: 'invoice.payment_failed',
              amountCents: 1900,
              currency: 'usd',
              status: 'open',
              occurredAt: new Date('2026-03-05T00:00:00.000Z'),
            },
          ],
        },
        {
          stripeInvoiceId: checkoutInvoiceId,
          registrationRequestId,
          userId,
          totalAmountCents: 2900,
          amountPaidCents: 2900,
          refundedAmountCents: 500,
          currency: 'usd',
          status: 'paid',
          generatedAt: new Date('2026-03-02T00:00:00.000Z'),
          paidAt: new Date('2026-03-02T00:00:00.000Z'),
          events: [
            {
              eventId: 'evt_paid',
              type: 'invoice.paid',
              amountCents: 2900,
              currency: 'usd',
              status: 'paid',
              occurredAt: new Date('2026-03-02T00:00:00.000Z'),
            },
          ],
        },
        {
          stripeInvoiceId: 'in_paid_without_event',
          registrationRequestId,
          userId,
          totalAmountCents: 2900,
          amountPaidCents: 2900,
          refundedAmountCents: 0,
          currency: 'usd',
          status: 'paid',
          generatedAt: new Date('2026-03-03T00:00:00.000Z'),
          paidAt: new Date('2026-03-03T00:00:00.000Z'),
          events: [],
        },
        {
          stripeInvoiceId: 'in_void',
          registrationRequestId,
          userId,
          totalAmountCents: 5000,
          amountPaidCents: 0,
          refundedAmountCents: 0,
          currency: 'usd',
          status: 'void',
          generatedAt: new Date('2026-03-02T00:00:00.000Z'),
          dueAt: new Date('2026-03-03T00:00:00.000Z'),
          events: [],
        },
        {
          stripeInvoiceId: 'in_draft',
          registrationRequestId,
          userId,
          totalAmountCents: 5000,
          amountPaidCents: 0,
          refundedAmountCents: 0,
          currency: 'usd',
          status: 'draft',
          generatedAt: new Date('2026-03-02T00:00:00.000Z'),
          events: [],
        },
      ]),
    );
    registrationRequests.find
      .mockReturnValueOnce(
        queryResult([
          {
            _id: registrationRequestId,
            userId,
            paymentAmountCents: 2900,
            paymentRefundedAmountCents: 400,
            paymentCurrency: 'usd',
            paidAt: new Date('2026-03-02T00:00:00.000Z'),
            stripeCheckoutInvoiceId: checkoutInvoiceId,
          },
          {
            _id: new Types.ObjectId('507f1f77bcf86cd799439013'),
            userId,
            paymentAmountCents: 2900,
            paymentRefundedAmountCents: 400,
            paymentCurrency: 'usd',
            paidAt: new Date('2026-03-03T00:00:00.000Z'),
          },
        ]),
      )
      .mockReturnValueOnce(
        queryResult([
          {
            _id: new Types.ObjectId('507f1f77bcf86cd799439014'),
            userId,
            paymentStatus: 'unpaid',
            paymentAmountCents: undefined,
            paymentCurrency: undefined,
            submittedAt: new Date('2026-03-04T00:00:00.000Z'),
          },
        ]),
      );
    usersModel.find.mockReturnValue(
      queryResult([{ _id: userId, shopDetails: { shopName: 'Amit Shop' } }]),
    );

    const overview = await service.getDashboardOverview(
      '2026-03-01',
      '2026-03-07',
    );

    expect(overview.subscriptionFinancials.currencyTotals).toEqual([
      {
        currency: 'USD',
        accountReceivableCents: 4800,
        overdueAmountCents: 1900,
        subscriptionRevenueCents: 7800,
      },
    ]);
    expect(
      overview.recentActivities.filter(
        (activity) => activity.type === 'subscription_payment_received',
      ),
    ).toHaveLength(2);
    expect(overview.recentActivities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: 'Subscription Payment Failed',
          relatedName: 'Amit Shop',
          amountCents: 1900,
          status: 'open',
        }),
        expect.objectContaining({
          description: 'Subscription Payment Overdue',
          relatedName: 'Amit Shop',
          amountCents: 1900,
          status: 'overdue',
        }),
        expect.objectContaining({
          description: 'Subscription Payment Received',
          amountCents: 2900,
          status: 'paid',
        }),
        expect.objectContaining({
          id: 'in_paid_without_event:paid',
          description: 'Subscription Payment Received',
          relatedName: 'Amit Shop',
          amountCents: 2900,
          status: 'paid',
        }),
        expect.objectContaining({
          description: 'Shop Subscription Purchased',
          relatedName: 'Amit Shop',
          amountCents: 2900,
          status: 'paid',
        }),
      ]),
    );
  });

  it('returns a safe user profile with shop, registration, and map details', async () => {
    const userId = new Types.ObjectId('507f1f77bcf86cd799439011');
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    usersService.findById.mockResolvedValue({
      _id: userId,
      firstName: 'Shop',
      lastName: 'Owner',
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
      firstName: 'Shop',
      lastName: 'Owner',
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
      accountType: 'shop',
    });
  });

  it.each([
    ['confirmed', 'active'],
    ['completed', 'completed'],
    ['repair_declined', 'open'],
  ])(
    'reports an accepted repair with %s workflow status as %s',
    async (repairStatus, expectedRequestStatus) => {
      const userId = new Types.ObjectId('507f1f77bcf86cd799439011');
      const acceptedQuotationId = new Types.ObjectId(
        '507f1f77bcf86cd799439016',
      );
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
            status: repairStatus,
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
        status: expectedRequestStatus,
        repairStatus,
      });
    },
  );

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

  it('allows customer account status changes without registration approval', async () => {
    requestQuery.exec.mockResolvedValue({ registrationStatus: 'pending' });

    await expect(
      service.updateUserStatus(
        pendingRequest.userId.toString(),
        '507f1f77bcf86cd799439013',
        'suspended',
        'Reason',
      ),
    ).resolves.toEqual({ accountStatus: 'suspended' });
    expect(registrationRequests.findOne).not.toHaveBeenCalled();
    expect(usersModel.findOneAndUpdate).toHaveBeenCalled();
    expect(auditLogs.create).toHaveBeenCalled();
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

  it('approves a paid Shop registration and activates the account in one transaction', async () => {
    pendingRequest.accountType = 'shop';
    pendingRequest.paymentStatus = 'paid';
    requestQuery.exec.mockResolvedValue(pendingRequest);
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
      'shop',
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
    pendingRequest.accountType = 'customer';
    pendingRequest.paymentStatus = 'not_required';
  });

  it('does not allow Admin approval or decline for customer accounts', async () => {
    pendingRequest.accountType = 'customer';
    pendingRequest.paymentStatus = 'not_required';
    requestQuery.exec.mockResolvedValue(pendingRequest);

    await expect(
      service.approveRegistration(
        pendingRequest._id.toString(),
        '507f1f77bcf86cd799439013',
      ),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        message: 'Customer accounts do not require registration approval',
      },
    });

    expect(registrationRequests.findOneAndUpdate).not.toHaveBeenCalled();
    expect(usersService.updateRegistrationAccountStatus).not.toHaveBeenCalled();
    expect(
      notificationsService.notifyApplicantOfRegistrationDecision,
    ).not.toHaveBeenCalled();
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
