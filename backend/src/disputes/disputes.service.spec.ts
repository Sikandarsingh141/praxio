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

const typedObjectContaining = <T>(value: T): T => {
  const matcher: unknown = expect.objectContaining(value);
  return matcher as T;
};

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
      updateOne: jest.fn(),
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

  it('includes repair and customer details in the shop dispute list', async () => {
    const dispute = {
      _id: new Types.ObjectId(),
      reference: 'DSP-1002',
      repairRequestId: requestId,
      customerId,
      shopId,
      category: 'repair_quality',
      subject: 'Repair issue',
      description: 'The device is still not working.',
      status: 'OPEN',
      priority: 'normal',
      createdAt: new Date('2026-11-17T00:00:00.000Z'),
      updatedAt: new Date('2026-11-17T00:00:00.000Z'),
    };
    const disputeQuery = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([dispute]),
    };
    disputes.find.mockReturnValue(disputeQuery);
    disputes.countDocuments.mockResolvedValue(1);
    disputes.aggregate.mockResolvedValue([{ _id: 'OPEN', count: 1 }]);
    users.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({
        accountType: 'shop',
        accountStatus: 'active',
        accountLifecycleStatus: 'active',
      }),
    });
    users.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        {
          _id: customerId,
          firstName: 'Taylor',
          lastName: 'Morgan',
          profileImageData: 'data:image/png;base64,profile',
        },
      ]),
    });
    requests.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        {
          _id: requestId,
          appliance: 'Mobile Phone',
          brand: 'Motorola',
          model: 'Edge 60 Pro',
          description: 'Cracked screen',
          photos: ['data:image/png;base64,repair'],
          status: 'completed',
          createdAt: new Date('2026-11-10T00:00:00.000Z'),
        },
      ]),
    });

    const result = await service.listDisputes(
      { userId: shopId.toString(), role: 'shop' },
      {},
    );

    expect(result.items[0]).toMatchObject({
      parties: {
        customer: {
          id: customerId.toString(),
          name: 'Taylor Morgan',
          profileImageUrl: 'data:image/png;base64,profile',
        },
      },
      repair: {
        appliance: 'Mobile Phone',
        brand: 'Motorola',
        model: 'Edge 60 Pro',
        photos: ['data:image/png;base64,repair'],
      },
    });
  });

  it('includes repair, customer, and shop profiles in the admin dispute list', async () => {
    const dispute = {
      _id: new Types.ObjectId(),
      reference: 'DSP-1003',
      repairRequestId: requestId,
      customerId,
      shopId,
      category: 'repair_quality',
      subject: 'Repair issue',
      description: 'The device is still not working.',
      status: 'OPEN',
      priority: 'normal',
      createdAt: new Date('2026-11-17T00:00:00.000Z'),
      updatedAt: new Date('2026-11-17T00:00:00.000Z'),
    };
    disputes.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([dispute]),
    });
    disputes.countDocuments.mockResolvedValue(1);
    disputes.aggregate.mockResolvedValue([{ _id: 'OPEN', count: 1 }]);
    users.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({
        accountType: 'admin',
        accountStatus: 'active',
        accountLifecycleStatus: 'active',
      }),
    });
    users.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        {
          _id: customerId,
          firstName: 'Taylor',
          lastName: 'Morgan',
          profileImageData: 'data:image/png;base64,customer',
        },
        {
          _id: shopId,
          firstName: 'Sikandar',
          lastName: 'Singh',
          profileImageData: 'data:image/png;base64,owner',
          shopDetails: {
            shopName: 'Sikandar Repairing Shop',
            shopImageData: 'data:image/png;base64,shop',
          },
        },
      ]),
    });
    requests.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        {
          _id: requestId,
          appliance: 'Mobile Phone',
          brand: 'Motorola',
          model: 'Edge 60 Pro',
          description: 'Cracked screen',
          photos: [
            { mimeType: 'image/png', data: 'data:image/png;base64,repair' },
          ],
          status: 'completed',
          createdAt: new Date('2026-11-10T00:00:00.000Z'),
        },
      ]),
    });

    const result = await service.listDisputes(
      { userId: new Types.ObjectId().toString(), role: 'admin' },
      {},
    );

    expect(result.items[0]).toMatchObject({
      parties: {
        customer: {
          name: 'Taylor Morgan',
          profileImageUrl: 'data:image/png;base64,customer',
        },
        shop: {
          name: 'Sikandar Repairing Shop',
          personName: 'Sikandar Singh',
          profileImageUrl: 'data:image/png;base64,owner',
          shopImageUrl: 'data:image/png;base64,shop',
        },
      },
      repair: {
        appliance: 'Mobile Phone',
        brand: 'Motorola',
        model: 'Edge 60 Pro',
        photos: [
          { mimeType: 'image/png', data: 'data:image/png;base64,repair' },
        ],
      },
    });
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

  it('allows a dispute for a completed repair with an accepted quotation', async () => {
    repairRequest.repairJob = {
      acceptedQuotationId: quotationId,
      status: 'completed',
    };

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
  });

  it('rejects a created request that has no accepted shop quotation', async () => {
    delete repairRequest.repairJob;
    delete repairRequest.acceptedQuotationId;

    await expect(
      service.createCustomerDispute(
        { userId: customerId.toString(), role: 'customer' },
        requestId.toString(),
        createInput(),
      ),
    ).rejects.toThrow(/accepted shop quotation/);
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects a pickup-stage dispute before the collection SLA has passed', async () => {
    repairRequest.repairJob = {
      acceptedQuotationId: quotationId,
      status: 'confirmed',
      confirmedAt: new Date(),
    };

    await expect(
      service.createCustomerDispute(
        { userId: customerId.toString(), role: 'customer' },
        requestId.toString(),
        { ...createInput(), category: 'collection' },
      ),
    ).rejects.toThrow(/collection SLA/);
    expect(save).not.toHaveBeenCalled();
  });

  it('allows a pickup-stage dispute after the collection SLA has passed', async () => {
    repairRequest.repairJob = {
      acceptedQuotationId: quotationId,
      status: 'pickup_scheduled',
      servicePickup: {
        scheduledAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      },
    };

    const result = await service.createCustomerDispute(
      { userId: customerId.toString(), role: 'customer' },
      requestId.toString(),
      { ...createInput(), category: 'shop_unresponsive' },
    );

    expect(result).toMatchObject({
      category: 'shop_unresponsive',
      status: 'OPEN',
      shopId,
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('requires a pickup-related category for pickup-stage disputes', async () => {
    repairRequest.repairJob = {
      acceptedQuotationId: quotationId,
      status: 'pickup_scheduled',
      servicePickup: {
        scheduledAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      },
    };

    await expect(
      service.createCustomerDispute(
        { userId: customerId.toString(), role: 'customer' },
        requestId.toString(),
        createInput(),
      ),
    ).rejects.toThrow(/Collection Issue or Shop Unresponsive/);
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects an item-not-returned dispute before the return SLA has passed', async () => {
    repairRequest.repairJob = {
      acceptedQuotationId: quotationId,
      status: 'ready_for_pickup',
      readyForPickupAt: new Date(),
    };

    await expect(
      service.createCustomerDispute(
        { userId: customerId.toString(), role: 'customer' },
        requestId.toString(),
        { ...createInput(), category: 'item_not_returned' },
      ),
    ).rejects.toThrow(/return SLA/);
    expect(save).not.toHaveBeenCalled();
  });

  it('allows an item-not-returned dispute after the return SLA has passed', async () => {
    repairRequest.repairJob = {
      acceptedQuotationId: quotationId,
      status: 'ready_for_pickup',
      readyForPickupAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    };

    const result = await service.createCustomerDispute(
      { userId: customerId.toString(), role: 'customer' },
      requestId.toString(),
      { ...createInput(), category: 'item_not_returned' },
    );

    expect(result).toMatchObject({
      category: 'item_not_returned',
      status: 'OPEN',
      shopId,
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('requires the item-not-returned category for ready-for-pickup disputes', async () => {
    repairRequest.repairJob = {
      acceptedQuotationId: quotationId,
      status: 'ready_for_pickup',
      readyForPickupAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    };

    await expect(
      service.createCustomerDispute(
        { userId: customerId.toString(), role: 'customer' },
        requestId.toString(),
        { ...createInput(), category: 'repair_quality' },
      ),
    ).rejects.toThrow(/Item Not Returned/);
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects a repair that is still in progress', async () => {
    repairRequest.repairJob = {
      acceptedQuotationId: quotationId,
      status: 'in_progress',
    };

    await expect(
      service.createCustomerDispute(
        { userId: customerId.toString(), role: 'customer' },
        requestId.toString(),
        createInput(),
      ),
    ).rejects.toThrow(/picked up or completed/);
    expect(save).not.toHaveBeenCalled();
  });

  it.each(['picked_up', 'completed'])(
    'rejects a %s repair without an accepted quotation',
    async (status) => {
      repairRequest.repairJob = { status };
      delete repairRequest.acceptedQuotationId;

      await expect(
        service.createCustomerDispute(
          { userId: customerId.toString(), role: 'customer' },
          requestId.toString(),
          createInput(),
        ),
      ).rejects.toThrow(/accepted shop quotation/);
      expect(save).not.toHaveBeenCalled();
    },
  );

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

  it('finalizes existing customer-confirmed disputes during startup', async () => {
    const disputeId = new Types.ObjectId();
    const confirmedAt = new Date('2026-10-02T00:00:00.000Z');
    const confirmedDispute = {
      _id: disputeId,
      customerId,
      statusHistory: [
        {
          from: 'CUSTOMER_VERIFICATION_PENDING',
          to: 'CUSTOMER_CONFIRMED',
          actorId: customerId,
          actorRole: 'customer',
          at: confirmedAt,
        },
      ],
      verificationHistory: [
        {
          confirmedBy: customerId,
          confirmedAt,
        },
      ],
    };
    const queryFor = (items: unknown[]) => ({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(items),
    });
    disputes.find.mockImplementation((filter: Record<string, unknown>) =>
      filter.status === 'CUSTOMER_CONFIRMED'
        ? queryFor([confirmedDispute])
        : queryFor([]),
    );
    requests.find.mockReturnValue({
      lean: () => ({ exec: jest.fn().mockResolvedValue([]) }),
    });
    disputes.updateOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    });

    await service.onModuleInit();

    expect(disputes.updateOne).toHaveBeenCalledWith(
      { _id: disputeId, status: 'CUSTOMER_CONFIRMED' },
      expect.objectContaining({
        $set: { status: 'RESOLVED' },
        $push: {
          statusHistory: typedObjectContaining({
            from: 'CUSTOMER_CONFIRMED',
            to: 'RESOLVED',
            actorId: customerId,
            actorRole: 'customer',
            at: confirmedAt,
          }),
        },
        $unset: { activeIssueKey: 1 },
      }),
    );
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

  it('lets the assigned shop close a confirmed dispute and notifies the customer and admin', async () => {
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
      status: 'CUSTOMER_CONFIRMED',
      statusHistory: [],
      resolution: { state: 'accepted' },
    };
    const updatedDispute = { ...currentDispute, status: 'CLOSED' };
    disputes.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(currentDispute),
    });
    disputes.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(updatedDispute),
    });

    const result = await service.closeDispute(
      { userId: shopId.toString(), role: 'shop' },
      currentDispute._id.toString(),
      { reason: 'The customer confirmed the repair.' },
    );

    expect(result).toMatchObject({ status: 'CLOSED' });
    expect(disputes.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: currentDispute._id, status: 'CUSTOMER_CONFIRMED' },
      expect.objectContaining({
        $set: typedObjectContaining({
          status: 'CLOSED',
          closedBy: shopId,
        }),
      }),
      { new: true, runValidators: true },
    );
    expect(notifications.notifyUsers).toHaveBeenCalledWith(
      [customerId],
      expect.objectContaining({ type: 'dispute_closed' }),
    );
  });

  it('does not let the assigned shop close a dispute before customer confirmation', async () => {
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
      exec: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        customerId,
        shopId,
        status: 'UNDER_REVIEW',
        statusHistory: [],
      }),
    });

    await expect(
      service.closeDispute(
        { userId: shopId.toString(), role: 'shop' },
        new Types.ObjectId().toString(),
        { reason: 'The customer confirmed the repair.' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(disputes.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('lets the customer reopen a closed dispute and notifies the shop and admin', async () => {
    const customerQuery = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({
        accountType: 'customer',
        accountStatus: 'active',
        accountLifecycleStatus: 'active',
      }),
    };
    users.findById.mockReturnValue(customerQuery);
    const currentDispute = {
      _id: new Types.ObjectId(),
      reference: 'DSP-1',
      customerId,
      shopId,
      repairRequestId: requestId,
      category: 'repair_quality',
      subject: 'Poor repair quality',
      normalizedSubject: 'poor repair quality',
      status: 'CLOSED',
      statusHistory: [],
      resolution: { state: 'closed' },
    };
    const updatedDispute = { ...currentDispute, status: 'REOPENED' };
    disputes.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(currentDispute),
    });
    disputes.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(updatedDispute),
    });

    const result = await service.reopenDispute(
      { userId: customerId.toString(), role: 'customer' },
      currentDispute._id.toString(),
      { reason: 'The issue returned after the repair.' },
    );

    expect(result).toMatchObject({ status: 'REOPENED' });
    expect(disputes.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: currentDispute._id, status: 'CLOSED' },
      expect.objectContaining({
        $set: typedObjectContaining({
          status: 'REOPENED',
        }),
      }),
      { new: true, runValidators: true },
    );
    expect(notifications.notifyUsers).toHaveBeenCalledWith(
      [shopId],
      expect.objectContaining({ type: 'dispute_reopened' }),
    );
  });

  it('does not allow an administrator to reopen a dispute directly', async () => {
    await expect(
      service.reopenDispute(
        { userId: new Types.ObjectId().toString(), role: 'admin' },
        new Types.ObjectId().toString(),
        { reason: 'Reopen for review.' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(disputes.findOne).not.toHaveBeenCalled();
  });

  it('does not allow a shop to reopen a dispute that is not resolved or closed', async () => {
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
      exec: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        customerId,
        shopId,
        status: 'UNDER_REVIEW',
        statusHistory: [],
      }),
    });

    await expect(
      service.reopenDispute(
        { userId: shopId.toString(), role: 'shop' },
        new Types.ObjectId().toString(),
        { reason: 'Reopen for review.' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
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

  it('keeps a pending resolution decidable when a participant sends a message', async () => {
    const dispute = {
      _id: new Types.ObjectId(),
      reference: 'DSP-1',
      customerId,
      shopId,
      status: 'AWAITING_CUSTOMER_RESPONSE',
      statusHistory: [],
      messages: [],
      internalNotes: [],
      attachments: [],
      reworkProgress: [],
      reworkCompletions: [],
      reinspections: [],
      verificationHistory: [],
      additionalCharges: [],
      resolution: {
        state: 'proposed',
        type: 'repair_again',
        documents: [],
        completionDocuments: [],
      },
    };
    disputes.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(dispute),
    });
    let recordedUpdate: UpdateQuery<Dispute> | undefined;
    disputes.findOneAndUpdate.mockImplementation(
      (_filter: unknown, update: UpdateQuery<Dispute>) => {
        recordedUpdate = update;
        return { exec: jest.fn().mockResolvedValue(dispute) };
      },
    );

    await service.sendMessage(
      { userId: customerId.toString(), role: 'customer' },
      dispute._id.toString(),
      { message: 'I still need to review this proposal.' },
    );

    expect(recordedUpdate?.$set?.status).toBeUndefined();
    expect(recordedUpdate?.$push?.statusHistory).toBeUndefined();
  });

  it('reopens a proposed resolution when the customer reports it unresolved', async () => {
    const dispute = {
      _id: new Types.ObjectId(),
      reference: 'DSP-1',
      customerId,
      shopId,
      status: 'AWAITING_CUSTOMER_RESPONSE',
      statusHistory: [],
      messages: [],
      internalNotes: [],
      attachments: [],
      reworkProgress: [],
      reworkCompletions: [],
      reinspections: [],
      verificationHistory: [],
      additionalCharges: [],
      resolution: {
        state: 'proposed',
        type: 'repair_again',
        documents: [],
        completionDocuments: [],
        customerAcceptedAt: new Date(),
        shopAcceptedAt: new Date(),
      },
    };
    disputes.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(dispute),
    });
    let recordedUpdate: UpdateQuery<Dispute> | undefined;
    disputes.findOneAndUpdate.mockImplementation(
      (_filter: unknown, update: UpdateQuery<Dispute>) => {
        recordedUpdate = update;
        return { exec: jest.fn().mockResolvedValue(dispute) };
      },
    );

    await service.reportUnresolved(
      { userId: customerId.toString(), role: 'customer' },
      dispute._id.toString(),
      { notes: 'The device is still broken.' },
    );

    expect(recordedUpdate?.$set).toMatchObject({
      status: 'REOPENED',
      'resolution.state': 'draft',
    });
  });

  it('resolves the dispute and notifies both parties after customer confirmation', async () => {
    const dispute = {
      _id: new Types.ObjectId(),
      reference: 'DSP-1',
      customerId,
      shopId,
      status: 'CUSTOMER_VERIFICATION_PENDING',
      statusHistory: [
        {
          from: 'REPAIR_IN_PROGRESS',
          to: 'CUSTOMER_VERIFICATION_PENDING',
          actorId: shopId,
          actorRole: 'shop',
          at: new Date('2026-10-02T00:00:00.005Z'),
        },
      ],
      messages: [],
      internalNotes: [],
      attachments: [],
      reworkProgress: [],
      reworkCompletions: [
        {
          workPerformed: 'Replaced the motor',
          testingResults: 'Passed',
          tested: true,
          attachments: [],
          completedBy: shopId,
          completedAt: new Date('2026-10-02T00:00:00.000Z'),
        },
      ],
      reinspections: [],
      verificationHistory: [],
      additionalCharges: [],
      resolution: {
        state: 'draft',
        type: 'repair_again',
        documents: [],
        completionDocuments: [],
      },
    };
    disputes.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(dispute),
    });
    let recordedUpdate: UpdateQuery<Dispute> | undefined;
    disputes.findOneAndUpdate.mockImplementation(
      (_filter: unknown, update: UpdateQuery<Dispute>) => {
        recordedUpdate = update;
        return { exec: jest.fn().mockResolvedValue(dispute) };
      },
    );

    await service.confirmResolution(
      { userId: customerId.toString(), role: 'customer' },
      dispute._id.toString(),
      { message: 'Looks fixed.' },
    );

    expect(recordedUpdate?.$set).toMatchObject({
      status: 'RESOLVED',
    });
    expect(notifications.notifyUsers).toHaveBeenCalledWith(
      [customerId],
      expect.objectContaining({ type: 'dispute_resolved' }),
    );
    expect(notifications.notifyUsers).toHaveBeenCalledWith(
      [shopId],
      expect.objectContaining({ type: 'dispute_resolved' }),
    );
  });

  it('rejects customer confirmation backed by a stale rework completion', async () => {
    const dispute = {
      _id: new Types.ObjectId(),
      reference: 'DSP-1',
      customerId,
      shopId,
      status: 'AWAITING_CUSTOMER_RESPONSE',
      statusHistory: [
        {
          from: 'AWAITING_SHOP_RESPONSE',
          to: 'AWAITING_CUSTOMER_RESPONSE',
          actorId: shopId,
          actorRole: 'shop',
          at: new Date('2026-10-02T00:00:00.000Z'),
        },
      ],
      messages: [],
      internalNotes: [],
      attachments: [],
      reworkProgress: [],
      reworkCompletions: [
        {
          workPerformed: 'Replaced the motor',
          testingResults: 'Passed',
          tested: true,
          attachments: [],
          completedBy: shopId,
          completedAt: new Date('2026-10-01T00:00:00.000Z'),
        },
      ],
      reinspections: [],
      verificationHistory: [],
      additionalCharges: [],
      resolution: {
        state: 'proposed',
        type: 'repair_again',
        documents: [],
        completionDocuments: [],
      },
    };
    disputes.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(dispute),
    });

    await expect(
      service.confirmResolution(
        { userId: customerId.toString(), role: 'customer' },
        dispute._id.toString(),
        { message: 'Looks fixed.' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(disputes.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('scopes technician dispute lists to assigned repair requests and hides internal notes', async () => {
    const technicianId = new Types.ObjectId();
    const assignedRequestId = new Types.ObjectId();
    const technicianUser = {
      accountType: 'technician',
      accountStatus: 'active',
      accountLifecycleStatus: 'active',
      technicianDetails: { shopId },
    };
    users.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(technicianUser),
    });
    requests.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([{ _id: assignedRequestId }]),
    });
    disputes.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        {
          _id: new Types.ObjectId(),
          reference: 'DSP-1',
          status: 'OPEN',
          internalNotes: [{ message: 'Private shop note' }],
        },
      ]),
    });
    disputes.countDocuments.mockResolvedValue(1);
    disputes.aggregate.mockResolvedValue([{ _id: 'OPEN', count: 1 }]);

    const result = await service.listDisputes(
      { userId: technicianId.toString(), role: 'technician' },
      { page: 1, limit: 10 },
    );

    expect(requests.find).toHaveBeenCalledWith(
      expect.objectContaining({
        shopIds: shopId,
        $or: [
          { 'repairJob.activeAssignment.technicianId': technicianId },
          { 'repairJob.assignmentHistory.technicianId': technicianId },
          { 'repairJob.assignmentHistory.previousTechnicianId': technicianId },
        ],
      }),
    );
    expect(disputes.find).toHaveBeenCalledWith(
      expect.objectContaining({
        shopId,
        repairRequestId: { $in: [assignedRequestId] },
      }),
    );
    expect(result.items[0]).not.toHaveProperty('internalNotes');
  });

  it('does not disclose disputes for repair requests not assigned to the technician', async () => {
    const technicianId = new Types.ObjectId();
    const disputeId = new Types.ObjectId();
    users.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({
        accountType: 'technician',
        accountStatus: 'active',
        accountLifecycleStatus: 'active',
        technicianDetails: { shopId },
      }),
    });
    requests.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    });
    disputes.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    await expect(
      service.getDispute(
        { userId: technicianId.toString(), role: 'technician' },
        disputeId.toString(),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(disputes.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: disputeId,
        shopId,
        repairRequestId: { $in: [] },
      }),
    );
  });

  it('returns dispute, repair, and participant details to the customer detail page', async () => {
    const disputeId = new Types.ObjectId();
    const createdAt = new Date('2026-11-19T10:00:00.000Z');
    const disputeRecord = {
      _id: disputeId,
      reference: 'DSP-DETAIL-1',
      repairRequestId: requestId,
      customerId,
      shopId,
      category: 'repair_quality',
      subject: 'Repair issue',
      description: 'The repair did not fix the issue.',
      expectedResolution: 'Repair the device again.',
      attachments: [],
      status: 'OPEN',
      priority: 'normal',
      messages: [],
      statusHistory: [
        {
          from: 'NONE',
          to: 'OPEN',
          actorId: customerId,
          actorRole: 'customer',
          at: createdAt,
        },
      ],
      resolution: { documents: [], completionDocuments: [], requiredActionCompleted: false },
      reinspections: [],
      additionalCharges: [],
      reworkProgress: [],
      reworkCompletions: [],
      verificationHistory: [],
      createdAt,
      updatedAt: createdAt,
    };
    const statusHistorySubdocument = {
      __parentArray: [],
      __index: 0,
      $__: {},
      $isNew: false,
      ...disputeRecord.statusHistory[0],
      toObject: () => disputeRecord.statusHistory[0],
    };
    const request = {
      ...repairRequest,
      acceptedQuotationId: undefined,
      appliance: 'Phone',
      brand: 'Example',
      model: 'Model One',
      description: 'Screen replacement',
      photos: [],
      status: 'completed',
      createdAt,
      repairJob: { status: 'completed', acceptedQuotationId: undefined },
    };
    const userQuery = (user: Record<string, unknown>) => ({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(user),
    });
    const recordQuery = {
      exec: jest.fn().mockResolvedValue({
        ...disputeRecord,
        statusHistory: [statusHistorySubdocument],
        toObject: () => disputeRecord,
      }),
    };
    disputes.findOne.mockReturnValue(recordQuery);
    requests.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(request),
    });
    users.findById
      .mockReturnValueOnce(
        userQuery({
          accountType: 'customer',
          accountStatus: 'active',
          accountLifecycleStatus: 'active',
        }),
      )
      .mockReturnValueOnce(
        userQuery({
          _id: customerId,
          firstName: 'Taylor',
          lastName: 'Morgan',
          email: 'taylor@example.com',
        }),
      )
      .mockReturnValueOnce(
        userQuery({
          _id: shopId,
          firstName: 'Repair',
          lastName: 'Owner',
          email: 'shop@example.com',
          shopDetails: { shopName: 'Fixora Repair' },
        }),
      );

    const result = await service.getDispute(
      { userId: customerId.toString(), role: 'customer' },
      disputeId.toString(),
    );

    expect(result).toMatchObject({
      reference: 'DSP-DETAIL-1',
      category: 'repair_quality',
      status: 'OPEN',
      priority: 'normal',
      createdAt,
      parties: {
        customer: { name: 'Taylor Morgan', email: 'taylor@example.com' },
        shop: { name: 'Fixora Repair', email: 'shop@example.com' },
      },
      repair: {
        appliance: 'Phone',
        brand: 'Example',
        model: 'Model One',
        status: 'completed',
      },
    });
    expect(result.statusHistory[0]).toMatchObject({
      from: 'NONE',
      to: 'OPEN',
      actorName: 'Taylor Morgan',
    });
    expect(result.statusHistory[0]).not.toHaveProperty('__parentArray');
  });
});
