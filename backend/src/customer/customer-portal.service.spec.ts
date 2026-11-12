import { getModelToken } from '@nestjs/mongoose';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { RegistrationRequest } from '../registrations/schemas/registration-request.schema';
import { User } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { CustomerPortalService } from './customer-portal.service';
import {
  RepairQuotation,
  RepairRequest,
  RepairReview,
} from './repair-request.schema';

function createQuery<T>(value: T) {
  const query = {
    select: jest.fn(),
    sort: jest.fn(),
    lean: jest.fn(),
    exec: jest.fn().mockResolvedValue(value),
  };
  query.select.mockReturnValue(query);
  query.sort.mockReturnValue(query);
  query.lean.mockReturnValue(query);
  return query;
}

describe('CustomerPortalService', () => {
  let service: CustomerPortalService;
  const nearShopId = new Types.ObjectId();
  const farShopId = new Types.ObjectId();
  const shops = [
    {
      _id: nearShopId,
      email: 'near@example.com',
      countryCode: '+91',
      mobileNumber: '1234567890',
      shopDetails: {
        shopName: 'Nearby Repair',
        businessType: 'Electronics Repair Shop',
        description: 'Home appliance service',
        yearsOfExperience: 5,
        services: ['AC Repair'],
        address: 'Main Road',
        area: 'Central',
        city: 'Pune',
        state: 'Maharashtra',
        postalCode: '411001',
        location: { latitude: 18.52, longitude: 73.85 },
      },
    },
    {
      _id: farShopId,
      email: 'far@example.com',
      shopDetails: {
        shopName: 'Far Repair',
        businessType: 'Electronics Repair Shop',
        description: 'Home appliance service',
        yearsOfExperience: 8,
        services: ['AC Repair'],
        address: 'Hill Road',
        area: 'West',
        city: 'Pune',
        state: 'Maharashtra',
        postalCode: '411045',
        location: { latitude: 18.6, longitude: 73.9 },
      },
    },
  ];
  const userModel = { find: jest.fn(), findById: jest.fn() };
  const registrationModel = { find: jest.fn(), findOne: jest.fn() };
  const repairRequestModel = {
    aggregate: jest.fn().mockReturnValue(createQuery([])),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  };
  const quotationModel = {
    aggregate: jest.fn().mockReturnValue(createQuery([])),
    create: jest.fn(),
    exists: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
    find: jest.fn(),
    updateMany: jest.fn(),
  };
  const reviewModel = {
    aggregate: jest.fn().mockReturnValue(createQuery([])),
    findOne: jest.fn().mockReturnValue(createQuery(null)),
    create: jest.fn(),
    deleteOne: jest.fn().mockReturnValue(createQuery({ deletedCount: 1 })),
  };
  const notificationsService = { notifyUsers: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    userModel.find.mockReturnValue(createQuery(shops));
    registrationModel.findOne.mockReturnValue(createQuery({}));
    quotationModel.findOne.mockReturnValue(createQuery(null));
    registrationModel.find.mockReturnValue(
      createQuery([{ userId: nearShopId }, { userId: farShopId }]),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerPortalService,
        { provide: getModelToken(User.name), useValue: userModel },
        {
          provide: getModelToken(RegistrationRequest.name),
          useValue: registrationModel,
        },
        {
          provide: getModelToken(RepairRequest.name),
          useValue: repairRequestModel,
        },
        {
          provide: getModelToken(RepairQuotation.name),
          useValue: quotationModel,
        },
        { provide: getModelToken(RepairReview.name), useValue: reviewModel },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'GOOGLE_APIKEY'
                ? 'test-google-api-key'
                : 'https://photon.komoot.io/api/',
            ),
          },
        },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();
    service = module.get(CustomerPortalService);
  });

  it('only lists active shops with approved, paid registrations and computes distance', async () => {
    const results = await service.searchShops({
      latitude: 18.52,
      longitude: 73.85,
      sort: 'nearest',
    });

    expect(userModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ accountType: 'shop', accountStatus: 'active' }),
    );
    expect(registrationModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        accountType: 'shop',
        registrationStatus: 'approved',
        paymentStatus: 'paid',
      }),
    );
    expect(results.map((shop) => shop.id)).toEqual([
      nearShopId.toString(),
      farShopId.toString(),
    ]);
    expect(results[0]?.distanceKm).toBe(0);
    expect(results[1]?.distanceKm).toBeGreaterThan(0);
    expect(results[0]?.rating).toBeNull();
    expect(results[0]?.availability).toBe('unknown');
  });

  it('filters by supported service, text terms, and distance without inventing distance', async () => {
    const results = await service.searchShops({
      query: 'Central Pune 411001',
      service: 'AC Repair',
      latitude: 18.52,
      longitude: 73.85,
      maxDistanceKm: 5,
    });

    expect(userModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ 'shopDetails.services': 'AC Repair' }),
    );
    expect(results.map((shop) => shop.id)).toEqual([nearShopId.toString()]);
    expect(results[0]?.distanceKm).toBe(0);
  });

  it('filters by minimum rating and sorts shops by rating and review count', async () => {
    reviewModel.aggregate.mockReturnValue(
      createQuery([
        { _id: nearShopId, averageRating: 4.2, reviewCount: 1 },
        { _id: farShopId, averageRating: 5, reviewCount: 2 },
      ]),
    );

    const results = await service.searchShops({
      minRating: 4,
      sort: 'rating',
    });
    expect(results.map((shop) => shop.id)).toEqual([
      farShopId.toString(),
      nearShopId.toString(),
    ]);

    const highRatingResults = await service.searchShops({
      minRating: 5,
      sort: 'relevant',
    });
    expect(highRatingResults.map((shop) => shop.id)).toEqual([
      farShopId.toString(),
    ]);
  });

  it('includes workflow status and shop ratings in customer quotation details', async () => {
    const customerId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    const shopId = new Types.ObjectId();
    userModel.findById.mockReturnValue(
      createQuery({
        _id: customerId,
        accountType: 'customer',
        accountStatus: 'active',
      }),
    );
    userModel.find.mockReturnValue(
      createQuery([
        {
          _id: shopId,
          shopDetails: { shopName: 'Nearby Repair', address: 'Main Road' },
        },
      ]),
    );
    repairRequestModel.find.mockReturnValue(
      createQuery([
        {
          _id: requestId,
          appliance: 'Mobile',
          description: 'Screen issue',
          status: 'completed',
          repairJob: { status: 'completed' },
        },
      ]),
    );
    quotationModel.find
      .mockReturnValueOnce(createQuery([]))
      .mockReturnValueOnce(
        createQuery([
          {
            _id: new Types.ObjectId(),
            repairRequestId: requestId,
            shopId,
            amount: 100,
            currency: 'INR',
            status: 'accepted',
            createdAt: new Date(),
          },
        ]),
      );
    reviewModel.aggregate.mockReturnValue(
      createQuery([{ _id: shopId, averageRating: 4.5, reviewCount: 2 }]),
    );

    const result = await service.getCustomerQuotations(customerId.toString(), {});

    expect(result).toMatchObject({
      quotations: [
        {
          shop: {
            rating: 4.5,
            reviewCount: 2,
          },
          repairRequest: {
            status: 'completed',
            repairJob: { status: 'completed' },
          },
        },
      ],
    });
  });

  it('requires both customer coordinates before applying a distance filter', async () => {
    await expect(
      service.searchShops({ latitude: 18.52, maxDistanceKm: 5 }),
    ).rejects.toThrow('Provide both coordinates');
  });

  it('applies customer repair-request status, appliance, and date filters', async () => {
    const customerId = new Types.ObjectId();
    const from = '2026-10-01';
    const to = '2026-10-31';
    userModel.findById.mockReturnValue(
      createQuery({
        _id: customerId,
        accountType: 'customer',
        accountStatus: 'active',
      }),
    );
    userModel.find.mockReturnValue(createQuery([]));
    repairRequestModel.find.mockReturnValue(createQuery([]));

    await service.getMyRepairRequests(customerId.toString(), {
      status: 'open',
      repairStatus: 'in_progress',
      appliance: 'AC.*',
      from,
      to,
    });

    const filter = repairRequestModel.find.mock.calls[0]?.[0];
    expect(filter).toMatchObject({
      customerId,
      status: 'open',
      'repairJob.status': 'in_progress',
      appliance: { $regex: 'AC\\.\\*', $options: 'i' },
    });
    expect(filter.createdAt.$gte).toEqual(new Date(from));
    expect(filter.createdAt.$lte).toBeInstanceOf(Date);
  });

  it('includes the authenticated customer request photos in their request list', async () => {
    const customerId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    const shopId = new Types.ObjectId();
    const photos = [
      { mimeType: 'image/png', data: 'data:image/png;base64,abc' },
    ];
    userModel.findById.mockReturnValue(
      createQuery({
        _id: customerId,
        accountType: 'customer',
        accountStatus: 'active',
      }),
    );
    userModel.find.mockReturnValue(
      createQuery([
        { _id: shopId, shopDetails: { shopName: 'Nearby Repair' } },
      ]),
    );
    repairRequestModel.find.mockReturnValue(
      createQuery([
        {
          _id: requestId,
          customerId,
          shopIds: [shopId],
          shopResponses: [{ shopId, status: 'new' }],
          photos,
        },
      ]),
    );
    quotationModel.find.mockReturnValue(createQuery([]));

    const result = await service.getMyRepairRequests(customerId.toString());

    expect(result[0]).toMatchObject({
      _id: requestId,
      photos,
      shops: [{ id: shopId.toString(), name: 'Nearby Repair' }],
    });
    expect(repairRequestModel.find).toHaveBeenCalledWith({
      customerId,
    });
  });

  it('returns request photos and selected shop responses in customer request details', async () => {
    const customerId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    const shopId = new Types.ObjectId();
    const photos = [
      { mimeType: 'image/png', data: 'data:image/png;base64,abc' },
    ];
    userModel.findById.mockReturnValue(
      createQuery({
        _id: customerId,
        accountType: 'customer',
        accountStatus: 'active',
      }),
    );
    repairRequestModel.findOne.mockReturnValue(
      createQuery({
        _id: requestId,
        customerId,
        shopIds: [shopId],
        shopResponses: [{ shopId, status: 'new' }],
        photos,
      }),
    );
    userModel.find.mockReturnValue(
      createQuery([
        { _id: shopId, shopDetails: { shopName: 'Nearby Repair' } },
      ]),
    );
    quotationModel.find.mockReturnValue(
      createQuery([
        {
          _id: new Types.ObjectId(),
          repairRequestId: requestId,
          amount: 1250,
          currency: 'INR',
          status: 'sent',
        },
      ]),
    );

    const result = await service.getCustomerRepairJob(
      customerId.toString(),
      requestId.toString(),
    );

    expect(result).toMatchObject({
      _id: requestId,
      photos,
      quotations: [{ amount: 1250, status: 'sent' }],
      shops: [
        {
          id: shopId.toString(),
          name: 'Nearby Repair',
          responseStatus: 'new',
        },
      ],
    });
    expect(repairRequestModel.findOne).toHaveBeenCalledWith({
      _id: requestId.toString(),
      customerId,
    });
    expect(quotationModel.find).toHaveBeenCalledWith({
      repairRequestId: requestId,
    });
  });

  it('rejects inverted customer repair-request date ranges', async () => {
    const customerId = new Types.ObjectId();
    userModel.findById.mockReturnValue(
      createQuery({
        _id: customerId,
        accountType: 'customer',
        accountStatus: 'active',
      }),
    );

    await expect(
      service.getMyRepairRequests(customerId.toString(), {
        from: '2026-10-31',
        to: '2026-10-01',
      }),
    ).rejects.toThrow('The start date cannot be after the end date.');
    expect(repairRequestModel.find).not.toHaveBeenCalled();
  });

  it('updates an open customer request atomically and notifies selected shops', async () => {
    const customerId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    const updatedRequest = {
      _id: requestId,
      toObject: () => ({ _id: requestId, photos: [{ data: 'private' }] }),
    };
    userModel.findById.mockReturnValue(
      createQuery({
        _id: customerId,
        accountType: 'customer',
        accountStatus: 'active',
        fullName: 'Customer Name',
      }),
    );
    quotationModel.exists.mockResolvedValue(false);
    repairRequestModel.findOneAndUpdate.mockReturnValue(
      createQuery(updatedRequest),
    );

    await expect(
      service.updateRepairRequest(
        customerId.toString(),
        requestId.toString(),
        {
          shopIds: [nearShopId.toString()],
          appliance: 'Refrigerator',
          description: 'Not cooling',
          brand: 'Brand',
          model: 'Model',
          serviceType: 'home_service',
          removeExistingPhotos: false,
        },
        [{ mimeType: 'image/png', data: 'data:image/png;base64,abc' }],
      ),
    ).resolves.toMatchObject({ _id: requestId, photos: [] });

    expect(repairRequestModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: requestId,
        customerId,
        status: 'open',
        repairJob: { $exists: false },
        acceptedQuotationId: { $exists: false },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          appliance: 'Refrigerator',
          description: 'Not cooling',
          photos: [
            { mimeType: 'image/png', data: 'data:image/png;base64,abc' },
          ],
        }),
      }),
      { new: true, runValidators: true },
    );
    expect(notificationsService.notifyUsers).toHaveBeenCalledWith(
      [nearShopId],
      expect.objectContaining({
        title: 'Repair Request Updated',
        type: 'new_repair_request',
        relatedEntityId: requestId,
      }),
    );
  });

  it('rejects edits after a quotation exists', async () => {
    const customerId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    userModel.findById.mockReturnValue(
      createQuery({
        _id: customerId,
        accountType: 'customer',
        accountStatus: 'active',
      }),
    );
    quotationModel.exists.mockResolvedValue(true);

    await expect(
      service.updateRepairRequest(
        customerId.toString(),
        requestId.toString(),
        {
          shopIds: [nearShopId.toString()],
          appliance: 'Refrigerator',
          description: 'Not cooling',
          removeExistingPhotos: false,
        },
        [],
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(repairRequestModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('returns shop-scoped dashboard counts without inventing repair revenue', async () => {
    quotationModel.find.mockReturnValue(createQuery([]));
    userModel.findById.mockReturnValue(
      createQuery({
        _id: nearShopId,
        accountType: 'shop',
        accountStatus: 'active',
      }),
    );
    repairRequestModel.aggregate
      .mockReturnValueOnce(
        createQuery([{ statuses: [{ _id: 'new', count: 2 }], recent: [] }]),
      )
      .mockReturnValueOnce(
        createQuery([
          {
            statuses: [
              { _id: 'ready_for_pickup', count: 1 },
              { _id: 'disputed', count: 1 },
            ],
            active: [],
            readyForPickup: [{ count: 1 }],
          },
        ]),
      );
    quotationModel.aggregate.mockReturnValueOnce(
      createQuery([
        {
          statuses: [{ _id: 'pending', count: 1 }],
          submittedTrend: [],
          recent: [],
        },
      ]),
    );
    reviewModel.aggregate.mockReturnValueOnce(
      createQuery([
        {
          summary: [{ averageRating: 4.5, total: 2, fiveStar: 1 }],
          distribution: [{ _id: 5, count: 1 }],
          recent: [],
        },
      ]),
    );

    const result = await service.getShopDashboardOverview(
      nearShopId.toString(),
    );

    expect(result).toMatchObject({
      requests: { total: 2, new: 2 },
      quotations: { total: 1, pending: 1 },
      repairs: { total: 2, readyForPickup: 1, disputed: 1, active: 2 },
      reviews: { averageRating: 4.5, total: 2 },
      revenue: { available: false },
    });
    expect(repairRequestModel.aggregate).toHaveBeenNthCalledWith(
      1,
      expect.arrayContaining([{ $match: { shopIds: nearShopId } }]),
    );
    expect(quotationModel.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([{ $match: { shopId: nearShopId } }]),
    );
    const reviewPipeline = reviewModel.aggregate.mock.calls[0]?.[0] as unknown[];
    expect(JSON.stringify(reviewPipeline)).not.toContain('$arrayElemAt');
    expect(JSON.stringify(reviewPipeline)).toContain('$customer.firstName');
  });

  it('starts an accepted repair job atomically and notifies its customer', async () => {
    const shopId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const acceptedQuotationId = new Types.ObjectId();
    const updatedRequest = {
      _id: requestId.toString(),
      customerId,
      appliance: 'Washing machine',
      repairJob: { status: 'in_progress' },
    };
    userModel.findById.mockReturnValue(
      createQuery({
        _id: shopId,
        accountType: 'shop',
        accountStatus: 'active',
        shopDetails: { shopName: 'Nearby Repair' },
      }),
    );
    registrationModel.findOne.mockReturnValue(
      createQuery({ registrationStatus: 'approved' }),
    );
    repairRequestModel.findOne.mockReturnValue(
      createQuery({ acceptedQuotationId }),
    );
    quotationModel.exists.mockResolvedValue(true);
    repairRequestModel.findOneAndUpdate.mockReturnValue(
      createQuery(updatedRequest),
    );

    await expect(
      service.updateRepairProgress(
        shopId.toString(),
        requestId.toString(),
        'start',
        {
          notes: 'Initial inspection complete.',
        },
      ),
    ).resolves.toEqual(updatedRequest.repairJob);

    expect(quotationModel.exists).toHaveBeenCalledWith({
      _id: acceptedQuotationId,
      shopId,
      status: 'accepted',
    });
    const [filter, update, options] =
      repairRequestModel.findOneAndUpdate.mock.calls[0] ?? [];
    expect(filter).toMatchObject({
      acceptedQuotationId: { $exists: true },
      'repairJob.status': { $in: ['inspection_approved', 'on_hold'] },
    });
    expect(String(filter._id)).toBe(requestId.toString());
    expect(String(filter.shopIds)).toBe(shopId.toString());
    expect(update.$set['repairJob.status']).toBe('in_progress');
    expect(options).toMatchObject({ new: true, runValidators: true });
    expect(notificationsService.notifyUsers).toHaveBeenCalledWith(
      [customerId],
      expect.objectContaining({ type: 'repair_started' }),
    );
  });

  it('does not expose a request that was not shared with the authenticated shop', async () => {
    const shopId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    userModel.findById.mockReturnValue(
      createQuery({
        _id: shopId,
        accountType: 'shop',
        accountStatus: 'active',
        shopDetails: { shopName: 'Authorized Shop' },
      }),
    );
    repairRequestModel.findOne.mockReturnValue(createQuery(null));

    await expect(
      service.getShopRepairRequest(shopId.toString(), requestId.toString()),
    ).rejects.toMatchObject({ status: 404 });
    expect(repairRequestModel.findOne).toHaveBeenCalledWith({
      _id: requestId.toString(),
      shopIds: shopId,
    });
  });

  it('calculates the fastest authorized shop route with the server-side Google API key', async () => {
    const shopId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    userModel.findById
      .mockReturnValueOnce(
        createQuery({
          _id: shopId,
          accountType: 'shop',
          accountStatus: 'active',
          shopDetails: {
            location: { latitude: 30.72, longitude: 76.72 },
          },
        }),
      )
      .mockReturnValueOnce(
        createQuery({ location: { latitude: 30.7, longitude: 76.7 } }),
      );
    registrationModel.findOne.mockReturnValue(
      createQuery({ registrationStatus: 'approved', paymentStatus: 'paid' }),
    );
    repairRequestModel.findOne.mockReturnValue(
      createQuery({
        customerId,
        customerLatitude: 30.7,
        customerLongitude: 76.7,
      }),
    );
    const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          routes: [
            {
              distanceMeters: 5000,
              duration: '600s',
              description: 'Alternate route',
              polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
            },
            {
              distanceMeters: 4800,
              duration: '300s',
              description: 'Fastest route via Sector 68',
              polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    try {
      const result = await service.getShopRepairRoute(
        shopId.toString(),
        requestId.toString(),
      );

      expect(result.distanceMeters).toBe(4800);
      expect(result.durationSeconds).toBe(300);
      expect(result.description).toBe('Fastest route via Sector 68');
      expect(result.path).toEqual([
        { latitude: 38.5, longitude: -120.2 },
        { latitude: 40.7, longitude: -120.95 },
        { latitude: 43.252, longitude: -126.453 },
      ]);
      expect(repairRequestModel.findOne).toHaveBeenCalledWith({
        _id: requestId.toString(),
        shopIds: shopId,
      });
      expect(fetch).toHaveBeenCalledWith(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Goog-Api-Key': 'test-google-api-key',
          }),
        }),
      );
    } finally {
      fetch.mockRestore();
    }
  });

  it('falls back to the Google Directions API when Routes API is disabled', async () => {
    const shopId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    userModel.findById
      .mockReturnValueOnce(
        createQuery({
          _id: shopId,
          accountType: 'shop',
          accountStatus: 'active',
          shopDetails: {
            location: { latitude: 30.72, longitude: 76.72 },
          },
        }),
      )
      .mockReturnValueOnce(
        createQuery({ location: { latitude: 30.7, longitude: 76.7 } }),
      );
    registrationModel.findOne.mockReturnValue(
      createQuery({ registrationStatus: 'approved', paymentStatus: 'paid' }),
    );
    repairRequestModel.findOne.mockReturnValue(
      createQuery({
        customerId,
        customerLatitude: 30.7,
        customerLongitude: 76.7,
      }),
    );
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              status: 'PERMISSION_DENIED',
              message:
                'Routes API has not been used in this project or it is disabled.',
            },
          }),
          { status: 403 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'OK',
            routes: [
              {
                summary: 'Fastest route via Main Road',
                legs: [
                  {
                    distance: { value: 4800, text: '4.8 km' },
                    duration: { value: 300, text: '5 mins' },
                  },
                ],
                overview_polyline: {
                  points: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );

    try {
      const result = await service.getShopRepairRoute(
        shopId.toString(),
        requestId.toString(),
      );

      expect(result).toEqual({
        distanceMeters: 4800,
        durationSeconds: 300,
        description: 'Fastest route via Main Road',
        path: [
          { latitude: 38.5, longitude: -120.2 },
          { latitude: 40.7, longitude: -120.95 },
          { latitude: 43.252, longitude: -126.453 },
        ],
      });
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          href: expect.stringContaining(
            'https://maps.googleapis.com/maps/api/directions/json',
          ),
        }),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
      const fallbackUrl = new URL(String(fetch.mock.calls[1]?.[0]));
      expect(fallbackUrl.searchParams.get('origin')).toBe('30.72,76.72');
      expect(fallbackUrl.searchParams.get('destination')).toBe('30.7,76.7');
      expect(fallbackUrl.searchParams.get('key')).toBe('test-google-api-key');
    } finally {
      fetch.mockRestore();
    }
  });

  it('logs Google Routes API status and provider message without logging the API key', async () => {
    const shopId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    userModel.findById
      .mockReturnValueOnce(
        createQuery({
          _id: shopId,
          accountType: 'shop',
          accountStatus: 'active',
          shopDetails: {
            location: { latitude: 30.72, longitude: 76.72 },
          },
        }),
      )
      .mockReturnValueOnce(
        createQuery({ location: { latitude: 30.7, longitude: 76.7 } }),
      );
    registrationModel.findOne.mockReturnValue(
      createQuery({ registrationStatus: 'approved', paymentStatus: 'paid' }),
    );
    repairRequestModel.findOne.mockReturnValue(
      createQuery({
        customerId,
        customerLatitude: 30.7,
        customerLongitude: 76.7,
      }),
    );
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              status: 'PERMISSION_DENIED',
              message: 'Routes API is not enabled for this project.',
            },
          }),
          { status: 403 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'REQUEST_DENIED',
            error_message: 'Directions API is not enabled for this project.',
            routes: [],
          }),
          { status: 200 },
        ),
      );
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    try {
      await expect(
        service.getShopRepairRoute(shopId.toString(), requestId.toString()),
      ).rejects.toMatchObject({ status: 502 });

      expect(loggerError).toHaveBeenCalledWith(
        expect.stringContaining(
          'Google Directions API request failed (REQUEST_DENIED): Directions API is not enabled for this project.',
        ),
      );
      expect(loggerError.mock.calls.flat().join(' ')).not.toContain(
        'test-google-api-key',
      );
    } finally {
      fetch.mockRestore();
      loggerError.mockRestore();
    }
  });

  it('rejects duplicate or expired declines through an atomic response-status filter', async () => {
    const shopId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    userModel.findById.mockReturnValue(
      createQuery({
        _id: shopId,
        accountType: 'shop',
        accountStatus: 'active',
        shopDetails: { shopName: 'Authorized Shop' },
      }),
    );
    repairRequestModel.findOneAndUpdate.mockReturnValue(createQuery(null));

    await expect(
      service.declineRepairRequest(shopId.toString(), requestId.toString(), {
        reason: 'No current capacity',
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(repairRequestModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: requestId.toString(),
        shopIds: shopId,
        status: 'open',
      }),
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('does not expose another shop’s inspection report on a shared request', async () => {
    const shopId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    const acceptedQuotationId = new Types.ObjectId();
    const thisShopQuotationId = new Types.ObjectId();
    userModel.findById
      .mockReturnValueOnce(
        createQuery({
          _id: shopId,
          accountType: 'shop',
          accountStatus: 'active',
        }),
      )
      .mockReturnValueOnce(
        createQuery({
          _id: customerId,
          fullName: 'Customer',
          email: 'customer@example.com',
        }),
      );
    registrationModel.findOne.mockReturnValue(
      createQuery({ registrationStatus: 'approved', paymentStatus: 'paid' }),
    );
    repairRequestModel.findOne.mockReturnValue(
      createQuery({
        _id: requestId,
        customerId,
        shopResponses: [{ shopId, status: 'quotation_submitted' }],
        acceptedQuotationId,
        repairJob: {
          status: 'awaiting_customer_approval',
          inspection: { identifiedProblem: 'Private inspection details' },
        },
      }),
    );
    quotationModel.find.mockReturnValue(
      createQuery([{ _id: thisShopQuotationId, status: 'pending' }]),
    );

    const result = await service.getShopRepairRequest(
      shopId.toString(),
      requestId.toString(),
    );

    expect(result).not.toHaveProperty('repairJob');
  });

  it('submits a quotation without requiring MongoDB replica-set transactions', async () => {
    const shopId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    const quotationId = new Types.ObjectId();
    userModel.findById.mockReturnValue(
      createQuery({
        _id: shopId,
        accountType: 'shop',
        accountStatus: 'active',
        shopDetails: { shopName: 'Authorized Shop' },
      }),
    );
    repairRequestModel.findOne.mockReturnValue(
      createQuery({
        _id: requestId,
        customerId,
        shopIds: [shopId],
        appliance: 'Refrigerator',
        status: 'open',
      }),
    );
    repairRequestModel.findOneAndUpdate.mockReturnValue(
      createQuery({ _id: requestId }),
    );
    quotationModel.create.mockResolvedValue({
      _id: quotationId,
      amount: 1900,
      currency: 'INR',
    });

    await expect(
      service.createQuotation(shopId.toString(), requestId.toString(), {
        amount: 1900,
        currency: 'inr',
        message: 'Repair estimate',
        estimatedDays: 3,
        validUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
        inspectionCharge: 200,
        partsCost: 1200,
        labourCharge: 500,
      }),
    ).resolves.toMatchObject({ _id: quotationId, amount: 1900 });
    expect(repairRequestModel.findOneAndUpdate).toHaveBeenCalled();
    expect(quotationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        repairRequestId: requestId,
        shopId,
        amount: 1900,
        currency: 'INR',
      }),
    );
    expect(notificationsService.notifyUsers).toHaveBeenCalledWith(
      [customerId],
      expect.objectContaining({ type: 'new_repair_quotation' }),
    );
  });

  it('restores a request response status when quotation persistence fails', async () => {
    const shopId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    userModel.findById.mockReturnValue(
      createQuery({
        _id: shopId,
        accountType: 'shop',
        accountStatus: 'active',
        shopDetails: { shopName: 'Authorized Shop' },
      }),
    );
    repairRequestModel.findOne.mockReturnValue(
      createQuery({
        _id: requestId,
        customerId,
        shopIds: [shopId],
        appliance: 'Refrigerator',
        status: 'open',
      }),
    );
    repairRequestModel.findOneAndUpdate.mockReturnValue(
      createQuery({ _id: requestId }),
    );
    repairRequestModel.updateOne.mockReturnValue(
      createQuery({ modifiedCount: 1 }),
    );
    quotationModel.create.mockRejectedValue(new Error('database write failed'));

    await expect(
      service.createQuotation(shopId.toString(), requestId.toString(), {
        amount: 1900,
        currency: 'INR',
        message: 'Repair estimate',
        estimatedDays: 3,
        validUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
      }),
    ).rejects.toThrow('database write failed');
    expect(repairRequestModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: requestId }),
      expect.objectContaining({
        $set: { 'shopResponses.$.status': 'new' },
      }),
    );
  });

  it('returns the saved quotation when the client retries a completed submission', async () => {
    const shopId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    userModel.findById.mockReturnValue(
      createQuery({
        _id: shopId,
        accountType: 'shop',
        accountStatus: 'active',
        shopDetails: { shopName: 'Authorized Shop' },
      }),
    );
    repairRequestModel.findOne.mockReturnValue(
      createQuery({
        _id: requestId,
        shopIds: [shopId],
        status: 'open',
      }),
    );
    repairRequestModel.updateOne.mockReturnValue(
      createQuery({ modifiedCount: 1 }),
    );
    const savedQuotation = {
      _id: new Types.ObjectId(),
      status: 'sent',
      amount: 1900,
      currency: 'INR',
    };
    quotationModel.findOne.mockReturnValue(createQuery(savedQuotation));

    await expect(
      service.createQuotation(shopId.toString(), requestId.toString(), {
        amount: 1900,
        currency: 'INR',
        message: 'Repair estimate',
        estimatedDays: 3,
        validUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
      }),
    ).resolves.toBe(savedQuotation);
    expect(repairRequestModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(quotationModel.create).not.toHaveBeenCalled();
    expect(repairRequestModel.updateOne).toHaveBeenCalled();
  });

  it('returns the saved quotation after a concurrent duplicate-key write', async () => {
    const shopId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    userModel.findById.mockReturnValue(
      createQuery({
        _id: shopId,
        accountType: 'shop',
        accountStatus: 'active',
        shopDetails: { shopName: 'Authorized Shop' },
      }),
    );
    repairRequestModel.findOne.mockReturnValue(
      createQuery({
        _id: requestId,
        customerId,
        shopIds: [shopId],
        appliance: 'Refrigerator',
        status: 'open',
      }),
    );
    repairRequestModel.findOneAndUpdate.mockReturnValue(
      createQuery({ _id: requestId }),
    );
    repairRequestModel.updateOne.mockReturnValue(
      createQuery({ modifiedCount: 1 }),
    );
    const savedQuotation = {
      _id: new Types.ObjectId(),
      status: 'sent',
      amount: 1900,
      currency: 'INR',
    };
    quotationModel.create.mockRejectedValue(
      Object.assign(new Error('duplicate key'), { code: 11000 }),
    );
    quotationModel.findOne.mockReturnValue(createQuery(savedQuotation));

    await expect(
      service.createQuotation(shopId.toString(), requestId.toString(), {
        amount: 1900,
        currency: 'INR',
        message: 'Repair estimate',
        estimatedDays: 3,
        validUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
      }),
    ).resolves.toBe(savedQuotation);
    expect(repairRequestModel.updateOne).toHaveBeenCalled();
  });

  it('claims the repair request before accepting a quotation', async () => {
    const customerId = new Types.ObjectId();
    const shopId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    const quotationId = new Types.ObjectId();
    const request = {
      _id: requestId,
      customerId,
      status: 'open',
      shopResponses: [{ shopId, status: 'quotation_submitted' }],
    };
    const quotation = {
      _id: quotationId,
      repairRequestId: requestId,
      shopId,
      status: 'pending',
      amount: 1900,
    };
    userModel.findById.mockReturnValue(
      createQuery({
        _id: customerId,
        accountType: 'customer',
        accountStatus: 'active',
      }),
    );
    quotationModel.findById.mockReturnValue(createQuery(quotation));
    repairRequestModel.findOne.mockReturnValue(createQuery(request));
    repairRequestModel.findOneAndUpdate.mockReturnValue(createQuery(request));
    quotationModel.findOneAndUpdate.mockReturnValue(
      createQuery({ ...quotation, status: 'accepted' }),
    );
    repairRequestModel.updateOne.mockReturnValue(
      createQuery({ modifiedCount: 1 }),
    );
    quotationModel.find.mockReturnValue(createQuery([]));

    await expect(
      service.updateQuotationStatus(
        customerId.toString(),
        quotationId.toString(),
        'accepted',
      ),
    ).resolves.toMatchObject({ status: 'accepted' });

    expect(repairRequestModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: requestId,
        customerId,
        acceptedQuotationId: { $exists: false },
      }),
      {
        $set: expect.objectContaining({
          acceptedQuotationId: quotationId,
          repairJob: expect.objectContaining({
            status: 'inspection_pending',
            acceptedQuotationId: quotationId,
          }),
        }),
      },
      { new: true },
    );
    expect(quotationModel.findOneAndUpdate).toHaveBeenCalled();
  });

  it('rejects a concurrent acceptance when another quotation already claimed the request', async () => {
    const customerId = new Types.ObjectId();
    const shopId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    const quotationId = new Types.ObjectId();
    userModel.findById.mockReturnValue(
      createQuery({
        _id: customerId,
        accountType: 'customer',
        accountStatus: 'active',
      }),
    );
    quotationModel.findById.mockReturnValue(
      createQuery({
        _id: quotationId,
        repairRequestId: requestId,
        shopId,
        status: 'pending',
      }),
    );
    repairRequestModel.findOne.mockReturnValue(
      createQuery({ _id: requestId, customerId, status: 'open' }),
    );
    repairRequestModel.findOneAndUpdate.mockReturnValue(createQuery(null));

    await expect(
      service.updateQuotationStatus(
        customerId.toString(),
        quotationId.toString(),
        'accepted',
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(quotationModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('calculates the submitted inspection estimate from validated parts and charges', async () => {
    const shopId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    const acceptedQuotationId = new Types.ObjectId();
    userModel.findById.mockReturnValue(
      createQuery({
        _id: shopId,
        accountType: 'shop',
        accountStatus: 'active',
        shopDetails: { shopName: 'Nearby Repair' },
      }),
    );
    registrationModel.findOne.mockReturnValue(
      createQuery({ registrationStatus: 'approved', paymentStatus: 'paid' }),
    );
    repairRequestModel.findOne.mockReturnValue(
      createQuery({ acceptedQuotationId }),
    );
    quotationModel.exists.mockResolvedValue(true);
    repairRequestModel.findOneAndUpdate.mockReturnValue(
      createQuery({
        _id: requestId,
        customerId,
        appliance: 'Washing machine',
        repairJob: { status: 'awaiting_customer_approval' },
      }),
    );

    await service.saveRepairInspection(
      shopId.toString(),
      requestId.toString(),
      {
        action: 'submit',
        identifiedProblem: 'Motor failure',
        findings: 'Motor winding is damaged',
        requiredRepairWork: 'Replace the motor',
        parts: [{ name: 'Motor', quantity: 2, unitPrice: 12.35 }],
        labourCharge: 10.1,
        inspectionCharges: 5,
        otherCharges: 2.2,
      },
    );

    const [filter, update, options] =
      repairRequestModel.findOneAndUpdate.mock.calls[0] ?? [];
    expect(filter).toMatchObject({
      _id: requestId.toString(),
      shopIds: shopId,
      'repairJob.status': 'inspection_in_progress',
    });
    expect(update.$set['repairJob.inspection']).toMatchObject({
      partsTotal: 24.7,
      estimatedTotal: 42,
      status: 'awaiting_approval',
    });
    expect(update.$set['repairJob.status']).toBe('awaiting_customer_approval');
    expect(options).toMatchObject({ new: true, runValidators: true });
    expect(notificationsService.notifyUsers).toHaveBeenCalledWith(
      [customerId],
      expect.objectContaining({ type: 'repair_inspection_submitted' }),
    );
  });

  it('rejects inspection image payloads that exceed the JSON request budget', async () => {
    const shopId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    const acceptedQuotationId = new Types.ObjectId();
    userModel.findById.mockReturnValue(
      createQuery({
        _id: shopId,
        accountType: 'shop',
        accountStatus: 'active',
      }),
    );
    registrationModel.findOne.mockReturnValue(
      createQuery({ registrationStatus: 'approved', paymentStatus: 'paid' }),
    );
    repairRequestModel.findOne.mockReturnValue(
      createQuery({ acceptedQuotationId }),
    );
    quotationModel.exists.mockResolvedValue(true);
    const image = `data:image/png;base64,${'a'.repeat(850_000)}`;

    await expect(
      service.saveRepairInspection(shopId.toString(), requestId.toString(), {
        action: 'draft',
        images: [
          { mimeType: 'image/png', data: image },
          { mimeType: 'image/png', data: image },
        ],
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(repairRequestModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('only approves a submitted inspection and stores its customer-approved amount', async () => {
    const customerId = new Types.ObjectId();
    const shopId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    const quotationId = new Types.ObjectId();
    const submittedRequest = {
      _id: requestId,
      customerId,
      appliance: 'Washing machine',
      acceptedQuotationId: quotationId,
      repairJob: { status: 'inspection_approved' },
    };
    userModel.findById.mockReturnValue(
      createQuery({
        _id: customerId,
        accountType: 'customer',
        accountStatus: 'active',
      }),
    );
    repairRequestModel.findOne.mockReturnValue(
      createQuery({
        repairJob: { inspection: { estimatedTotal: 175 } },
      }),
    );
    repairRequestModel.findOneAndUpdate.mockReturnValue(
      createQuery(submittedRequest),
    );
    quotationModel.findById.mockReturnValue(createQuery({ shopId }));

    await service.decideRepairInspection(
      customerId.toString(),
      requestId.toString(),
      'approve',
    );

    const [filter, update] =
      repairRequestModel.findOneAndUpdate.mock.calls[0] ?? [];
    expect(filter._id.toString()).toBe(requestId.toString());
    expect(filter.customerId).toBe(customerId);
    expect(filter.status).toBe('open');
    expect(filter['repairJob.status']).toBe('awaiting_customer_approval');
    expect(filter['repairJob.inspection.status']).toBe('awaiting_approval');
    expect(filter['repairJob.inspection.estimatedTotal']).toEqual({ $gt: 0 });
    expect(update.$set).toMatchObject({
      'repairJob.status': 'inspection_approved',
      'repairJob.inspection.status': 'approved',
      'repairJob.approvedRepairAmount': 175,
      'repairJob.approvedAdditionalCharges': 0,
    });
    expect(notificationsService.notifyUsers).toHaveBeenCalledWith(
      [shopId],
      expect.objectContaining({ type: 'repair_inspection_approved' }),
    );
  });

  it('starts repair only after an approved inspection report', async () => {
    const shopId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    const acceptedQuotationId = new Types.ObjectId();
    const updatedRequest = {
      _id: requestId,
      customerId,
      appliance: 'Washing machine',
      repairJob: { status: 'in_progress' },
    };
    userModel.findById.mockReturnValue(
      createQuery({
        _id: shopId,
        accountType: 'shop',
        accountStatus: 'active',
        shopDetails: { shopName: 'Nearby Repair' },
      }),
    );
    registrationModel.findOne.mockReturnValue(
      createQuery({ registrationStatus: 'approved', paymentStatus: 'paid' }),
    );
    repairRequestModel.findOne.mockReturnValue(
      createQuery({ acceptedQuotationId }),
    );
    quotationModel.exists.mockResolvedValue(true);
    repairRequestModel.findOneAndUpdate.mockReturnValue(
      createQuery(updatedRequest),
    );

    await expect(
      service.startApprovedRepair(shopId.toString(), requestId.toString()),
    ).resolves.toEqual(updatedRequest.repairJob);

    const [filter, update] =
      repairRequestModel.findOneAndUpdate.mock.calls[0] ?? [];
    expect(filter).toMatchObject({
      'repairJob.status': 'inspection_approved',
      'repairJob.inspection.status': 'approved',
      'repairJob.inspection.decidedBy': { $exists: true },
    });
    expect(String(filter._id)).toBe(requestId.toString());
    expect(String(filter.shopIds)).toBe(shopId.toString());
    expect(update.$set['repairJob.status']).toBe('in_progress');
    expect(update.$set['repairJob.repairStartedBy']).toBe(shopId);
    expect(notificationsService.notifyUsers).toHaveBeenCalledWith(
      [customerId],
      expect.objectContaining({ type: 'repair_started' }),
    );
  });

  it('calculates additional charges server-side and pauses only when requested', async () => {
    const shopId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    const acceptedQuotationId = new Types.ObjectId();
    const savedChargeId = new Types.ObjectId();
    const updatedRequest = {
      _id: requestId,
      customerId,
      appliance: 'Washing machine',
      repairJob: {
        status: 'on_hold',
        additionalChargeRequests: [
          { _id: savedChargeId, status: 'pending', amount: 20 },
        ],
      },
    };
    userModel.findById.mockReturnValue(
      createQuery({
        _id: shopId,
        accountType: 'shop',
        accountStatus: 'active',
        shopDetails: { shopName: 'Nearby Repair' },
      }),
    );
    registrationModel.findOne.mockReturnValue(
      createQuery({ registrationStatus: 'approved', paymentStatus: 'paid' }),
    );
    repairRequestModel.findOne.mockReturnValue(
      createQuery({ acceptedQuotationId }),
    );
    quotationModel.exists.mockResolvedValue(true);
    repairRequestModel.findOneAndUpdate.mockReturnValue(
      createQuery(updatedRequest),
    );

    await service.requestAdditionalCharges(
      shopId.toString(),
      requestId.toString(),
      {
        action: 'submit',
        issue: 'Damaged belt',
        reason: 'The belt damage was hidden until disassembly',
        repairDescription: 'Replace the belt',
        parts: [{ name: 'Drive belt', quantity: 3, unitPrice: 4.25 }],
        labourCharge: 5.25,
        otherCharges: 2,
        blocksRepair: true,
      },
    );

    const [filter, update] =
      repairRequestModel.findOneAndUpdate.mock.calls[0] ?? [];
    expect(filter['repairJob.status']).toEqual({
      $in: ['in_progress', 'on_hold'],
    });
    expect(update.$set['repairJob.status']).toBe('on_hold');
    expect(update.$push['repairJob.additionalChargeRequests']).toMatchObject({
      status: 'pending',
      partsTotal: 12.75,
      amount: 20,
      blocksRepair: true,
      shopId,
    });
    expect(notificationsService.notifyUsers).toHaveBeenCalledWith(
      [customerId],
      expect.objectContaining({ type: 'additional_charges_requested' }),
    );
  });

  it('rejects a duplicate additional-charge decision after the request is no longer pending', async () => {
    const customerId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    const chargeId = new Types.ObjectId();
    userModel.findById.mockReturnValue(
      createQuery({
        _id: customerId,
        accountType: 'customer',
        accountStatus: 'active',
      }),
    );
    repairRequestModel.findOne.mockReturnValue(
      createQuery({
        repairJob: {
          additionalChargeRequests: [
            { _id: chargeId, status: 'pending', amount: 25 },
          ],
        },
      }),
    );
    repairRequestModel.findOneAndUpdate.mockReturnValue(createQuery(null));

    await expect(
      service.decideAdditionalCharges(
        customerId.toString(),
        requestId.toString(),
        chargeId.toString(),
        'accept',
      ),
    ).rejects.toMatchObject({ status: 409 });
    const [filter, , options] =
      repairRequestModel.findOneAndUpdate.mock.calls[0] ?? [];
    expect(filter._id.toString()).toBe(requestId.toString());
    expect(filter.customerId).toBe(customerId);
    expect(
      filter['repairJob.additionalChargeRequests'].$elemMatch._id.toString(),
    ).toBe(chargeId.toString());
    expect(filter['repairJob.additionalChargeRequests'].$elemMatch.status).toBe(
      'pending',
    );
    expect(options).toMatchObject({ new: true, runValidators: true });
  });
});
