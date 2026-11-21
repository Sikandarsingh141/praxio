import 'reflect-metadata';
import { Model, Types } from 'mongoose';
import {
  RepairQuotation,
  RepairRequest,
} from '../customer/repair-request.schema';
import { StripePaymentsService } from '../payments/stripe-payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/schemas/user.schema';
import {
  InvoicePaymentMethod,
  RecordInvoicePaymentDto,
} from './repair-invoices.dto';
import { RepairInvoice, RepairInvoiceSequence } from './repair-invoice.schema';
import { RepairInvoicesService } from './repair-invoices.service';

jest.mock('pdfkit', () => ({ __esModule: true, default: jest.fn() }));

describe('RepairInvoicesService', () => {
  const shopId = new Types.ObjectId();
  const invoiceId = new Types.ObjectId();
  const invoice = {
    _id: invoiceId,
    repairRequestId: new Types.ObjectId(),
    shopId,
    customerId: new Types.ObjectId(),
    invoiceNumber: 'FIX-INV-2026-000001',
    invoiceDate: new Date('2026-11-20T00:00:00.000Z'),
    dueDate: null,
    invoiceStatus: 'issued',
    paymentStatus: 'UNPAID',
    currency: 'USD',
    items: [],
    subtotal: 100,
    discount: 0,
    taxableAmount: 100,
    taxDetails: [],
    grandTotal: 100,
    amountPaid: 0,
    balanceDue: 100,
    customer: { name: 'Customer' },
    shop: { name: 'Repair Shop' },
    repair: {
      category: 'Electronics',
      productName: 'Phone',
      problemDescription: 'Screen repair',
      completedAt: null,
    },
    payments: [] as Array<{
      _id?: Types.ObjectId;
      amount: number;
      currency: string;
      method: string;
      status: string;
      reference: string | null;
      paymentDate: Date;
      recordedAt: Date;
      recordedByName: string;
    }>,
    pdfFileIds: [] as Types.ObjectId[],
    save: jest.fn(() => {
      const payment = invoice.payments[invoice.payments.length - 1];
      if (payment && !payment._id) payment._id = new Types.ObjectId();
    }),
  };
  const invoiceQuery = { exec: jest.fn() };
  const cancelQuery = { exec: jest.fn() };
  const userQuery = { exec: jest.fn() };
  const repairInvoices = {
    findOne: jest.fn().mockReturnValue(invoiceQuery),
    findOneAndUpdate: jest
      .fn<
        typeof cancelQuery,
        [
          Record<string, unknown>,
          Record<string, unknown>,
          Record<string, unknown>,
        ]
      >()
      .mockReturnValue(cancelQuery),
  };
  const users = { findById: jest.fn().mockReturnValue(userQuery) };
  const notifications = { notifyUsers: jest.fn().mockResolvedValue(undefined) };
  let service: RepairInvoicesService;

  beforeEach(() => {
    invoice.invoiceStatus = 'issued';
    invoice.paymentStatus = 'UNPAID';
    invoice.amountPaid = 0;
    invoice.balanceDue = 100;
    invoice.payments.splice(0);
    notifications.notifyUsers.mockClear();
    repairInvoices.findOneAndUpdate.mockClear();
    repairInvoices.findOneAndUpdate.mockReturnValue(cancelQuery);
    invoiceQuery.exec.mockResolvedValue(invoice);
    userQuery.exec.mockResolvedValue({
      _id: shopId,
      accountType: 'shop',
      accountStatus: 'active',
      shopDetails: {},
      email: 'shop@example.com',
      firstName: 'Shop',
      lastName: 'Owner',
    });
    cancelQuery.exec.mockResolvedValue(invoice);
    service = new RepairInvoicesService(
      repairInvoices as unknown as Model<RepairInvoice>,
      {} as Model<RepairInvoiceSequence>,
      {} as Model<RepairRequest>,
      {} as Model<RepairQuotation>,
      users as unknown as Model<User>,
      {} as never,
      {} as StripePaymentsService,
      notifications as unknown as NotificationsService,
    );
  });

  it('notifies the customer after the shop successfully issues an invoice', async () => {
    invoice.invoiceStatus = 'draft';
    const issuedInvoice = {
      ...invoice,
      invoiceStatus: 'issued',
      pdfFileIds: [new Types.ObjectId()],
    };
    const claimedInvoice = {
      ...invoice,
      invoiceStatus: 'draft',
      issuing: true,
      save: jest.fn().mockResolvedValue(undefined),
    };
    repairInvoices.findOneAndUpdate
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(claimedInvoice),
      })
      .mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(issuedInvoice),
      });
    Object.defineProperty(service, 'generatePdf', {
      value: jest.fn().mockResolvedValue(Buffer.from('invoice PDF')),
    });
    Object.defineProperty(service, 'savePdf', {
      value: jest.fn().mockResolvedValue(new Types.ObjectId()),
    });

    const result = await service.issueInvoice(
      shopId.toString(),
      invoiceId.toString(),
    );

    expect(result.invoice.invoiceStatus).toBe('issued');
    expect(notifications.notifyUsers).toHaveBeenCalledTimes(1);
    expect(notifications.notifyUsers).toHaveBeenCalledWith(
      [invoice.customerId],
      expect.objectContaining({
        title: 'New Repair Invoice',
        type: 'repair_invoice_issued',
        relatedEntityId: invoice.repairRequestId,
        relatedEntityType: 'repair_request',
        link: `/customer/jobs/completed-jobs/${invoice.repairRequestId.toString()}`,
      }),
    );
  });

  it('records an append-only partial manual payment and updates the invoice balance', async () => {
    const payment: RecordInvoicePaymentDto = {
      amount: 25,
      method: InvoicePaymentMethod.Cash,
      paymentDate: '2026-11-19T00:00:00.000Z',
      reference: 'cash receipt 42',
    };

    const result = await service.recordManualPayment(
      shopId.toString(),
      invoiceId.toString(),
      payment,
    );

    expect(invoice.payments).toHaveLength(1);
    expect(invoice.payments[0]).toMatchObject({
      amount: 25,
      method: 'cash',
      status: 'succeeded',
      reference: 'cash receipt 42',
      recordedByName: 'Shop Owner',
    });
    expect(invoice.amountPaid).toBe(25);
    expect(invoice.balanceDue).toBe(75);
    expect(invoice.paymentStatus).toBe('PARTIALLY_PAID');
    expect(result.invoice.balanceDue).toBe(75);
    expect(invoice.save).toHaveBeenCalledTimes(1);
  });

  it('cancels only unpaid invoices while retaining their stored PDF history', async () => {
    invoice.invoiceStatus = 'cancelled';
    invoice.pdfFileIds.push(new Types.ObjectId());
    cancelQuery.exec.mockResolvedValueOnce(invoice);

    const result = await service.cancelInvoice(
      shopId.toString(),
      invoiceId.toString(),
    );

    expect(repairInvoices.findOneAndUpdate.mock.calls[0]?.[0]).toMatchObject({
      shopId,
    });
    expect(result.invoice.invoiceStatus).toBe('cancelled');
    expect(result.invoice.pdfAvailable).toBe(true);
  });
});
