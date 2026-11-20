import 'reflect-metadata';
import {
  CustomerRepairInvoicesController,
  ShopRepairInvoicesController,
} from './repair-invoices.controller';
import { RepairInvoicesService } from './repair-invoices.service';

jest.mock('pdfkit', () => ({ __esModule: true, default: jest.fn() }));

describe('Repair invoice controllers', () => {
  it('returns the standard data envelope from the draft endpoint', async () => {
    const result = { invoice: { id: 'invoice-123' } };
    const invoices = {
      createDraft: jest.fn().mockResolvedValue(result),
    } as unknown as RepairInvoicesService;
    const controller = new ShopRepairInvoicesController(invoices);

    await expect(
      controller.createDraft(
        { auth: { userId: 'shop-123' } } as never,
        'repair-123',
      ),
    ).resolves.toEqual({ data: result });
  });

  it('returns the standard data envelope from the customer invoice endpoint', async () => {
    const result = { invoice: null };
    const invoices = {
      getCustomerInvoiceForRepair: jest.fn().mockResolvedValue(result),
    } as unknown as RepairInvoicesService;
    const controller = new CustomerRepairInvoicesController(invoices);

    await expect(
      controller.getForRepair(
        { auth: { userId: 'customer-123' } } as never,
        'repair-123',
      ),
    ).resolves.toEqual({ data: result });
  });
});
