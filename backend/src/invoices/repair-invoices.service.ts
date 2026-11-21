import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import {
  Connection,
  FilterQuery,
  HydratedDocument,
  Model,
  mongo,
  Types,
} from 'mongoose';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import {
  RepairQuotation,
  RepairRequest,
} from '../customer/repair-request.schema';
import { StripePaymentsService } from '../payments/stripe-payments.service';
import { User } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';
import {
  RecordInvoicePaymentDto,
  ShopInvoiceListQueryDto,
} from './repair-invoices.dto';
import {
  RepairInvoice,
  RepairInvoiceDocument,
  RepairInvoiceLineItem,
  RepairInvoicePayment,
  RepairInvoiceSequence,
} from './repair-invoice.schema';
import {
  currencyFractionDigits,
  roundCurrencyAmount,
} from './repair-invoice-money.util';

export interface InvoiceView {
  id: string;
  repairRequestId: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  invoiceStatus: RepairInvoice['invoiceStatus'];
  paymentStatus: RepairInvoice['paymentStatus'];
  currency: string;
  items: RepairInvoiceLineItem[];
  subtotal: number;
  discount: number;
  taxableAmount: number;
  taxDetails: RepairInvoice['taxDetails'];
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  customer: RepairInvoice['customer'];
  shop: RepairInvoice['shop'];
  repair: Omit<RepairInvoice['repair'], 'completedAt'> & {
    completedAt: string | null;
  };
  payments: Array<{
    id: string;
    amount: number;
    currency: string;
    method: RepairInvoicePayment['method'];
    status: RepairInvoicePayment['status'];
    reference: string | null;
    paymentDate: string;
    recordedAt: string;
    recordedBy: string;
  }>;
  pdfAvailable: boolean;
}

@Injectable()
export class RepairInvoicesService {
  private readonly logger = new Logger(RepairInvoicesService.name);

  constructor(
    @InjectModel(RepairInvoice.name)
    private readonly repairInvoices: Model<RepairInvoice>,
    @InjectModel(RepairInvoiceSequence.name)
    private readonly invoiceSequences: Model<RepairInvoiceSequence>,
    @InjectModel(RepairRequest.name)
    private readonly repairRequests: Model<RepairRequest>,
    @InjectModel(RepairQuotation.name)
    private readonly repairQuotations: Model<RepairQuotation>,
    @InjectModel(User.name)
    private readonly users: Model<User>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly stripePayments: StripePaymentsService,
    private readonly notifications: NotificationsService,
  ) {}

  async getShopInvoiceForRepair(userId: string, repairRequestId: string) {
    const { request, shop } = await this.getShopRepairContext(
      userId,
      repairRequestId,
    );
    const invoice = await this.repairInvoices
      .findOne({ repairRequestId: request._id, shopId: shop._id })
      .exec();
    return { invoice: invoice ? this.toView(invoice) : null };
  }

  async createDraft(userId: string, repairRequestId: string) {
    const { shop, customer, request, quotation } =
      await this.getShopRepairContext(userId, repairRequestId);
    this.assertCompleted(request);

    const existing = await this.repairInvoices
      .findOne({ repairRequestId: request._id })
      .exec();
    if (existing) {
      if (String(existing.shopId) !== userId) {
        throw new NotFoundException('Invoice was not found.');
      }
      return { invoice: this.toView(existing) };
    }

    const items = this.buildLineItems(quotation, request);
    const subtotal = roundCurrencyAmount(
      items.reduce((total, item) => total + item.amount, 0),
      quotation.currency,
    );
    if (subtotal <= 0)
      throw new BadRequestException('The repair has no billable charges.');

    const invoice = new this.repairInvoices({
      repairRequestId: request._id,
      shopId: shop._id,
      customerId: customer._id,
      invoiceNumber: null,
      invoiceDate: null,
      dueDate: null,
      invoiceStatus: 'draft',
      paymentStatus: 'UNPAID',
      currency: quotation.currency.toUpperCase(),
      items,
      subtotal,
      discount: 0,
      taxableAmount: subtotal,
      taxDetails: [],
      grandTotal: subtotal,
      amountPaid: 0,
      balanceDue: subtotal,
      shop: {
        name: shop.shopDetails?.shopName || 'Repair shop',
        ownerName: this.userName(shop) || null,
        address: this.shopAddress(shop),
        phone: this.phone(shop),
        email: shop.email || null,
        logoData: shop.shopDetails?.shopImageData || null,
        gstin: null,
      },
      customer: {
        name: this.userName(customer) || customer.email || 'Customer',
        ownerName: null,
        address: null,
        phone: this.phone(customer),
        email: customer.email || null,
        logoData: null,
        gstin: null,
      },
      repair: {
        category: request.appliance || 'Repair service',
        productName: request.appliance || 'Repair service',
        brand: request.brand || null,
        model: request.get('model') || null,
        problemDescription:
          request.description || 'No problem description provided.',
        completedAt:
          request.repairJob?.completedAt ??
          request.repairJob?.repairCompletedAt ??
          null,
        serviceType: request.serviceType || null,
      },
      payments: [],
      pdfFileIds: [],
    });

    try {
      await invoice.save();
      return { invoice: this.toView(invoice) };
    } catch (error) {
      if (!this.isDuplicateKeyError(error)) throw error;
      const racedInvoice = await this.repairInvoices
        .findOne({ repairRequestId: request._id })
        .exec();
      if (!racedInvoice || String(racedInvoice.shopId) !== userId) {
        throw new ConflictException(
          'An invoice already exists for this repair.',
        );
      }
      return { invoice: this.toView(racedInvoice) };
    }
  }

