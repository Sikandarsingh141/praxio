import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import Stripe from 'stripe';
import { Model, Types } from 'mongoose';
import {
  RepairInvoice,
  RepairInvoicePayment,
} from '../invoices/repair-invoice.schema';
import {
  roundCurrencyAmount,
  toMinorCurrencyUnits,
} from '../invoices/repair-invoice-money.util';
import { NotificationsService } from '../notifications/notifications.service';
import { RegistrationRequest } from '../registrations/schemas/registration-request.schema';
import { ShopSubscriptionInvoice } from './schemas/shop-subscription-invoice.schema';
import {
  SHOP_SUBSCRIPTION_AMOUNT_CENTS,
  SHOP_SUBSCRIPTION_CURRENCY,
} from './shop-subscription.constants';

export interface ShopPaymentStatus {
  registrationStatus: 'pending' | 'approved' | 'declined' | 'not_found';
  paymentStatus: 'not_required' | 'unpaid' | 'paid';
  subscriptionPlan: 'Fixroa Shop monthly subscription';
  amountCents: number;
  currency: string;
  paidAt: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePaymentIntentId: string | null;
  paymentId: string | null;
}

export interface ShopInvoiceSummary {
  stripeInvoiceId: string;
  invoiceNumber: string | null;
  totalAmountCents: number;
  amountPaidCents: number;
  refundedAmountCents: number;
  currency: string;
  status: string;
  generatedAt: Date;
  paidAt: Date | null;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
}

export interface ShopInvoicePage {
  invoices: ShopInvoiceSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const DEFAULT_SHOP_INVOICE_PAGE_SIZE = 10;

@Injectable()
export class StripePaymentsService {
  private readonly logger = new Logger(StripePaymentsService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(RegistrationRequest.name)
    private readonly registrationRequests: Model<RegistrationRequest>,
    @InjectModel(ShopSubscriptionInvoice.name)
    private readonly subscriptionInvoices: Model<ShopSubscriptionInvoice>,
    @InjectModel(RepairInvoice.name)
    private readonly repairInvoices: Model<RepairInvoice>,
    private readonly notifications: NotificationsService,
  ) {}

