import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Connection, Model, Types, UpdateQuery } from 'mongoose';
import { NotificationsService } from '../notifications/notifications.service';
import {
  RepairQuotation,
  RepairRequest,
} from '../customer/repair-request.schema';
import { User } from '../users/schemas/user.schema';
import { CreateDisputeDto } from './dto/dispute.dto';
import { Dispute } from './schemas/dispute.schema';
import { DisputesService } from './disputes.service';

describe('DisputesService', () => {
  const customerId = new Types.ObjectId();
  const shopId = new Types.ObjectId();
  const requestId = new Types.ObjectId();
  const quotationId = new Types.ObjectId();

  let service: DisputesService;
  let disputes: jest.Mock & Record<string, jest.Mock>;
  let requests: Record<string, jest.Mock>;
  let quotations: Record<string, jest.Mock>;
  let users: Record<string, jest.Mock>;
  let notifications: { notifyUsers: jest.Mock };
  let repairRequest: Record<string, unknown>;
  let save: jest.Mock;

  const createInput = (): CreateDisputeDto => ({
    category: 'repair_quality',
    subject: 'Poor repair quality',
    description: 'The device stopped working after the repair.',
    expectedResolution: 'Please inspect and repair the device again.',
    attachments: [],
  });

  beforeEach(() => {
    repairRequest = {
      _id: requestId,
      customerId,
      acceptedQuotationId: quotationId,
      repairJob: {
        acceptedQuotationId: quotationId,
        status: 'picked_up',
      },
    };
    save = jest.fn().mockResolvedValue(undefined);

    const userQuery = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({
        accountType: 'customer',
        accountStatus: 'active',
        accountLifecycleStatus: 'active',
      }),
    };
    const adminQuery = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    const record = (input: Record<string, unknown>) => ({
      ...input,
      save,
      toObject: () => input,
    });

    disputes = Object.assign(jest.fn().mockImplementation(record), {
      exists: jest.fn().mockResolvedValue(false),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      aggregate: jest.fn(),
      countDocuments: jest.fn(),
      find: jest.fn(),
    }) as jest.Mock & Record<string, jest.Mock>;
    disputes.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    });
    requests = {
      find: jest.fn(),
      findOne: jest.fn().mockResolvedValue(repairRequest),
      findById: jest.fn(),
    };
    quotations = {
      findOne: jest.fn().mockResolvedValue({ shopId }),
      findById: jest.fn(),
    };
    users = {
      findById: jest.fn().mockReturnValue(userQuery),
      find: jest.fn().mockReturnValue(adminQuery),
    };
    notifications = { notifyUsers: jest.fn().mockResolvedValue(undefined) };

    service = new DisputesService(
      disputes as unknown as Model<Dispute>,
      requests as unknown as Model<RepairRequest>,
      quotations as unknown as Model<RepairQuotation>,
      users as unknown as Model<User>,
      notifications as unknown as NotificationsService,
      { db: null } as unknown as Connection,
    );
  });

  it('creates a dispute without changing the repair job status', async () => {
    const result = await service.createCustomerDispute(
      { userId: customerId.toString(), role: 'customer' },
      requestId.toString(),
      createInput(),
    );

    expect(result).toMatchObject({
      category: 'repair_quality',
      status: 'OPEN',
      shopId,
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(repairRequest.repairJob).toEqual({
      acceptedQuotationId: quotationId,
      status: 'picked_up',
    });
    expect(notifications.notifyUsers).toHaveBeenCalledTimes(1);
  });

  it('migrates legacy disputed repair jobs without removing their source data', async () => {
    const legacyRequest = {
      _id: requestId,
      customerId,
      acceptedQuotationId: quotationId,
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
      repairJob: {
        status: 'disputed',
        disputeDescription: 'The device still does not work.',
        history: [],
      },
    };
    requests.find.mockReturnValue({
      lean: () => ({ exec: jest.fn().mockResolvedValue([legacyRequest]) }),
    });

    await service.onModuleInit();

    expect(disputes).toHaveBeenCalledWith(
      expect.objectContaining({
        repairRequestId: requestId,
        customerId,
        shopId,
        status: 'OPEN',
        description: 'The device still does not work.',
      }),
    );
    expect(save).toHaveBeenCalledTimes(1);
    expect(legacyRequest.repairJob.status).toBe('disputed');
  });

  it('does not disclose repair requests that do not belong to the customer', async () => {
    requests.findOne.mockResolvedValue(null);

    await expect(
      service.createCustomerDispute(
        { userId: customerId.toString(), role: 'customer' },
        requestId.toString(),
        createInput(),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(save).not.toHaveBeenCalled();
    expect(notifications.notifyUsers).not.toHaveBeenCalled();
  });

  it.each([
    'AWAITING_CUSTOMER_RESPONSE',
    'CUSTOMER_VERIFICATION_PENDING',
  ] as const)(
    'does not allow customer verification before rework is completed (%s)',
    async (status) => {
      const disputeId = new Types.ObjectId();
      disputes.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          _id: disputeId,
          customerId,
          shopId,
          status,
          reinspections: [{ findings: 'The issue was identified.' }],
          reworkCompletions: [],
        }),
      });

      await expect(
        service.confirmResolution(
          { userId: customerId.toString(), role: 'customer' },
          disputeId.toString(),
          { message: 'It is fixed.' },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(disputes.findOneAndUpdate).not.toHaveBeenCalled();
    },
  );

  it('rejects duplicate active cases using the atomic unique issue key', async () => {
    save.mockRejectedValue({ code: 11000 });

    await expect(
      service.createCustomerDispute(
        { userId: customerId.toString(), role: 'customer' },
        requestId.toString(),
        createInput(),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(notifications.notifyUsers).not.toHaveBeenCalled();
  });

  it('does not allow an administrator to mark a case resolved through status editing', async () => {
    const adminQuery = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({
        accountType: 'admin',
        accountStatus: 'active',
        accountLifecycleStatus: 'active',
      }),
    };
    users.findById.mockReturnValue(adminQuery);

    const currentDispute = {
      _id: new Types.ObjectId(),
      status: 'UNDER_REVIEW',
    };
    disputes.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(currentDispute),
    });

    await expect(
      service.updateAdminStatus(
        { userId: new Types.ObjectId().toString(), role: 'admin' },
        currentDispute._id.toString(),
        {
          status: 'RESOLVED',
          reason: 'Done',
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(disputes.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('does not allow an administrator to propose or complete a resolution', async () => {
    const adminActor = {
      userId: new Types.ObjectId().toString(),
      role: 'admin' as const,
    };
    const proposal = {
      type: 'repair_again',
      description: 'Repair the device again.',
      responsibleParty: 'shop',
      notes: 'Agreed proposal.',
    };

    await expect(
      service.proposeResolution(
        adminActor,
        new Types.ObjectId().toString(),
        proposal,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.resolveDispute(adminActor, new Types.ObjectId().toString(), {
        completionNotes: 'Completed.',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(disputes.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('lets the assigned shop accept an open dispute for reinspection', async () => {
    const shopQuery = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({
        accountType: 'shop',
        accountStatus: 'active',
        accountLifecycleStatus: 'active',
      }),
    };
    users.findById.mockReturnValue(shopQuery);
    const currentDispute = {
      _id: new Types.ObjectId(),
      reference: 'DSP-1',
      customerId,
      shopId,
      status: 'OPEN',
      statusHistory: [],
    };
    const updatedDispute = { ...currentDispute, status: 'UNDER_REVIEW' };
    let recordedUpdate: UpdateQuery<Dispute> | undefined;
    disputes.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(currentDispute),
    });
    disputes.findOneAndUpdate.mockImplementation(
      (_filter: unknown, update: UpdateQuery<Dispute>) => {
        recordedUpdate = update;
        return { exec: jest.fn().mockResolvedValue(updatedDispute) };
      },
    );

    const result = await service.acceptDispute(
      { userId: shopId.toString(), role: 'shop' },
      currentDispute._id.toString(),
    );

    expect(result).toMatchObject({ status: 'UNDER_REVIEW' });
    expect(recordedUpdate?.$set).toEqual({ status: 'UNDER_REVIEW' });
    expect(recordedUpdate?.$push?.statusHistory).toMatchObject({
      from: 'OPEN',
      to: 'UNDER_REVIEW',
      actorRole: 'shop',
    });
    expect(notifications.notifyUsers).toHaveBeenCalledWith(
      [customerId],
      expect.objectContaining({ type: 'dispute_accepted' }),
    );
  });

  it('does not allow a customer to close a dispute', async () => {
    await expect(
      service.closeDispute(
        { userId: customerId.toString(), role: 'customer' },
        new Types.ObjectId().toString(),
        { reason: 'Closing this dispute.' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(disputes.findOne).not.toHaveBeenCalled();
    expect(disputes.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('does not allow a shop to accept a dispute assigned to another shop', async () => {
    const shopQuery = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({
        accountType: 'shop',
        accountStatus: 'active',
        accountLifecycleStatus: 'active',
      }),
    };
    users.findById.mockReturnValue(shopQuery);
    disputes.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(
      service.acceptDispute(
        { userId: shopId.toString(), role: 'shop' },
        new Types.ObjectId().toString(),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(disputes.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