  async previewShopDraft(userId: string, invoiceId: string): Promise<Buffer> {
    const invoice = await this.getShopInvoice(userId, invoiceId);
    if (invoice.invoiceStatus !== 'draft') {
      throw new ConflictException('Only a draft invoice can be previewed.');
    }
    return this.generatePdf(invoice, 'DRAFT PREVIEW', new Date());
  }

  async issueInvoice(userId: string, invoiceId: string) {
    const invoice = await this.getShopInvoice(userId, invoiceId);
    if (invoice.invoiceStatus === 'issued') {
      await this.notifyCustomerOfIssuedInvoice(invoice);
      return { invoice: this.toView(invoice) };
    }
    if (invoice.invoiceStatus !== 'draft') {
      throw new ConflictException('This invoice cannot be issued.');
    }

    const now = new Date();
    const staleLock = new Date(now.getTime() - 5 * 60 * 1000);
    const claimed = await this.repairInvoices
      .findOneAndUpdate(
        {
          _id: invoice._id,
          invoiceStatus: 'draft',
          $or: [
            { issuing: false },
            { issuing: true, issueStartedAt: { $lt: staleLock } },
            { issuing: true, issueStartedAt: null },
          ],
        },
        { $set: { issuing: true, issueStartedAt: now } },
        { new: true },
      )
      .exec();
    if (!claimed) {
      throw new ConflictException('Invoice issuance is already in progress.');
    }

    let uploadedFileId: Types.ObjectId | null = null;
    let issued: RepairInvoiceDocument | null = null;
    try {
      const invoiceNumber =
        claimed.invoiceNumber ||
        (await this.nextInvoiceNumber(now.getUTCFullYear()));
      if (!claimed.invoiceNumber) {
        claimed.invoiceNumber = invoiceNumber;
        await claimed.save();
      }
      claimed.invoiceDate = now;
      const pdf = await this.generatePdf(claimed, invoiceNumber, now);
      uploadedFileId = await this.savePdf(claimed, invoiceNumber, pdf);

      issued = await this.repairInvoices
        .findOneAndUpdate(
          { _id: claimed._id, invoiceStatus: 'draft', issuing: true },
          {
            $set: {
              invoiceStatus: 'issued',
              invoiceDate: now,
              issuing: false,
              issueStartedAt: null,
            },
            $push: { pdfFileIds: uploadedFileId },
          },
          { new: true },
        )
        .exec();
      if (!issued)
        throw new ConflictException('The invoice could not be finalized.');
    } catch (error) {
      if (uploadedFileId) {
        try {
          await this.gridFs().delete(uploadedFileId);
        } catch (cleanupError) {
          this.logger.error(
            'Could not remove an unused invoice PDF from GridFS.',
            cleanupError,
          );
        }
      }
      await this.repairInvoices
        .updateOne(
          { _id: claimed._id, invoiceStatus: 'draft', issuing: true },
          { $set: { issuing: false, issueStartedAt: null } },
        )
        .exec();
      throw error;
    }

    if (!issued)
      throw new ConflictException('The invoice could not be finalized.');
    await this.notifyCustomerOfIssuedInvoice(issued);
    return { invoice: this.toView(issued) };
  }

  private notifyCustomerOfIssuedInvoice(
    invoice: RepairInvoiceDocument,
  ): Promise<void> {
    return this.notifications.notifyUsers([invoice.customerId], {
      title: 'New Repair Invoice',
      message: `${invoice.shop.name} has issued invoice ${invoice.invoiceNumber} for your repair.`,
      type: 'repair_invoice_issued',
      relatedEntityId: invoice.repairRequestId,
      relatedEntityType: 'repair_request',
      link: `/customer/jobs/completed-jobs/${invoice.repairRequestId.toString()}`,
      deduplicationKey: `repair-invoice-issued:${invoice._id.toString()}:${invoice.customerId.toString()}`,
    });
  }