  async createRepairInvoiceCheckout(
    invoiceId: string,
    customerId: string,
    customerEmail?: string,
  ): Promise<string> {
    if (
      !Types.ObjectId.isValid(invoiceId) ||
      !Types.ObjectId.isValid(customerId)
    ) {
      throw new NotFoundException('Issued invoice was not found.');
    }
    const invoice = await this.repairInvoices
      .findOne({
        _id: new Types.ObjectId(invoiceId),
        customerId: new Types.ObjectId(customerId),
        invoiceStatus: 'issued',
      })
      .exec();
    if (!invoice) throw new NotFoundException('Issued invoice was not found.');
    if (invoice.balanceDue <= 0)
      throw new ConflictException('This invoice has no balance due.');

    const now = new Date();
    const activeAttempt = invoice.payments.find(
      (payment) =>
        payment.method === 'stripe' &&
        payment.status === 'pending' &&
        payment.checkoutExpiresAt &&
        payment.checkoutExpiresAt.getTime() > now.getTime(),
    );
    if (activeAttempt) {
      if (!activeAttempt.checkoutUrl) {
        throw new ConflictException(
          'A secure payment session is already being prepared.',
        );
      }
      return activeAttempt.checkoutUrl;
    }

    for (const payment of invoice.payments) {
      if (
        payment.method === 'stripe' &&
        payment.status === 'pending' &&
        (!payment.checkoutExpiresAt ||
          payment.checkoutExpiresAt.getTime() <= now.getTime())
      ) {
        payment.status = 'cancelled';
      }
    }

    const paymentAttemptId = randomUUID();
    const amount = roundCurrencyAmount(invoice.balanceDue, invoice.currency);
    invoice.payments.push({
      amount,
      currency: invoice.currency,
      method: 'stripe',
      status: 'pending',
      reference: null,
      paymentDate: now,
      recordedAt: now,
      recordedBy: invoice.customerId,
      recordedByName: customerEmail || invoice.customer.name,
      stripeAttemptId: paymentAttemptId,
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      checkoutUrl: null,
      checkoutExpiresAt: new Date(now.getTime() + 30 * 60 * 1000),
    } as RepairInvoicePayment);
    await invoice.save();

    const origin = this.configService
      .get<string>('FRONTEND_ORIGINS')
      ?.split(',')[0]
      ?.trim();
    if (!origin) {
      await this.markRepairInvoiceAttemptFailed(
        invoice._id.toString(),
        paymentAttemptId,
      );
      throw new ServiceUnavailableException(
        'Repair invoice payments are not configured.',
      );
    }

    const metadata = {
      paymentType: 'repair_invoice',
      invoiceId: invoice._id.toString(),
      customerId: invoice.customerId.toString(),
      shopId: invoice.shopId.toString(),
      paymentAttemptId,
    };
    try {
      const session = await this.getStripe().checkout.sessions.create({
        mode: 'payment',
        customer_email: customerEmail || undefined,
        line_items: [
          {
            price_data: {
              currency: invoice.currency.toLowerCase(),
              unit_amount: toMinorCurrencyUnits(amount, invoice.currency),
              product_data: {
                name: `Fixora repair invoice ${invoice.invoiceNumber || ''}`.trim(),
              },
            },
            quantity: 1,
          },
        ],
        metadata,
        payment_intent_data: { metadata },
        success_url: `${origin}/customer/jobs/completed-jobs/${encodeURIComponent(
          invoice.repairRequestId.toString(),
        )}?payment=success`,
        cancel_url: `${origin}/customer/jobs/completed-jobs/${encodeURIComponent(
          invoice.repairRequestId.toString(),
        )}?payment=cancelled`,
      });
      if (!session.url) {
        await this.markRepairInvoiceAttemptFailed(
          invoice._id.toString(),
          paymentAttemptId,
        );
        throw new ServiceUnavailableException(
          'Stripe did not return a payment URL.',
        );
      }

      const storedPayment = invoice.payments.find(
        (entry) => entry.stripeAttemptId === paymentAttemptId,
      );
      if (!storedPayment)
        throw new ConflictException('The payment attempt could not be stored.');
      storedPayment.stripeCheckoutSessionId = session.id;
      storedPayment.checkoutUrl = session.url;
      storedPayment.checkoutExpiresAt = session.expires_at
        ? new Date(session.expires_at * 1000)
        : new Date(now.getTime() + 30 * 60 * 1000);
      await invoice.save();
      return session.url;
    } catch (error) {
      await this.markRepairInvoiceAttemptFailed(
        invoice._id.toString(),
        paymentAttemptId,
      );
      const stripeError = this.getStripeErrorDetails(error);
      if (stripeError) {
        this.logger.error(
          `Repair invoice Checkout failed: type=${stripeError.type} code=${stripeError.code ?? 'unknown'} requestId=${stripeError.requestId ?? 'unknown'}`,
        );
        if (stripeError.code === 'amount_too_small') {
          throw new BadRequestException(
            'The remaining balance is below the minimum supported by Stripe. Record the payment using an offline method.',
          );
        }
        if (stripeError.code === 'currency_not_supported') {
          throw new BadRequestException(
            'The configured Stripe account does not support this invoice currency. Record the payment using an offline method.',
          );
        }
        throw new ServiceUnavailableException(
          'Stripe could not start this payment. Please try again later or use an offline payment method.',
        );
      }
      throw error;
    }
  }

  ensureConfigured(): void {
    this.getStripe();
    this.getWebhookSecret();
  }

  async createShopCheckout(
    userId: string,
    email: string,
    registrationRequestId: string,
  ): Promise<string> {
    const userObjectId = this.toObjectId(userId);
    const requestObjectId = this.toObjectId(registrationRequestId);
    const stripe = this.getStripe();
    const request = await this.registrationRequests
      .findOne({
        _id: requestObjectId,
        userId: userObjectId,
        accountType: 'shop',
      })
      .exec();
    if (!request) {
      throw new ConflictException(
        'No shop registration was found for this account.',
      );
    }
    if (request.registrationStatus !== 'pending') {
      throw new ConflictException(
        'This shop registration is no longer pending Admin review. Sign in to view its status.',
      );
    }
    if (request.paymentStatus === 'paid') {
      throw new ConflictException(
        'Payment has already been completed. Sign in to view your Shop registration status.',
      );
    }

    if (request.stripeCheckoutSessionId) {
      const existingSession = await stripe.checkout.sessions.retrieve(
        request.stripeCheckoutSessionId,
      );
      if (existingSession.status === 'open' && existingSession.url) {
        return existingSession.url;
      }
    }

    const frontendOrigin = this.configService
      .getOrThrow<string>('FRONTEND_ORIGINS')
      .split(',')[0]
      ?.trim();
    if (!frontendOrigin) {
      throw new ServiceUnavailableException(
        'Shop payments are not configured. Please try again later.',
      );
    }

    const metadata = {
      registrationRequestId,
      userId,
      accountType: 'shop',
    };
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      client_reference_id: registrationRequestId,
      line_items: [
        {
          price_data: {
            currency: SHOP_SUBSCRIPTION_CURRENCY,
            unit_amount: SHOP_SUBSCRIPTION_AMOUNT_CENTS,
            recurring: { interval: 'month' },
            product_data: { name: 'Fixroa Shop monthly subscription' },
          },
          quantity: 1,
        },
      ],
      metadata,
      subscription_data: { metadata },
      success_url: `${frontendOrigin}/auth/register/shop/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendOrigin}/shop/payment?cancelled=1`,
    });

