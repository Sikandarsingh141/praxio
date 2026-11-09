import { DisputeListQueryDto } from './dto/dispute.dto';
import { ShopDisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';

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
