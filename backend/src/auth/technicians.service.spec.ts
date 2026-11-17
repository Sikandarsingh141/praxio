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
          createQuery([{ _id: customerId, firstName: 'Ava', lastName: 'Customer' }]),
        ),
    };
    const repairRequests = {
      find: jest.fn().mockReturnValue(createQuery(requests)),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        TechniciansService,
        { provide: getModelToken(User.name), useValue: users },
        { provide: getModelToken(RepairRequest.name), useValue: repairRequests },
        { provide: getModelToken(RepairQuotation.name), useValue: {} },
        { provide: getModelToken(ChatConversation.name), useValue: {} },
        { provide: getModelToken(RepairReview.name), useValue: {} },
        { provide: NotificationsService, useValue: {} },
      ],
    }).compile();

    const result = await moduleRef.get(TechniciansService).listAssignments(shopId.toString());

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
});
