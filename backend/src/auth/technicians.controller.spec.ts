import { TechnicianPortalController } from './technicians.controller';

describe('TechnicianPortalController additional charges', () => {
  it('scopes additional-charge requests to the authenticated technician assignment', async () => {
    const input = {
      action: 'submit',
      issue: 'Damaged connector',
    };
    const technicians = {
      technicianJobShopId: jest.fn().mockResolvedValue('shop-1'),
    };
    const customerPortal = {
      requestAdditionalCharges: jest
        .fn()
        .mockResolvedValue({ _id: 'charge-1' }),
    };
    const controller = new TechnicianPortalController(
      technicians as never,
      customerPortal as never,
    );

    await expect(
      controller.requestAdditionalCharges(
        { auth: { userId: 'technician-1' } } as never,
        'request-1',
        input as never,
      ),
    ).resolves.toEqual({
      data: { chargeRequest: { _id: 'charge-1' } },
    });

    expect(technicians.technicianJobShopId).toHaveBeenCalledWith(
      'technician-1',
      'request-1',
    );
    expect(customerPortal.requestAdditionalCharges).toHaveBeenCalledWith(
      'shop-1',
      'request-1',
      input,
      'technician-1',
    );
  });

  it('does not request charges when the technician is not assigned to the job', async () => {
    const technicians = {
      technicianJobShopId: jest.fn().mockRejectedValue(new Error('Not assigned')),
    };
    const customerPortal = {
      requestAdditionalCharges: jest.fn(),
    };
    const controller = new TechnicianPortalController(
      technicians as never,
      customerPortal as never,
    );

    await expect(
      controller.requestAdditionalCharges(
        { auth: { userId: 'technician-1' } } as never,
        'request-1',
        { action: 'submit' } as never,
      ),
    ).rejects.toThrow('Not assigned');

    expect(customerPortal.requestAdditionalCharges).not.toHaveBeenCalled();
  });
});