    if (!session.url) {
      throw new ServiceUnavailableException(
        'Stripe did not provide a checkout URL. Please try again.',
      );
    }

    const updatedRequest = await this.registrationRequests
      .findOneAndUpdate(
        {
          _id: requestObjectId,
          userId: userObjectId,
          accountType: 'shop',
          registrationStatus: 'pending',
          paymentStatus: { $ne: 'paid' },
        },
        {
          $set: {
            paymentStatus: 'unpaid',
            stripeCheckoutSessionId: session.id,
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    if (!updatedRequest) {
      await stripe.checkout.sessions.expire(session.id);
      throw new ConflictException(
        'This shop registration is no longer awaiting payment.',
      );
    }

    return session.url;
  }

  async retryShopCheckout(userId: string, email: string): Promise<string> {
    const userObjectId = this.toObjectId(userId);
    const request = await this.registrationRequests
      .findOne({
        userId: userObjectId,
        accountType: 'shop',
      })
      .exec();
    if (!request) {
      throw new ConflictException(
        'No shop registration was found for this account.',
      );
    }
    if (request.registrationStatus !== 'pending') {
      throw new ConflictException(
        'This shop registration is no longer pending Admin review. Sign in to view its status.',
      );
    }
    if (request.paymentStatus === 'paid') {
      throw new ConflictException(
        'Payment has already been completed. Sign in to view your Shop registration status.',
      );
    }

    return this.createShopCheckout(userId, email, request._id.toString());
  }

  async getPaymentStatus(userId: string): Promise<ShopPaymentStatus> {
    const userObjectId = this.toObjectId(userId);
    const request = await this.registrationRequests
      .findOne({ userId: userObjectId, accountType: 'shop' })
      .exec();
    return {
      registrationStatus: request?.registrationStatus ?? 'not_found',
      paymentStatus: request?.paymentStatus ?? 'not_required',
      subscriptionPlan: 'Fixroa Shop monthly subscription',
      amountCents:
        request?.paymentAmountCents ?? SHOP_SUBSCRIPTION_AMOUNT_CENTS,
      currency: request?.paymentCurrency ?? SHOP_SUBSCRIPTION_CURRENCY,
      paidAt: request?.paidAt ?? null,
      stripeCustomerId: request?.stripeCustomerId ?? null,
      stripeSubscriptionId: request?.stripeSubscriptionId ?? null,
      stripePaymentIntentId: request?.stripePaymentIntentId ?? null,
      paymentId: request?.stripePaymentId ?? null,
    };
  }

  async getShopInvoices(
    userId: string,
    page: number,
    limit = DEFAULT_SHOP_INVOICE_PAGE_SIZE,
  ): Promise<ShopInvoicePage> {
    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestException('Invoice page must be a positive integer.');
    }
    if (![5, 10, 25, 100].includes(limit)) {
      throw new BadRequestException(
        'Invoice page size must be 5, 10, 25, or 100.',
      );
    }

    const userObjectId = this.toObjectId(userId);
    const registration = await this.registrationRequests
      .findOne({ userId: userObjectId, accountType: 'shop' })
      .exec();
    if (!registration) {
      throw new NotFoundException(
        'No Shop registration was found for this account.',
      );
    }

    const filter = {
      registrationRequestId: registration._id,
      userId: userObjectId,
    };
    const [records, total] = await Promise.all([
      this.subscriptionInvoices
        .find(filter)
        .sort({ generatedAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.subscriptionInvoices.countDocuments(filter).exec(),
    ]);

    if (
      !records.length &&
      total === 0 &&
      page === 1 &&
      registration.stripeCheckoutInvoiceId
    ) {
      let stripeInvoice: Stripe.Invoice;
      try {
        stripeInvoice = await this.getStripe().invoices.retrieve(
          registration.stripeCheckoutInvoiceId,
        );
      } catch {
        throw new ServiceUnavailableException(
          'Invoice documents are temporarily unavailable. Please try again later.',
        );
      }

      const totalAmountCents = Math.max(
        0,
        stripeInvoice.total ?? stripeInvoice.amount_due,
      );
      return {
        invoices: [
          {
            stripeInvoiceId: stripeInvoice.id,
            invoiceNumber: stripeInvoice.number ?? null,
            totalAmountCents,
            amountPaidCents: Math.max(0, stripeInvoice.amount_paid),
            refundedAmountCents: Math.min(
              totalAmountCents,
              Math.max(0, registration.paymentRefundedAmountCents ?? 0),
            ),
            currency: stripeInvoice.currency,
            status: stripeInvoice.status ?? 'unknown',
            generatedAt: new Date(stripeInvoice.created * 1000),
            paidAt: stripeInvoice.status_transitions.paid_at
              ? new Date(stripeInvoice.status_transitions.paid_at * 1000)
              : null,
            hostedInvoiceUrl: stripeInvoice.hosted_invoice_url ?? null,
            invoicePdfUrl: stripeInvoice.invoice_pdf ?? null,
          },
        ],
        pagination: {
          page: 1,
          limit,
          total: 1,
          totalPages: 1,
        },
      };
    }

    if (!records.length) {
      return {
        invoices: [],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    const stripe = this.getStripe();
    const invoices = await Promise.all(
      records.map(async (record): Promise<ShopInvoiceSummary> => {
        let stripeInvoice: Stripe.Invoice;
        try {
          stripeInvoice = await stripe.invoices.retrieve(
            record.stripeInvoiceId,
          );
        } catch {
          throw new ServiceUnavailableException(
            'Invoice documents are temporarily unavailable. Please try again later.',
          );
        }

        return {
          stripeInvoiceId: record.stripeInvoiceId,
          invoiceNumber: stripeInvoice.number ?? null,
          totalAmountCents: record.totalAmountCents,
          amountPaidCents: record.amountPaidCents,
          refundedAmountCents: record.refundedAmountCents,
          currency: record.currency,
          status: record.status,
          generatedAt: record.generatedAt,
          paidAt: record.paidAt ?? null,
          hostedInvoiceUrl: stripeInvoice.hosted_invoice_url ?? null,
          invoicePdfUrl: stripeInvoice.invoice_pdf ?? null,
        };
      }),
    );

    return {
      invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async confirmCheckout(sessionId: string, userId?: string): Promise<void> {
    if (userId) {
      this.toObjectId(userId);
    }
    const session =
      await this.getStripe().checkout.sessions.retrieve(sessionId);
    if (
      session.mode !== 'subscription' ||
      session.payment_status !== 'paid' ||
      session.metadata?.accountType !== 'shop' ||
      (userId !== undefined && session.metadata.userId !== userId) ||
      !(await this.markPaid(session))
    ) {
      throw new ConflictException(
        'Stripe has not confirmed payment for this shop registration.',
      );
    }
  }

  async handleWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): Promise<void> {
    if (!rawBody || !signature) {
      throw new BadRequestException('Stripe webhook signature is required.');
    }

    const stripe = this.getStripe();
    const webhookSecret = this.getWebhookSecret();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch {
      throw new BadRequestException('Stripe webhook signature is invalid.');
    }

    if (
      (event.type === 'checkout.session.completed' ||
        event.type === 'checkout.session.async_payment_succeeded') &&
      event.data.object.mode === 'subscription' &&
      event.data.object.payment_status === 'paid'
    ) {
      await this.markPaid(event.data.object, event.id);
      return;
    }

    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded' ||
      event.type === 'checkout.session.async_payment_failed' ||
      event.type === 'checkout.session.expired'
    ) {
      const session = event.data.object;
      if (
        session.mode === 'payment' &&
        session.metadata?.paymentType === 'repair_invoice'
      ) {
        if (
          (event.type === 'checkout.session.completed' ||
            event.type === 'checkout.session.async_payment_succeeded') &&
          session.payment_status === 'paid'
        ) {
          await this.markRepairInvoicePayment(session, event.id, event.created);
        } else if (
          event.type === 'checkout.session.async_payment_failed' ||
          event.type === 'checkout.session.expired'
        ) {
          await this.markRepairInvoiceAttemptClosed(
            session,
            event.type === 'checkout.session.expired' ? 'cancelled' : 'failed',
          );
        }
      }
      return;
    }

    if (
      event.type === 'invoice.created' ||
      event.type === 'invoice.finalized' ||
      event.type === 'invoice.paid' ||
      event.type === 'invoice.payment_failed' ||
      event.type === 'invoice.voided' ||
      event.type === 'invoice.marked_uncollectible'
    ) {
      await this.recordInvoiceEvent(
        event.data.object,
        event.id,
        event.type,
        new Date(event.created * 1000),
      );
      return;
    }

    if (event.type === 'charge.refunded') {
      await this.recordRefundEvent(
        event.data.object,
        event.id,
        new Date(event.created * 1000),
      );
    }
  }

  private async markPaid(
    session: Stripe.Checkout.Session,
    stripeEventId?: string,
  ): Promise<boolean> {
    const requestId = session.metadata?.registrationRequestId;
    const userId = session.metadata?.userId;
    if (
      !requestId ||
      !userId ||
      !Types.ObjectId.isValid(requestId) ||
      !Types.ObjectId.isValid(userId)
    ) {
      return false;
    }

    const customerId =
      typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id;
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;
    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;
    const checkoutInvoiceId = this.getStripeId(session.invoice);
    const filter: Record<string, unknown> = {
      _id: this.toObjectId(requestId),
      userId: this.toObjectId(userId),
      accountType: 'shop',
      registrationStatus: { $ne: 'declined' },
      stripeCheckoutSessionId: session.id,
    };
    if (stripeEventId) {
      filter.processedStripeEventIds = { $ne: stripeEventId };
    }

    const update: Record<string, unknown> = {
      $set: {
        paymentStatus: 'paid',
        paymentAmountCents:
          session.amount_total ?? SHOP_SUBSCRIPTION_AMOUNT_CENTS,
        paymentCurrency: session.currency ?? SHOP_SUBSCRIPTION_CURRENCY,
        ...(customerId ? { stripeCustomerId: customerId } : {}),
        ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
        ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
        stripePaymentId: paymentIntentId ?? session.id,
        ...(checkoutInvoiceId
          ? { stripeCheckoutInvoiceId: checkoutInvoiceId }
          : {}),
      },
      $min: { paidAt: new Date() },
    };
    if (stripeEventId) {
      update.$addToSet = { processedStripeEventIds: stripeEventId };
    }

    const updated = await this.registrationRequests
      .findOneAndUpdate(filter, update, { new: true, runValidators: true })
      .exec();
    if (updated || !stripeEventId) {
      return Boolean(updated);
    }

    const existing = await this.registrationRequests
      .findOne({
        _id: this.toObjectId(requestId),
        userId: this.toObjectId(userId),
        accountType: 'shop',
        stripeCheckoutSessionId: session.id,
      })
      .exec();
    return Boolean(existing?.paymentStatus === 'paid');
  }

  private async recordInvoiceEvent(
    invoice: Stripe.Invoice,
    stripeEventId: string,
    eventType: string,
    occurredAt: Date,
  ): Promise<void> {
    const subscriptionId = this.getInvoiceSubscriptionId(invoice);
    const metadata =
      invoice.parent?.subscription_details?.metadata ?? invoice.metadata;
    const registrationRequestId = metadata?.registrationRequestId;
    const customerId = this.getStripeId(invoice.customer);
    const requestFilter: Record<string, unknown> = { accountType: 'shop' };
    if (
      registrationRequestId &&
      Types.ObjectId.isValid(registrationRequestId)
    ) {
      requestFilter._id = this.toObjectId(registrationRequestId);
    } else if (subscriptionId) {
      requestFilter.stripeSubscriptionId = subscriptionId;
    } else if (customerId) {
      requestFilter.stripeCustomerId = customerId;
    } else {
      return;
    }

    const request = await this.registrationRequests
      .findOne(requestFilter)
      .exec();
    if (!request) {
      return;
    }

    const paymentIntentId = this.getInvoicePaymentIntentId(invoice);
    const totalAmountCents = Math.max(0, invoice.total ?? invoice.amount_due);
    const amountPaidCents = Math.min(
      totalAmountCents,
      Math.max(0, invoice.amount_paid),
    );
    const status = invoice.status ?? 'open';
    const eventAmount =
      eventType === 'invoice.paid'
        ? amountPaidCents
        : Math.max(0, totalAmountCents - amountPaidCents);
    const event = {
      eventId: stripeEventId,
      type: eventType,
      amountCents: eventAmount,
      currency: invoice.currency,
      status,
      occurredAt,
    };
    const setValues = {
      registrationRequestId: request._id,
      userId: request.userId,
      stripeSubscriptionId: subscriptionId,
      stripePaymentIntentId: paymentIntentId,
      stripeCustomerId: customerId,
      totalAmountCents,
      amountPaidCents,
      currency: invoice.currency,
      status,
      billingReason: invoice.billing_reason ?? undefined,
      dueAt: invoice.due_date ? new Date(invoice.due_date * 1000) : undefined,
      generatedAt: new Date(invoice.created * 1000),
      paidAt: invoice.status_transitions.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000)
        : undefined,
      lastEventCreatedAt: occurredAt,
    };

    const updated = await this.subscriptionInvoices
      .findOneAndUpdate(
        {
          stripeInvoiceId: invoice.id,
          processedStripeEventIds: { $ne: stripeEventId },
          $or: [
            { lastEventCreatedAt: { $exists: false } },
            { lastEventCreatedAt: { $lte: occurredAt } },
          ],
        },
        {
          $set: setValues,
          $addToSet: { processedStripeEventIds: stripeEventId },
          $push: { events: event },
        },
        { new: true, runValidators: true },
      )
      .exec();

    if (updated) {
      return;
    }

    const existing = await this.subscriptionInvoices
      .findOne({ stripeInvoiceId: invoice.id })
      .exec();
    if (
      existing?.processedStripeEventIds?.includes(stripeEventId) ||
      (existing?.lastEventCreatedAt &&
        existing.lastEventCreatedAt.getTime() > occurredAt.getTime())
    ) {
      return;
    }

    try {
      await this.subscriptionInvoices
        .findOneAndUpdate(
          {
            stripeInvoiceId: invoice.id,
            processedStripeEventIds: { $ne: stripeEventId },
            $or: [
              { lastEventCreatedAt: { $exists: false } },
              { lastEventCreatedAt: { $lte: occurredAt } },
            ],
          },
          {
            $setOnInsert: {
              stripeInvoiceId: invoice.id,
              refundedAmountCents:
                request.stripeCheckoutInvoiceId === invoice.id
                  ? (request.paymentRefundedAmountCents ?? 0)
                  : 0,
            },
            $set: setValues,
            $addToSet: { processedStripeEventIds: stripeEventId },
            $push: { events: event },
          },
          { new: true, upsert: true, runValidators: true },
        )
        .exec();
    } catch (error) {
      if (!this.isDuplicateKeyError(error)) {
        throw error;
      }

      await this.subscriptionInvoices
        .findOneAndUpdate(
          {
            stripeInvoiceId: invoice.id,
            processedStripeEventIds: { $ne: stripeEventId },
            $or: [
              { lastEventCreatedAt: { $exists: false } },
              { lastEventCreatedAt: { $lte: occurredAt } },
            ],
          },
          {
            $set: setValues,
            $addToSet: { processedStripeEventIds: stripeEventId },
            $push: { events: event },
          },
          { new: true, runValidators: true },
        )
        .exec();
    }
  }

  private async recordRefundEvent(
    charge: Stripe.Charge,
    stripeEventId: string,
    occurredAt: Date,
  ): Promise<void> {
    const paymentIntentId = this.getStripeId(charge.payment_intent);
    const invoiceId = this.getStripeId(
      (
        charge as Stripe.Charge & {
          invoice?: string | { id: string } | null;
        }
      ).invoice,
    );
    const invoiceFilters: Array<Record<string, unknown>> = [];
    if (invoiceId) {
      invoiceFilters.push({ stripeInvoiceId: invoiceId });
    }
    if (paymentIntentId) {
      invoiceFilters.push({ stripePaymentIntentId: paymentIntentId });
    }
    const refundEvent = {
      eventId: stripeEventId,
      type: 'charge.refunded',
      amountCents: charge.amount_refunded,
      currency: charge.currency,
      status: 'refunded',
      occurredAt,
    };
    for (const invoiceFilter of invoiceFilters) {
      let invoiceUpdate = await this.subscriptionInvoices
        .findOneAndUpdate(
          {
            ...invoiceFilter,
            processedStripeEventIds: { $ne: stripeEventId },
            'refunds.stripeChargeId': charge.id,
          },
          {
            $max: { 'refunds.$.amountCents': charge.amount_refunded },
            $addToSet: { processedStripeEventIds: stripeEventId },
            $push: { events: refundEvent },
          },
          { new: true },
        )
        .exec();
      if (!invoiceUpdate) {
        invoiceUpdate = await this.subscriptionInvoices
          .findOneAndUpdate(
            {
              ...invoiceFilter,
              processedStripeEventIds: { $ne: stripeEventId },
              'refunds.stripeChargeId': { $ne: charge.id },
            },
            {
              $push: {
                refunds: {
                  stripeChargeId: charge.id,
                  amountCents: charge.amount_refunded,
                },
                events: refundEvent,
              },
              $addToSet: { processedStripeEventIds: stripeEventId },
            },
            { new: true },
          )
          .exec();
      }
      if (!invoiceUpdate) {
        invoiceUpdate = await this.subscriptionInvoices
          .findOneAndUpdate(
            {
              ...invoiceFilter,
              processedStripeEventIds: { $ne: stripeEventId },
              'refunds.stripeChargeId': charge.id,
            },
            {
              $max: { 'refunds.$.amountCents': charge.amount_refunded },
              $addToSet: { processedStripeEventIds: stripeEventId },
              $push: { events: refundEvent },
            },
            { new: true },
          )
          .exec();
      }
      if (invoiceUpdate) {
        return;
      }
    }

    if (!paymentIntentId) {
      return;
    }

    await this.registrationRequests
      .findOneAndUpdate(
        {
          accountType: 'shop',
          stripePaymentIntentId: paymentIntentId,
          processedStripeEventIds: { $ne: stripeEventId },
        },
        {
          $max: { paymentRefundedAmountCents: charge.amount_refunded },
          $addToSet: { processedStripeEventIds: stripeEventId },
        },
        { new: true },
      )
      .exec();
  }

  private getInvoiceSubscriptionId(
    invoice: Stripe.Invoice,
  ): string | undefined {
    const subscription =
      invoice.parent?.subscription_details?.subscription ??
      (
        invoice as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
        }
      ).subscription;
    return typeof subscription === 'string' ? subscription : subscription?.id;
  }

  private getInvoicePaymentIntentId(
    invoice: Stripe.Invoice,
  ): string | undefined {
    const paymentIntent = (
      invoice as Stripe.Invoice & {
        payment_intent?: string | Stripe.PaymentIntent | null;
      }
    ).payment_intent;
    if (paymentIntent) {
      return this.getStripeId(paymentIntent);
    }
    return this.getStripeId(
      invoice.payments?.data.find(
        (payment) =>
          payment.status === 'paid' && payment.payment.payment_intent,
      )?.payment.payment_intent,
    );
  }

  private getStripeId(
    value: string | { id: string } | null | undefined,
  ): string | undefined {
    return typeof value === 'string' ? value : value?.id;
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    );
  }

  private getStripeErrorDetails(
    error: unknown,
  ): { type: string; code?: string; requestId?: string } | null {
    if (typeof error !== 'object' || error === null) return null;
    const details = error as Record<string, unknown>;
    if (
      typeof details.type !== 'string' ||
      !details.type.startsWith('Stripe')
    ) {
      return null;
    }
    return {
      type: details.type,
      ...(typeof details.code === 'string' ? { code: details.code } : {}),
      ...(typeof details.requestId === 'string'
        ? { requestId: details.requestId }
        : {}),
    };
  }

  private async markRepairInvoicePayment(
    session: Stripe.Checkout.Session,
    eventId: string,
    eventCreated: number,
  ): Promise<void> {
    const metadata = session.metadata;
    if (
      !metadata?.invoiceId ||
      !metadata.customerId ||
      !metadata.shopId ||
      !metadata.paymentAttemptId ||
      !Types.ObjectId.isValid(metadata.invoiceId) ||
      !Types.ObjectId.isValid(metadata.customerId) ||
      !Types.ObjectId.isValid(metadata.shopId)
    ) {
      throw new BadRequestException(
        'Repair invoice payment metadata is incomplete.',
      );
    }

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const invoice = await this.repairInvoices
        .findOne({
          _id: new Types.ObjectId(metadata.invoiceId),
          customerId: new Types.ObjectId(metadata.customerId),
          shopId: new Types.ObjectId(metadata.shopId),
          invoiceStatus: 'issued',
        })
        .exec();
      if (!invoice)
        throw new NotFoundException('The payment invoice was not found.');

      const payment = invoice.payments.find(
        (entry) => entry.stripeAttemptId === metadata.paymentAttemptId,
      );
      if (!payment)
        throw new ConflictException('The payment attempt was not found.');
      if (payment.status === 'succeeded') {
        await this.notifyShopOfRepairInvoicePayment(invoice, payment);
        return;
      }
      if (payment.status !== 'pending') {
        throw new ConflictException(
          'The payment attempt is no longer pending.',
        );
      }
      if (
        (payment.stripeCheckoutSessionId &&
          payment.stripeCheckoutSessionId !== session.id) ||
        session.amount_total !==
          toMinorCurrencyUnits(payment.amount, invoice.currency) ||
        session.currency?.toUpperCase() !== invoice.currency.toUpperCase()
      ) {
        throw new BadRequestException(
          'Stripe payment details do not match the invoice.',
        );
      }

      const paymentIntentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);
      const amountPaid = roundCurrencyAmount(
        invoice.amountPaid + payment.amount,
        invoice.currency,
      );
      const balanceDue = roundCurrencyAmount(
        Math.max(0, invoice.grandTotal - amountPaid),
        invoice.currency,
      );
      payment.status = 'succeeded';
      payment.paymentDate = new Date(eventCreated * 1000);
      payment.reference = paymentIntentId || session.id;
      payment.stripeCheckoutSessionId = session.id;
      payment.stripePaymentIntentId = paymentIntentId;
      payment.stripeEventId = eventId;
      invoice.amountPaid = amountPaid;
      invoice.balanceDue = balanceDue;
      invoice.paymentStatus = balanceDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';
      try {
        await invoice.save();
      } catch (error) {
        if (
          !(error instanceof Error && error.name === 'VersionError') ||
          attempt === 3
        ) {
          throw error;
        }
        continue;
      }
      await this.notifyShopOfRepairInvoicePayment(invoice, payment);
      return;
    }
  }

