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
      await this.markPaid(event.data.object);
    }
  }

  private async markPaid(session: Stripe.Checkout.Session): Promise<boolean> {
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
    const updated = await this.registrationRequests
      .findOneAndUpdate(
        {
          _id: this.toObjectId(requestId),
          userId: this.toObjectId(userId),
          accountType: 'shop',
          registrationStatus: { $ne: 'declined' },
          stripeCheckoutSessionId: session.id,
        },
        {
          $set: {
            paymentStatus: 'paid',
            paidAt: new Date(),
            paymentAmountCents:
              session.amount_total ?? SHOP_SUBSCRIPTION_AMOUNT_CENTS,
            paymentCurrency: session.currency ?? SHOP_SUBSCRIPTION_CURRENCY,
            ...(customerId ? { stripeCustomerId: customerId } : {}),
            ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
            ...(paymentIntentId
              ? { stripePaymentIntentId: paymentIntentId }
              : {}),
            stripePaymentId: paymentIntentId ?? session.id,
          },
        },
        { new: true, runValidators: true },
      )
      .exec();
    return Boolean(updated);
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
