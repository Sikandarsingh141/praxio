import { DisputeListQueryDto } from './dto/dispute.dto';
import {
  CustomerDisputesController,
  ShopDisputesController,
  TechnicianDisputesController,
} from './disputes.controller';
import { DisputesService } from './disputes.service';

describe('CustomerDisputesController', () => {
  it('reopens a dispute with the customer actor', async () => {
    const result = { _id: 'dispute-id', status: 'REOPENED' };
    const disputesService = {
      reopenDispute: jest.fn().mockResolvedValue(result),
    };
    const controller = new CustomerDisputesController(
      disputesService as unknown as DisputesService,
    );
    const dto = { reason: 'The issue remains unresolved.' };

    await expect(
      controller.reopen(
        { auth: { userId: 'customer-user-id' } },
        'dispute-id',
        dto,
      ),
    ).resolves.toEqual({ data: result });
    expect(disputesService.reopenDispute).toHaveBeenCalledWith(
      { userId: 'customer-user-id', role: 'customer' },
      'dispute-id',
      dto,
    );
  });
});

describe('ShopDisputesController', () => {
  it('returns the Shop dispute list in the API data envelope', async () => {
    const result = {
      items: [{ _id: 'dispute-id', subject: 'Repair issue' }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    };
    const disputesService = {
      listDisputes: jest.fn().mockResolvedValue(result),
    };
    const controller = new ShopDisputesController(
      disputesService as unknown as DisputesService,
    );
    const request = { auth: { userId: 'shop-user-id' } };
    const query = new DisputeListQueryDto();

    await expect(controller.list(request, query)).resolves.toEqual({
      data: result,
    });
    expect(disputesService.listDisputes).toHaveBeenCalledWith(
      { userId: 'shop-user-id', role: 'shop' },
      query,
    );
  });
});

describe('ShopDisputesController reopen', () => {
  it('reopens a dispute with the shop actor', async () => {
    const result = { _id: 'dispute-id', status: 'REOPENED' };
    const disputesService = {
      reopenDispute: jest.fn().mockResolvedValue(result),
    };
    const controller = new ShopDisputesController(
      disputesService as unknown as DisputesService,
    );
    const dto = { reason: 'Customer asked us to review again.' };

    await expect(
      controller.reopen(
        { auth: { userId: 'shop-user-id' } },
        'dispute-id',
        dto,
      ),
    ).resolves.toEqual({ data: result });
    expect(disputesService.reopenDispute).toHaveBeenCalledWith(
      { userId: 'shop-user-id', role: 'shop' },
      'dispute-id',
      dto,
    );
  });
});

describe('TechnicianDisputesController', () => {
  it('returns the Technician dispute list in the API data envelope', async () => {
    const result = {
      items: [{ _id: 'dispute-id', subject: 'Repair issue' }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    };
    const disputesService = {
      listDisputes: jest.fn().mockResolvedValue(result),
      getDispute: jest.fn(),
    };
    const controller = new TechnicianDisputesController(
      disputesService as unknown as DisputesService,
    );
    const request = { auth: { userId: 'technician-user-id' } };
    const query = new DisputeListQueryDto();

    await expect(controller.list(request, query)).resolves.toEqual({
      data: result,
    });
    expect(disputesService.listDisputes).toHaveBeenCalledWith(
      { userId: 'technician-user-id', role: 'technician' },
      query,
    );
  });

  it('returns a Technician dispute detail in the API data envelope', async () => {
    const result = { _id: 'dispute-id', reference: 'DSP-1' };
    const disputesService = {
      listDisputes: jest.fn(),
      getDispute: jest.fn().mockResolvedValue(result),
    };
    const controller = new TechnicianDisputesController(
      disputesService as unknown as DisputesService,
    );

    await expect(
      controller.detail(
        { auth: { userId: 'technician-user-id' } },
        'dispute-id',
      ),
    ).resolves.toEqual({ data: result });
    expect(disputesService.getDispute).toHaveBeenCalledWith(
      { userId: 'technician-user-id', role: 'technician' },
      'dispute-id',
    );
  });
});
