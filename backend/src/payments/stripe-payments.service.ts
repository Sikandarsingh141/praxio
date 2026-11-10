import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import Stripe from 'stripe';
import { Model, Types } from 'mongoose';
import { RegistrationRequest } from '../registrations/schemas/registration-request.schema';
import { ShopSubscriptionInvoice } from './schemas/shop-subscription-invoice.schema';

const SHOP_SUBSCRIPTION_AMOUNT_CENTS = 2900;
const SHOP_SUBSCRIPTION_CURRENCY = 'usd';

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

@Injectable()
export class StripePaymentsService {
  constructor(
    private readonly configService: ConfigService,
    @InjectModel(RegistrationRequest.name)
    private readonly registrationRequests: Model<RegistrationRequest>,
    @InjectModel(ShopSubscriptionInvoice.name)
    private readonly subscriptionInvoices: Model<ShopSubscriptionInvoice>,
  ) {}

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

  private getStripe(): Stripe {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
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