  async cancelInvoice(userId: string, invoiceId: string) {
    const shop = await this.requireShop(userId);
    this.assertObjectId(invoiceId, 'Invoice');
    const cancelled = await this.repairInvoices
      .findOneAndUpdate(
        {
          _id: invoiceId,
          shopId: shop._id,
          invoiceStatus: 'issued',
          amountPaid: 0,
          'payments.status': { $ne: 'pending' },
        },
        {
          $set: {
            invoiceStatus: 'cancelled',
            cancelledAt: new Date(),
            cancelledBy: shop._id,
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (cancelled) return { invoice: this.toView(cancelled) };

    const invoice = await this.getShopInvoice(userId, invoiceId);
    if (invoice.invoiceStatus !== 'issued') {
      throw new ConflictException('Only an issued invoice can be cancelled.');
    }
    if (invoice.amountPaid > 0) {
      throw new ConflictException(
        'An invoice with recorded payments cannot be cancelled.',
      );
    }
    throw new ConflictException(
      'An invoice with a pending online payment cannot be cancelled.',
    );
  }

  async listShopInvoices(userId: string, query: ShopInvoiceListQueryDto) {
    const shop = await this.requireShop(userId);
    const filter: FilterQuery<RepairInvoice> = { shopId: shop._id };
    if (query.paymentStatus) filter['paymentStatus'] = query.paymentStatus;
    if (query.from || query.to) {
      const date: { $gte?: Date; $lte?: Date } = {};
      if (query.from) date.$gte = new Date(query.from);
      if (query.to) {
        date.$lte = new Date(query.to);
        date.$lte.setUTCHours(23, 59, 59, 999);
      }
      filter['invoiceDate'] = date;
    }
    const search = query.search?.trim();
    if (search) {
      const expression = new RegExp(this.escapeRegExp(search), 'i');
      filter['$or'] = [
        { invoiceNumber: expression },
        { 'customer.name': expression },
        {
          repairRequestId: Types.ObjectId.isValid(search) ? search : undefined,
        },
      ].filter(
        (entry) =>
          !('repairRequestId' in entry) || entry.repairRequestId !== undefined,
      );
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const [invoices, total] = await Promise.all([
      this.repairInvoices
        .find(filter)
        .sort({ invoiceDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.repairInvoices.countDocuments(filter).exec(),
    ]);
    return {
      invoices: invoices.map((invoice) => this.toView(invoice)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getCustomerInvoiceForRepair(userId: string, repairRequestId: string) {
    const customer = await this.requireCustomer(userId);
    this.assertObjectId(repairRequestId, 'Repair request');
    const request = await this.repairRequests
      .findOne({ _id: repairRequestId, customerId: customer._id })
      .exec();
    if (!request) throw new NotFoundException('Repair request was not found.');

    const invoice = await this.repairInvoices
      .findOne({
        repairRequestId: request._id,
        customerId: customer._id,
        invoiceStatus: { $in: ['issued', 'cancelled'] },
      })
      .exec();
    return { invoice: invoice ? this.toView(invoice) : null };
  }

  async getCustomerInvoicePdf(userId: string, invoiceId: string) {
    const customer = await this.requireCustomer(userId);
    this.assertObjectId(invoiceId, 'Invoice');
    const invoice = await this.repairInvoices
      .findOne({
        _id: invoiceId,
        customerId: customer._id,
        invoiceStatus: { $in: ['issued', 'cancelled'] },
      })
      .exec();
    return this.invoicePdfFile(invoice);
  }

  async getShopInvoicePdf(userId: string, invoiceId: string) {
    const invoice = await this.getShopInvoice(userId, invoiceId);
    if (
      invoice.invoiceStatus !== 'issued' &&
      invoice.invoiceStatus !== 'cancelled'
    ) {
      throw new NotFoundException('The issued invoice PDF was not found.');
    }
    return this.invoicePdfFile(invoice);
  }

  async recordManualPayment(
    userId: string,
    invoiceId: string,
    input: RecordInvoicePaymentDto,
  ) {
    const shop = await this.requireShop(userId);
    const invoice = await this.getShopInvoice(userId, invoiceId);
    if (invoice.invoiceStatus !== 'issued') {
      throw new ConflictException(
        'Payments can only be recorded for issued invoices.',
      );
    }
    const paymentDate = new Date(input.paymentDate);
    if (
      Number.isNaN(paymentDate.getTime()) ||
      paymentDate.getTime() > Date.now()
    ) {
      throw new BadRequestException(
        'Payment date must be a valid date that is not in the future.',
      );
    }
    const amount = roundCurrencyAmount(input.amount, invoice.currency);
    if (amount <= 0 || amount > invoice.balanceDue) {
      throw new BadRequestException(
        'Payment amount must be greater than zero and not exceed the balance due.',
      );
    }

    const updatedAmountPaid = roundCurrencyAmount(
      invoice.amountPaid + amount,
      invoice.currency,
    );
    const updatedBalanceDue = roundCurrencyAmount(
      Math.max(0, invoice.grandTotal - updatedAmountPaid),
      invoice.currency,
    );
    const paymentStatus = this.paymentStatus(
      updatedAmountPaid,
      updatedBalanceDue,
    );
    invoice.payments.push({
      amount,
      currency: invoice.currency,
      method: input.method,
      status: 'succeeded',
      reference: input.reference?.trim() || null,
      paymentDate,
      recordedAt: new Date(),
      recordedBy: shop._id,
      recordedByName: this.userName(shop) || shop.email,
      stripeAttemptId: null,
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      checkoutUrl: null,
      checkoutExpiresAt: null,
    } as RepairInvoicePayment);
    invoice.amountPaid = updatedAmountPaid;
    invoice.balanceDue = updatedBalanceDue;
    invoice.paymentStatus = paymentStatus;

    try {
      await invoice.save();
    } catch (error) {
      if (error instanceof Error && error.name === 'VersionError') {
        throw new ConflictException(
          'The invoice changed while recording this payment. Please retry.',
        );
      }
      throw error;
    }
    return { invoice: this.toView(invoice) };
  }

  async createCustomerCheckout(userId: string, invoiceId: string) {
    const customer = await this.requireCustomer(userId);
    const invoice = await this.repairInvoices
      .findOne({
        _id: invoiceId,
        customerId: customer._id,
        invoiceStatus: 'issued',
      })
      .exec();
    if (!invoice) throw new NotFoundException('Issued invoice was not found.');
    if (invoice.balanceDue <= 0)
      throw new ConflictException('This invoice has no balance due.');
    const checkoutUrl = await this.stripePayments.createRepairInvoiceCheckout(
      invoice._id.toString(),
      customer._id.toString(),
      customer.email,
    );
    return { checkoutUrl };
  }

  private async getShopRepairContext(userId: string, repairRequestId: string) {
    const shop = await this.requireShop(userId);
    this.assertObjectId(repairRequestId, 'Repair request');
    const request = await this.repairRequests
      .findOne({ _id: repairRequestId, shopIds: shop._id })
      .exec();
    if (!request) throw new NotFoundException('Repair request was not found.');

    const quotationId =
      request.acceptedQuotationId ?? request.repairJob?.acceptedQuotationId;
    if (!quotationId)
      throw new ConflictException(
        'An accepted quotation is required to invoice a repair.',
      );
    const quotation = await this.repairQuotations
      .findOne({
        _id: quotationId,
        repairRequestId: request._id,
        shopId: shop._id,
        status: 'accepted',
      })
      .exec();
    if (!quotation)
      throw new NotFoundException('Accepted quotation was not found.');
    const customer = await this.users.findById(request.customerId).exec();
    if (!customer || customer.accountType !== 'customer') {
      throw new NotFoundException('Customer details were not found.');
    }
    return { shop, customer, request, quotation };
  }

  private async requireShop(userId: string): Promise<HydratedDocument<User>> {
    const shop = await this.users.findById(userId).exec();
    if (!shop || shop.accountType !== 'shop' || !shop.shopDetails) {
      throw new ForbiddenException(
        'An active repair shop account is required.',
      );
    }
    return shop;
  }

  private async requireCustomer(
    userId: string,
  ): Promise<HydratedDocument<User>> {
    const customer = await this.users.findById(userId).exec();
    if (
      !customer ||
      customer.accountType !== 'customer' ||
      customer.accountStatus !== 'active'
    ) {
      throw new ForbiddenException('An active customer account is required.');
    }
    return customer;
  }

  private async getShopInvoice(
    userId: string,
    invoiceId: string,
  ): Promise<RepairInvoiceDocument> {
    const shop = await this.requireShop(userId);
    this.assertObjectId(invoiceId, 'Invoice');
    const invoice = await this.repairInvoices
      .findOne({ _id: invoiceId, shopId: shop._id })
      .exec();
    if (!invoice) throw new NotFoundException('Invoice was not found.');
    return invoice;
  }

  private assertCompleted(request: RepairRequest): void {
    if (
      request.status !== 'completed' &&
      request.repairJob?.status !== 'completed'
    ) {
      throw new ConflictException(
        'An invoice can only be prepared after the repair is completed.',
      );
    }
  }

  private buildLineItems(
    quotation: RepairQuotation,
    request: RepairRequest,
  ): RepairInvoiceLineItem[] {
    const currency = quotation.currency.toUpperCase();
    currencyFractionDigits(currency);
    const job = request.repairJob;
    const approvedRepairAmount = roundCurrencyAmount(
      job?.approvedRepairAmount ?? quotation.amount,
      currency,
    );
    const quoteBreakdown = [
      {
        description: 'Inspection charges',
        amount: quotation.inspectionCharge ?? 0,
      },
      { description: 'Spare parts charges', amount: quotation.partsCost ?? 0 },
      {
        description: 'Repair service charges',
        amount: quotation.labourCharge ?? 0,
      },
      {
        description: 'Other quoted charges',
        amount: quotation.additionalCharges ?? 0,
      },
    ].map((item) => ({
      ...item,
      amount: roundCurrencyAmount(item.amount, currency),
    }));
    const breakdownTotal = roundCurrencyAmount(
      quoteBreakdown.reduce((total, item) => total + item.amount, 0),
      currency,
    );
    const items: RepairInvoiceLineItem[] = [];

    if (breakdownTotal > 0 && breakdownTotal <= approvedRepairAmount) {
      for (const item of quoteBreakdown) {
        if (item.amount > 0)
          items.push(this.line(item.description, 1, item.amount, currency));
      }
      const unitemizedQuoteAmount = roundCurrencyAmount(
        approvedRepairAmount - breakdownTotal,
        currency,
      );
      if (unitemizedQuoteAmount > 0) {
        items.push(
          this.line(
            'Repair service charges',
            1,
            unitemizedQuoteAmount,
            currency,
          ),
        );
      }
    } else {
      items.push(
        this.line('Repair service charges', 1, approvedRepairAmount, currency),
      );
    }

    const additionalTotal = roundCurrencyAmount(
      job?.approvedAdditionalCharges ?? 0,
      currency,
    );
    if (additionalTotal > 0) {
      const additionalItems = this.acceptedAdditionalChargeItems(
        job?.additionalChargeRequests,
        currency,
      );
      const itemizedTotal = roundCurrencyAmount(
        additionalItems.reduce((total, item) => total + item.amount, 0),
        currency,
      );
      if (itemizedTotal === additionalTotal) {
        items.push(...additionalItems);
      } else {
        items.push(
          this.line(
            'Approved additional repair charges',
            1,
            additionalTotal,
            currency,
          ),
        );
      }
    }
    return items;
  }

  private acceptedAdditionalChargeItems(
    requests:
      | NonNullable<RepairRequest['repairJob']>['additionalChargeRequests']
      | undefined,
    currency: string,
  ): RepairInvoiceLineItem[] {
    const items: RepairInvoiceLineItem[] = [];
    for (const request of requests ?? []) {
      if (request.status !== 'accepted') continue;
      const start = items.length;
      for (const part of request.parts ?? []) {
        const quantity = Number(part.quantity);
        const unitPrice = roundCurrencyAmount(Number(part.unitPrice), currency);
        if (quantity > 0 && unitPrice >= 0) {
          items.push(
            this.line(
              part.name || 'Spare part',
              quantity,
              roundCurrencyAmount(quantity * unitPrice, currency),
              currency,
            ),
          );
        }
      }
      if (request.labourCharge > 0) {
        items.push(
          this.line(
            'Additional repair service',
            1,
            request.labourCharge,
            currency,
          ),
        );
      }
      if (request.otherCharges > 0) {
        items.push(
          this.line(
            'Additional repair charges',
            1,
            request.otherCharges,
            currency,
          ),
        );
      }
      const calculated = roundCurrencyAmount(
        items.slice(start).reduce((total, item) => total + item.amount, 0),
        currency,
      );
      const remaining = roundCurrencyAmount(
        request.amount - calculated,
        currency,
      );
      if (remaining > 0)
        items.push(
          this.line('Additional repair charges', 1, remaining, currency),
        );
    }
    return items;
  }

  private line(
    description: string,
    quantity: number,
    amount: number,
    currency: string,
  ): RepairInvoiceLineItem {
    const roundedAmount = roundCurrencyAmount(amount, currency);
    return {
      description,
      quantity,
      unitPrice: roundCurrencyAmount(roundedAmount / quantity, currency),
      amount: roundedAmount,
    };
  }

  private userName(
    user: Pick<User, 'firstName' | 'lastName' | 'fullName'>,
  ): string {
    return (
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.fullName ||
      ''
    );
  }

  private phone(user: User): string | null {
    const mobile = [user.countryCode, user.mobileNumber]
      .filter(Boolean)
      .join(' ')
      .trim();
    return mobile || null;
  }

  private shopAddress(user: User): string | null {
    const details = user.shopDetails;
    if (!details) return null;
    const address = [
      details.address,
      details.street,
      details.area,
      details.city,
      details.state,
      details.postalCode,
      details.country,
    ]
      .filter(Boolean)
      .join(', ');
    return address || null;
  }

  private async nextInvoiceNumber(year: number): Promise<string> {
    let counter: RepairInvoiceSequence | null;
    try {
      counter = await this.invoiceSequences
        .findOneAndUpdate(
          { year },
          { $inc: { sequence: 1 }, $setOnInsert: { year } },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        )
        .exec();
    } catch (error) {
      if (!this.isDuplicateKeyError(error)) throw error;
      counter = await this.invoiceSequences
        .findOneAndUpdate({ year }, { $inc: { sequence: 1 } }, { new: true })
        .exec();
    }
    if (!counter)
      throw new ConflictException('Invoice number could not be allocated.');
    return `FIX-INV-${year}-${String(counter.sequence).padStart(6, '0')}`;
  }

  private async generatePdf(
    invoice: RepairInvoiceDocument,
    invoiceNumber: string,
    invoiceDate: Date,
  ): Promise<Buffer> {
    const chunks: Buffer[] = [];
    const document = new PDFDocument({
      size: 'A4',
      margins: { top: 42, right: 44, bottom: 42, left: 44 },
      info: { Title: `Fixora Invoice ${invoiceNumber}`, Author: 'Fixora' },
    });
    const done = new Promise<Buffer>((resolve, reject) => {
      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.once('end', () => resolve(Buffer.concat(chunks)));
      document.once('error', reject);
    });

    const pageWidth = document.page.width;
    const left = 44;
    const right = pageWidth - 44;
    const green = '#176B3A';
    const muted = '#5D6A61';
    const logoPath = join(__dirname, 'assets', 'fixroa-logo.png');
    document.image(logoPath, left, 40, { fit: [118, 52] });
    document
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor(green)
      .text('FIXORA', left + 128, 48, { continued: false });
    document
      .font('Helvetica')
      .fontSize(8)
      .fillColor(muted)
      .text('REPAIR MARKETPLACE', left + 128, 71);
    document
      .font('Helvetica-Bold')
      .fontSize(22)
      .fillColor('#202B23')
      .text('INVOICE', right - 145, 44, {
        width: 145,
        align: 'right',
      });
    document.font('Helvetica').fontSize(9).fillColor(muted);
    document.text(`Invoice No: ${invoiceNumber}`, right - 200, 74, {
      width: 200,
      align: 'right',
    });
    document.text(
      `Invoice Date: ${invoiceDate.toLocaleDateString('en-IN')}`,
      right - 200,
      88,
      {
        width: 200,
        align: 'right',
      },
    );
    if (invoice.dueDate) {
      document.text(
        `Due Date: ${invoice.dueDate.toLocaleDateString('en-IN')}`,
        right - 200,
        102,
        {
          width: 200,
          align: 'right',
        },
      );
    }
    document
      .moveTo(left, 122)
      .lineTo(right, 122)
      .lineWidth(1)
      .strokeColor('#DCE7DE')
      .stroke();

    const partyTop = 140;
    const gap = 18;
    const partyWidth = (right - left - gap) / 2;
    this.drawParty(
      document,
      'FROM',
      invoice.shop,
      left,
      partyTop,
      partyWidth,
      green,
    );
    this.drawParty(
      document,
      'BILL TO',
      invoice.customer,
      left + partyWidth + gap,
      partyTop,
      partyWidth,
      green,
    );

    let y = partyTop + 112;
    document
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#202B23')
      .text('REPAIR DETAILS', left, y);
    y += 17;
    const repairLines = [
      `Request ID: ${invoice.repairRequestId.toString()}`,
      `Product: ${invoice.repair.productName}`,
      `Category: ${invoice.repair.category}`,
      `Brand / Model: ${[invoice.repair.brand, invoice.repair.model].filter(Boolean).join(' / ') || 'Not provided'}`,
      `Service type: ${invoice.repair.serviceType || 'Not specified'}`,
      `Completed: ${invoice.repair.completedAt?.toLocaleDateString('en-IN') || 'Not recorded'}`,
      `Problem: ${invoice.repair.problemDescription}`,
    ];
    for (const line of repairLines) {
      const height = document.heightOfString(line, { width: right - left });
      if (y + height > document.page.height - 155) {
        document.addPage();
        y = 48;
      }
      document
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor('#3E4B42')
        .text(line, left, y, {
          width: right - left,
        });
      y += height + 4;
    }

    y += 10;
    const drawTableHeader = (): void => {
      document.rect(left, y, right - left, 23).fill('#EAF3EC');
      document.font('Helvetica-Bold').fontSize(8).fillColor(green);
      document.text('DESCRIPTION', left + 8, y + 8, { width: 270 });
      document.text('QTY', left + 282, y + 8, { width: 36, align: 'right' });
      document.text('UNIT PRICE', left + 326, y + 8, {
        width: 78,
        align: 'right',
      });
      document.text('AMOUNT', right - 84, y + 8, { width: 76, align: 'right' });
      y += 23;
    };
    drawTableHeader();
    for (const item of invoice.items) {
      const descriptionHeight = document.heightOfString(item.description, {
        width: 260,
      });
      const rowHeight = Math.max(24, descriptionHeight + 10);
      if (y + rowHeight > document.page.height - 145) {
        document.addPage();
        y = 45;
        drawTableHeader();
      }
      document
        .moveTo(left, y + rowHeight)
        .lineTo(right, y + rowHeight)
        .lineWidth(0.5)
        .strokeColor('#E7ECE8')
        .stroke();
      document.font('Helvetica').fontSize(8).fillColor('#2B382F');
      document.text(item.description, left + 8, y + 7, { width: 260 });
      document.text(String(item.quantity), left + 282, y + 7, {
        width: 36,
        align: 'right',
      });
      document.text(
        this.formatMoney(item.unitPrice, invoice.currency),
        left + 326,
        y + 7,
        {
          width: 78,
          align: 'right',
        },
      );
      document.text(
        this.formatMoney(item.amount, invoice.currency),
        right - 84,
        y + 7,
        {
          width: 76,
          align: 'right',
        },
      );
      y += rowHeight;
    }

    y += 18;
    const totalRows = [
      ['Subtotal', invoice.subtotal],
      ['Discount', -invoice.discount],
      ['Taxable amount', invoice.taxableAmount],
      ...invoice.taxDetails.map(
        (tax) => [`${tax.type} (${tax.rate}%)`, tax.amount] as [string, number],
      ),
      ['Grand total', invoice.grandTotal],
      ['Amount paid', invoice.amountPaid],
      ['Balance due', invoice.balanceDue],
    ] as Array<[string, number]>;
    const totalsLeft = right - 220;
    for (const [label, amount] of totalRows) {
      if (y > document.page.height - 120) {
        document.addPage();
        y = 50;
      }
      const isFinal = label === 'Grand total' || label === 'Balance due';
      if (isFinal) {
        document.roundedRect(totalsLeft - 7, y - 4, 227, 24, 4).fill('#EAF3EC');
      }
      document
        .font(isFinal ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(isFinal ? 9.5 : 8.5)
        .fillColor(isFinal ? green : '#3E4B42');
      document.text(label, totalsLeft, y + 2, { width: 115 });
      document.text(
        this.formatMoney(amount, invoice.currency),
        right - 95,
        y + 2,
        {
          width: 95,
          align: 'right',
        },
      );
      y += isFinal ? 26 : 20;
    }

    y += 12;
    if (y > document.page.height - 100) {
      document.addPage();
      y = 52;
    }
    document
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#202B23')
      .text('Payment information', left, y);
    y += 15;
    document
      .font('Helvetica')
      .fontSize(8)
      .fillColor(muted)
      .text(
        `Payment status: ${invoice.paymentStatus.replace(/_/g, ' ')}. Offline payment methods: Cash, UPI or bank transfer. Online card payments are confirmed after secure payment verification.`,
        left,
        y,
        { width: right - left },
      );
    y += 28;
    document
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#202B23')
      .text('Terms and conditions', left, y);
    y += 15;
    document
      .font('Helvetica')
      .fontSize(8)
      .fillColor(muted)
      .text(
        'This invoice records the repair service and charges shown above. Any payment status updates are available in the Fixora customer and shop portals.',
        left,
        y,
        { width: right - left },
      );
    y += 32;
    document
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(green)
      .text('Thank you for choosing Fixora.', left, y, {
        width: right - left,
        align: 'center',
      });
    document.end();
    return done;
  }

  private drawParty(
    document: PDFKit.PDFDocument,
    heading: string,
    party: RepairInvoice['shop'],
    x: number,
    y: number,
    width: number,
    accent: string,
  ): void {
    document.roundedRect(x, y, width, 98, 6).fill('#F7FAF7');
    document
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(accent)
      .text(heading, x + 10, y + 10);
    const logoMatch = party.logoData?.match(
      /^data:image\/(?:png|jpe?g);base64,(.+)$/i,
    );
    const logoBase64 = logoMatch?.[1];
    if (logoBase64) {
      document.image(Buffer.from(logoBase64, 'base64'), x + width - 48, y + 7, {
        fit: [38, 28],
      });
    }
    document
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#243229')
      .text(party.name, x + 10, y + 25, {
        width: width - (logoMatch ? 65 : 20),
        ellipsis: true,
      });
    let detailY = y + 42;
    if (party.ownerName) {
      document
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#5D6A61')
        .text(party.ownerName, x + 10, detailY, {
          width: width - 20,
          ellipsis: true,
        });
      detailY += 12;
    }
    for (const detail of [
      party.address,
      party.phone,
      party.email,
      party.gstin && `GSTIN: ${party.gstin}`,
    ]) {
      if (!detail) continue;
      document
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor('#5D6A61')
        .text(detail, x + 10, detailY, {
          width: width - 20,
          ellipsis: true,
        });
      detailY += 11;
    }
  }

  private formatMoney(value: number, currency: string): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: currencyFractionDigits(currency),
      maximumFractionDigits: currencyFractionDigits(currency),
    }).format(value);
  }

  private async savePdf(
    invoice: RepairInvoiceDocument,
    invoiceNumber: string,
    bytes: Buffer,
  ): Promise<Types.ObjectId> {
    const upload = this.gridFs().openUploadStream(`${invoiceNumber}.pdf`, {
      contentType: 'application/pdf',
      metadata: {
        type: 'repair-invoice',
        invoiceId: invoice._id.toString(),
        repairRequestId: invoice.repairRequestId.toString(),
      },
    });
    await pipeline(Readable.from([bytes]), upload);
    return upload.id;
  }

  private invoicePdfFile(invoice: RepairInvoiceDocument | null) {
    if (
      !invoice ||
      (invoice.invoiceStatus !== 'issued' &&
        invoice.invoiceStatus !== 'cancelled') ||
      !invoice.pdfFileIds.length
    ) {
      throw new NotFoundException('The issued invoice PDF was not found.');
    }
    const fileId = invoice.pdfFileIds[invoice.pdfFileIds.length - 1];
    if (!fileId)
      throw new NotFoundException('The issued invoice PDF was not found.');
    return {
      filename: `${invoice.invoiceNumber || 'Fixora-invoice'}.pdf`,
      stream: this.gridFs().openDownloadStream(fileId),
    };
  }

  private gridFs(): mongo.GridFSBucket {
    if (!this.connection.db) {
      throw new ConflictException('Invoice file storage is not available.');
    }
    return new mongo.GridFSBucket(this.connection.db, {
      bucketName: 'repairInvoiceFiles',
    });
  }

  private toView(invoice: RepairInvoiceDocument): InvoiceView {
    return {
      id: invoice._id.toString(),
      repairRequestId: invoice.repairRequestId.toString(),
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate?.toISOString() ?? null,
      dueDate: invoice.dueDate?.toISOString() ?? null,
      invoiceStatus: invoice.invoiceStatus,
      paymentStatus: invoice.paymentStatus,
      currency: invoice.currency,
      items: invoice.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
      })),
      subtotal: invoice.subtotal,
      discount: invoice.discount,
      taxableAmount: invoice.taxableAmount,
      taxDetails: invoice.taxDetails.map((tax) => ({
        type: tax.type,
        rate: tax.rate,
        amount: tax.amount,
      })),
      grandTotal: invoice.grandTotal,
      amountPaid: invoice.amountPaid,
      balanceDue: invoice.balanceDue,
      customer: invoice.customer,
      shop: invoice.shop,
      repair: {
        category: invoice.repair.category,
        productName: invoice.repair.productName,
        brand: invoice.repair.brand,
        model: invoice.repair.model,
        problemDescription: invoice.repair.problemDescription,
        completedAt: invoice.repair.completedAt?.toISOString() ?? null,
        serviceType: invoice.repair.serviceType,
      },
      payments: invoice.payments.map((payment) => ({
        id: payment._id.toString(),
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        reference: payment.reference,
        paymentDate: payment.paymentDate.toISOString(),
        recordedAt: payment.recordedAt.toISOString(),
        recordedBy: payment.recordedByName,
      })),
      pdfAvailable: invoice.pdfFileIds.length > 0,
    };
  }

  private paymentStatus(
    amountPaid: number,
    balanceDue: number,
  ): RepairInvoice['paymentStatus'] {
    if (balanceDue <= 0) return 'PAID';
    return amountPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private assertObjectId(value: string, label: string): void {
    if (!Types.ObjectId.isValid(value)) {
      throw new NotFoundException(`${label} was not found.`);
    }
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    );
  }
}
