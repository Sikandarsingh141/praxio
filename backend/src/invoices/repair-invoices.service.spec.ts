import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
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
  ShopInvoiceListQueryDto,
  ShopFinancialTransactionsQueryDto,
} from './repair-invoices.dto';
import { RepairInvoice, RepairInvoiceSequence } from './repair-invoice.schema';
import { RepairInvoicesService } from './repair-invoices.service';

jest.mock('pdfkit', () => ({ __esModule: true, default: jest.fn() }));

interface CapturedPipelineStage {
  [stage: string]: unknown;
  $match?: Record<string, unknown>;
  $facet?: Record<string, CapturedPipelineStage[]>;
}

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
  const invoiceListQuery = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  };
  const invoiceCountQuery = { exec: jest.fn() };
  const customerListQuery = {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  };
  const aggregate = jest.fn<
    { exec: () => Promise<unknown[]> },
    [CapturedPipelineStage[]]
  >();
  const repairInvoices = {
    findOne: jest.fn().mockReturnValue(invoiceQuery),
    find: jest.fn().mockReturnValue(invoiceListQuery),
    countDocuments: jest.fn().mockReturnValue(invoiceCountQuery),
    aggregate,
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
  const users = {
    findById: jest.fn().mockReturnValue(userQuery),
    find: jest.fn().mockReturnValue(customerListQuery),
  };
  const notifications = { notifyUsers: jest.fn().mockResolvedValue(undefined) };
  let service: RepairInvoicesService;

  beforeEach(() => {
    invoice.invoiceStatus = 'issued';
    invoice.paymentStatus = 'UNPAID';
    invoice.amountPaid = 0;
    invoice.balanceDue = 100;
    invoice.customer.name = 'Customer';
    invoice.payments.splice(0);
    notifications.notifyUsers.mockClear();
    repairInvoices.findOneAndUpdate.mockClear();
    repairInvoices.findOneAndUpdate.mockReturnValue(cancelQuery);
    aggregate.mockReset();
    invoiceListQuery.exec.mockResolvedValue([invoice]);
    invoiceCountQuery.exec.mockResolvedValue(1);
    customerListQuery.exec.mockResolvedValue([
      {
        _id: invoice.customerId,
        firstName: 'Sikandar',
        lastName: 'Customer',
        profileImageData: 'data:image/png;base64,avatar',
      },
    ]);
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

  it('includes customer profile images in the shop invoice list', async () => {
    const result = await service.listShopInvoices(
      shopId.toString(),
      {} as ShopInvoiceListQueryDto,
    );

    expect(result.invoices[0]?.customer.name).toBe('Sikandar Customer');
    expect(result.invoices[0]?.customer.profileImageUrl).toBe(
      'data:image/png;base64,avatar',
    );
    expect(users.find).toHaveBeenCalledWith({
      _id: { $in: [invoice.customerId] },
    });
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

  it('aggregates report values by currency and counts only successful payments', async () => {
    const report = {
      invoiceCounts: [
        { _id: { invoiceStatus: 'issued', paymentStatus: 'PAID' }, count: 2 },
      ],
      revenueByCurrency: [
        {
          _id: 'USD',
          amount: 200,
          invoiceCount: 2,
          averageInvoiceValue: 100,
        },
      ],
      collectionsByMethod: [
        {
          _id: { currency: 'USD', method: 'cash' },
          amount: 40,
          paymentCount: 1,
        },
      ],
      outstandingByCurrency: [],
      taxByRate: [],
      revenueByCategory: [],
      revenueTrend: [],
      recentTransactions: [],
      completedRepairs: [{ count: 4 }],
    };
    aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([report]),
    });

    await expect(
      service.getShopFinancialReport(shopId.toString(), {
        from: '2026-11-01',
        to: '2026-11-30',
      }),
    ).resolves.toMatchObject({
      revenueByCurrency: report.revenueByCurrency,
      collectionsByMethod: report.collectionsByMethod,
      completedRepairs: 4,
      recentTransactions: [],
      refunds: { trackingAvailable: false, count: 0 },
      period: {
        from: '2026-11-01T00:00:00.000Z',
        to: '2026-11-30T23:59:59.999Z',
      },
    });

    const pipeline = aggregate.mock.calls[0]?.[0];
    expect(pipeline?.[0]?.$match).toEqual({ shopId });
    expect(pipeline?.[1]?.$facet?.collectionsByMethod).toContainEqual({
      $match: {
        'payments.status': 'succeeded',
        'payments.paymentDate': {
          $gte: new Date('2026-11-01T00:00:00.000Z'),
          $lte: new Date('2026-11-30T23:59:59.999Z'),
        },
      },
    });
    expect(pipeline?.[1]?.$facet?.completedRepairs).toContainEqual({
      $match: {
        invoiceStatus: 'issued',
        'repair.completedAt': {
          $type: 'date',
          $gte: new Date('2026-11-01T00:00:00.000Z'),
          $lte: new Date('2026-11-30T23:59:59.999Z'),
        },
      },
    });
    expect(pipeline?.[1]?.$facet?.recentTransactions).toContainEqual({
      $limit: 5,
    });
  });

  it('rejects invalid financial reporting date ranges', async () => {
    await expect(
      service.getShopFinancialReport(shopId.toString(), {
        from: '2026-11-30',
        to: '2026-11-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(aggregate).not.toHaveBeenCalled();
  });

  it('scopes payment transaction queries to the shop and requested payment status', async () => {
    aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([{ transactions: [], total: [] }]),
    });
    const query: ShopFinancialTransactionsQueryDto = {
      status: 'failed',
      page: 1,
      limit: 10,
      sortBy: 'date',
      sortOrder: 'desc',
    };

    await expect(
      service.listShopFinancialTransactions(shopId.toString(), query),
    ).resolves.toMatchObject({
      transactions: [],
      pagination: { page: 1, total: 0, totalPages: 0 },
    });

    const pipeline = aggregate.mock.calls[0]?.[0];
    expect(pipeline?.[0]?.$match).toEqual({
      shopId,
      invoiceStatus: { $in: ['issued', 'cancelled'] },
    });
    expect(pipeline?.[2]?.$match).toEqual({ 'payments.status': 'failed' });
  });
});
