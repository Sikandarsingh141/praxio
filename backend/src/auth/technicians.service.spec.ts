import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ChatConversation } from '../chat/schemas/chat.schema';
import {
  RepairQuotation,
  RepairRequest,
  RepairReview,
} from '../customer/repair-request.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/schemas/user.schema';
import { TechniciansService } from './technicians.service';

function createQuery<T>(value: T) {
  const query = {
    select: jest.fn(),
    sort: jest.fn(),
    limit: jest.fn(),
    lean: jest.fn(),
    exec: jest.fn().mockResolvedValue(value),
  };
  query.select.mockReturnValue(query);
  query.sort.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.lean.mockReturnValue(query);
  return query;
}

describe('TechniciansService assignments', () => {
  it('returns assigned repair details, technician, owner, and assignment timestamp', async () => {
    const shopId = new Types.ObjectId();
    const technicianId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    const ownerRequestId = new Types.ObjectId();
    const assignedAt = new Date('2026-11-16T10:24:00.000Z');
    const requests = [
      {
        _id: requestId,
        customerId,
        appliance: 'Television',
        brand: 'Samsung',
        model: 'UA43T5450',
        description: 'No display, but power is on',
        photos: [{ data: 'data:image/jpeg;base64,abc' }],
        createdAt: new Date('2026-11-15T10:00:00.000Z'),
        serviceType: 'home_service',
        repairJob: {
          status: 'inspection_pending',
          activeAssignment: { shopId, technicianId, assignedAt },
        },
      },
      {
        _id: ownerRequestId,
        customerId,
        appliance: 'Refrigerator',
        description: 'Not cooling',
        photos: [],
        createdAt: new Date('2026-11-15T11:00:00.000Z'),
        repairJob: {
          status: 'confirmed',
          activeAssignment: { shopId, technicianId: shopId, assignedAt },
        },
      },
    ];
    const users = {
      findOne: jest.fn().mockReturnValue(createQuery({ _id: shopId })),
      find: jest
        .fn()
        .mockReturnValueOnce(
          createQuery([
            {
              _id: technicianId,
              firstName: 'Rahul',
              lastName: 'Verma',
              email: 'rahul@example.test',
              profileImageData: 'data:image/png;base64,profile',
              accountLifecycleStatus: 'active',
              technicianDetails: {},
            },
          ]),
        )
        .mockReturnValueOnce(
          createQuery([
            { _id: customerId, firstName: 'Ava', lastName: 'Customer' },
          ]),
        ),
    };
    const repairRequests = {
      find: jest.fn().mockReturnValue(createQuery(requests)),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        TechniciansService,
        { provide: getModelToken(User.name), useValue: users },
        {
          provide: getModelToken(RepairRequest.name),
          useValue: repairRequests,
        },
        { provide: getModelToken(RepairQuotation.name), useValue: {} },
        { provide: getModelToken(ChatConversation.name), useValue: {} },
        { provide: getModelToken(RepairReview.name), useValue: {} },
        { provide: NotificationsService, useValue: {} },
      ],
    }).compile();

    const result = await moduleRef
      .get(TechniciansService)
      .listAssignments(shopId.toString());

    expect(repairRequests.find).toHaveBeenCalledWith({
      shopIds: shopId,
      'repairJob.activeAssignment.shopId': shopId,
      'repairJob.status': {
        $nin: [
          'repair_completed',
          'ready_for_pickup',
          'picked_up',
          'completed',
          'repair_declined',
          'disputed',
        ],
      },
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      requestId: requestId.toString(),
      appliance: 'Television',
      description: 'No display, but power is on',
      photo: 'data:image/jpeg;base64,abc',
      createdAt: requests[0].createdAt,
      serviceType: 'home_service',
      repairStatus: 'inspection_pending',
      customer: 'Ava Customer',
      assignment: { technicianId, assignedAt },
      isOwner: false,
      technician: {
        id: technicianId.toString(),
        name: 'Rahul Verma',
        profileImageData: 'data:image/png;base64,profile',
      },
    });
    expect(result[1]).toMatchObject({
      requestId: ownerRequestId.toString(),
      appliance: 'Refrigerator',
      description: 'Not cooling',
      photo: null,
      isOwner: true,
      technician: {
        id: shopId.toString(),
        name: 'You',
      },
    });
  });

  it('includes technician identity and request dates for assigned-job listings', async () => {
    const shopId = new Types.ObjectId();
    const technicianId = new Types.ObjectId();
    const customerId = new Types.ObjectId();
    const requestId = new Types.ObjectId();
    const createdAt = new Date('2026-11-15T10:00:00.000Z');
    const assignedAt = new Date('2026-11-16T10:00:00.000Z');
    const technician = {
      _id: technicianId,
      firstName: 'Aman',
      lastName: 'Verma',
      profileImageData: 'data:image/png;base64,technician',
      technicianDetails: { shopId },
    };
    const users = {
      findOne: jest.fn().mockReturnValue(createQuery(technician)),
      findById: jest.fn().mockReturnValue(
        createQuery({ shopDetails: { shopName: 'Repair Shop' } }),
      ),
      find: jest.fn().mockReturnValue(
        createQuery([
          { _id: customerId, firstName: 'Sikandar', lastName: 'Customer' },
        ]),
      ),
    };
    const repairRequests = {
      find: jest.fn().mockReturnValue(
        createQuery([
          {
            _id: requestId,
            customerId,
            appliance: 'Phone',
            brand: 'Nokia',
            model: 'N1',
            description: 'Screen is damaged',
            photos: [],
            repairJob: {
              status: 'inspection_approved',
              activeAssignment: { shopId, technicianId, assignedAt },
            },
            createdAt,
            serviceType: 'home_service',
          },
        ]),
      ),
    };
    const reviews = {
      find: jest.fn().mockReturnValue(createQuery([])),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        TechniciansService,
        { provide: getModelToken(User.name), useValue: users },
        {
          provide: getModelToken(RepairRequest.name),
          useValue: repairRequests,
        },
        {
          provide: getModelToken(RepairQuotation.name),
          useValue: { find: jest.fn() },
        },
        { provide: getModelToken(ChatConversation.name), useValue: {} },
        { provide: getModelToken(RepairReview.name), useValue: reviews },
        { provide: NotificationsService, useValue: {} },
      ],
    }).compile();

    const result = await moduleRef
      .get(TechniciansService)
      .technicianJobs(technicianId.toString(), 'pending');

    expect(result.jobs[0]).toMatchObject({
      id: requestId.toString(),
      assignedToName: 'Aman Verma',
      assignedToImageData: 'data:image/png;base64,technician',
      serviceType: 'home_service',
      createdAt,
    });
  });

  describe('TechniciansService job details', () => {
    it('returns shop-scoped quotations and the complete read-only repair summary', async () => {
      const shopId = new Types.ObjectId();
      const technicianId = new Types.ObjectId();
      const customerId = new Types.ObjectId();
      const requestId = new Types.ObjectId();
      const quotationId = new Types.ObjectId();
      const createdAt = new Date('2026-11-15T10:00:00.000Z');
      const additionalCharge = {
        _id: new Types.ObjectId(),
        status: 'accepted',
        amount: 125,
        parts: [],
        requestedAt: createdAt,
      };
      const request = {
        _id: requestId,
        customerId,
        shopIds: [shopId],
        appliance: 'Television',
        brand: 'Samsung',
        model: 'UA43T5450',
        description: 'No display, but power is on',
        photos: [
          { mimeType: 'image/jpeg', data: 'data:image/jpeg;base64,abc' },
        ],
        createdAt,
        preferredServiceDate: new Date('2026-11-18T10:00:00.000Z'),
        serviceType: 'home_service',
        status: 'open',
        acceptedQuotationId: quotationId,
        shopResponses: [{ shopId, status: 'customer_accepted' }],
        repairJob: {
          status: 'completed',
          activeAssignment: {
            shopId,
            technicianId,
            assignedAt: createdAt,
            note: 'Call first',
          },
          startedAt: createdAt,
          repairCompletedAt: createdAt,
          approvedRepairAmount: 850,
          approvedAdditionalCharges: 125,
          additionalChargeRequests: [additionalCharge],
          inspection: {
            status: 'approved',
            identifiedProblem: 'Backlight failure',
            findings: 'LED strips are damaged',
            requiredRepairWork: 'Replace LED strips',
            parts: [],
            partsTotal: 0,
            labourCharge: 100,
            inspectionCharges: 50,
            otherCharges: 0,
            estimatedTotal: 150,
            images: [],
          },
          completionDescription: 'Display restored',
          workPerformed: 'Replaced LED strips',
          partsReplaced: 'LED strip set',
          finalNotes: 'Tested successfully',
          pickupInstructions: 'No special instructions',
          customerVerification: {
            received: true,
            inspected: true,
            confirmedAt: createdAt,
          },
          history: [],
        },
      };
      const technician = {
        _id: technicianId,
        firstName: 'Rahul',
        lastName: 'Verma',
        profileImageData: 'data:image/png;base64,profile',
        technicianDetails: { shopId },
      };
      const customer = {
        _id: customerId,
        firstName: 'Ava',
        lastName: 'Customer',
        email: 'ava@example.test',
        countryCode: '+91',
        mobileNumber: '1234567890',
        location: { latitude: 28.6, longitude: 77.2 },
      };
      const shop = {
        _id: shopId,
        shopDetails: {
          shopName: 'Fixora Service',
          address: 'Main Road',
          city: 'Delhi',
          location: { latitude: 28.7, longitude: 77.1 },
        },
      };
      const quotation = {
        _id: quotationId,
        amount: 850,
        currency: 'INR',
        status: 'accepted',
        message: 'Repair estimate',
        inspectionCharge: 50,
        partsCost: 600,
        labourCharge: 200,
        additionalCharges: 0,
        createdAt,
      };
      const users = {
        findOne: jest.fn().mockReturnValue(createQuery(technician)),
        findById: jest
          .fn()
          .mockImplementation((id: Types.ObjectId) =>
            createQuery(
              id.toString() === customerId.toString() ? customer : shop,
            ),
          ),
        find: jest.fn().mockReturnValue(createQuery([])),
      };
      const repairRequests = {
        findOne: jest.fn().mockReturnValue(createQuery(request)),
      };
      const quotations = {
        find: jest.fn().mockReturnValue(createQuery([quotation])),
      };
      const reviews = {
        findOne: jest.fn().mockReturnValue(createQuery(null)),
      };
      const moduleRef = await Test.createTestingModule({
        providers: [
          TechniciansService,
          { provide: getModelToken(User.name), useValue: users },
          {
            provide: getModelToken(RepairRequest.name),
            useValue: repairRequests,
          },
          {
            provide: getModelToken(RepairQuotation.name),
            useValue: quotations,
          },
          { provide: getModelToken(ChatConversation.name), useValue: {} },
          { provide: getModelToken(RepairReview.name), useValue: reviews },
          { provide: NotificationsService, useValue: {} },
        ],
      }).compile();

      const service = moduleRef.get(TechniciansService);
      const result = await service.technicianJobDetails(
        technicianId.toString(),
        requestId.toString(),
      );

      expect(quotations.find).toHaveBeenCalledWith({
        repairRequestId: requestId,
        shopId,
      });
      expect(await service.technicianJobShopId(
        technicianId.toString(),
        requestId.toString(),
      )).toBe(shopId.toString());
      expect(result).toMatchObject({
        id: requestId.toString(),
        createdAt,
        requestStatus: 'open',
        customer: 'Ava Customer',
        customerInfo: {
          name: 'Ava Customer',
          phone: '+91 1234567890',
          email: 'ava@example.test',
          location: { latitude: 28.6, longitude: 77.2 },
        },
        shop: {
          location: { latitude: 28.7, longitude: 77.1 },
        },
        quotations: [{ id: quotationId.toString(), status: 'accepted' }],
        shopResponse: { status: 'customer_accepted' },
        assignmentDetails: {
          technicianName: 'Rahul Verma',
          profileImageData: 'data:image/png;base64,profile',
        },
        repairJobDetails: {
          approvedRepairAmount: 850,
          approvedAdditionalCharges: 125,
          additionalChargeRequests: [additionalCharge],
          inspection: { identifiedProblem: 'Backlight failure' },
          customerVerification: { received: true, inspected: true },
        },
      });
    });
  });
});