  private notifyShopOfRepairInvoicePayment(
    invoice: RepairInvoice,
    payment: RepairInvoicePayment,
  ): Promise<void> {
    return this.notifications.notifyUsers([invoice.shopId], {
      title: 'Online Invoice Payment Received',
      message: `${invoice.customer.name} paid ${payment.amount} ${invoice.currency} online toward invoice ${invoice.invoiceNumber}.`,
      type: 'repair_invoice_payment_received',
      relatedEntityId: invoice.repairRequestId,
      relatedEntityType: 'repair_request',
      link: `/shop/jobs/completed-jobs/${invoice.repairRequestId.toString()}`,
      deduplicationKey: `repair-invoice-payment:${invoice.repairRequestId.toString()}:${payment.stripeAttemptId}:${invoice.shopId.toString()}`,
    });
  }

  private async markRepairInvoiceAttemptClosed(
    session: Stripe.Checkout.Session,
    status: 'failed' | 'cancelled',
  ): Promise<void> {
    const metadata = session.metadata;
    if (
      !metadata?.invoiceId ||
      !metadata.customerId ||
      !metadata.shopId ||
      !metadata.paymentAttemptId ||
      !Types.ObjectId.isValid(metadata.invoiceId) ||
      !Types.ObjectId.isValid(metadata.customerId) ||
      !Types.ObjectId.isValid(metadata.shopId)
    ) {
      return;
    }
    const invoice = await this.repairInvoices
      .findOne({
        _id: new Types.ObjectId(metadata.invoiceId),
        customerId: new Types.ObjectId(metadata.customerId),
        shopId: new Types.ObjectId(metadata.shopId),
        invoiceStatus: 'issued',
      })
      .exec();
    if (!invoice) return;
    const payment = invoice.payments.find(
      (entry) => entry.stripeAttemptId === metadata.paymentAttemptId,
    );
    if (!payment || payment.status !== 'pending') return;
    if (
      payment.stripeCheckoutSessionId &&
      payment.stripeCheckoutSessionId !== session.id
    ) {
      throw new BadRequestException(
        'Stripe session does not match the invoice payment attempt.',
      );
    }
    payment.status = status;
    payment.stripeCheckoutSessionId = session.id;
    await invoice.save();
  }

  private async markRepairInvoiceAttemptFailed(
    invoiceId: string,
    paymentAttemptId: string,
  ): Promise<void> {
    const invoice = await this.repairInvoices.findById(invoiceId).exec();
    const payment = invoice?.payments.find(
      (entry) => entry.stripeAttemptId === paymentAttemptId,
    );
    if (!invoice || !payment || payment.status !== 'pending') return;
    payment.status = 'failed';
    await invoice.save();
  }

  private getStripe(): Stripe {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (
      !secretKey ||
      secretKey === 'sk_test_REPLACEWITHROTATEDTESTSECRET' ||
      secretKey.includes('REPLACE')
    ) {
      throw new ServiceUnavailableException(
        'Shop payments are not configured. Please try again later.',
      );
    }
    return new Stripe(secretKey);
  }

  private getWebhookSecret(): string {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      throw new ServiceUnavailableException(
        'Shop payment verification is not configured. Please try again later.',
      );
    }
    return webhookSecret;
  }

  private toObjectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new ConflictException(
        'The authenticated Shop account or registration reference is invalid.',
      );
    }
    return new Types.ObjectId(id);
  }
}
