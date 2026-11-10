import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { RegistrationRequest } from '../registrations/schemas/registration-request.schema';
import { StripePaymentsService } from './stripe-payments.service';

const mockStripeClient = {
  checkout: {
    sessions: {
      create: jest.fn(),
      retrieve: jest.fn(),
      expire: jest.fn(),
    },
  },
  invoices: { retrieve: jest.fn() },
  webhooks: { constructEvent: jest.fn() },
};

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn(() => mockStripeClient),
}));

describe('StripePaymentsService', () => {
  const registrationRequestId = '507f1f77bcf86cd799439012';
  const userId = '507f1f77bcf86cd799439011';
  const registrationRequest = {
    _id: { toString: () => registrationRequestId },
    userId: new Types.ObjectId(userId),
    registrationStatus: 'pending' as string,
    paymentStatus: 'unpaid' as string | undefined,
    stripeCheckoutSessionId: undefined,
    stripeSubscriptionId: undefined as string | undefined,
  };
  const lookupQuery = {
    exec: jest.fn().mockResolvedValue(registrationRequest),
  };
  const updateQuery = {
    exec: jest.fn().mockResolvedValue(registrationRequest),
  };
  const invoiceLookupQuery = {
    exec: jest.fn().mockResolvedValue(null),
  };
  const registrationRequests = {
    findOne: jest.fn().mockReturnValue(lookupQuery),
    findOneAndUpdate: jest
      .fn<
        typeof updateQuery,
        [
          Record<string, unknown>,
          Record<string, unknown>,
          Record<string, unknown>,
        ]
      >()
      .mockReturnValue(updateQuery),
  };
  const subscriptionInvoices = {
    findOne: jest.fn().mockReturnValue(invoiceLookupQuery),
    findOneAndUpdate: jest
      .fn<
        typeof updateQuery,
        [
          Record<string, unknown>,
          Record<string, unknown>,
          Record<string, unknown>,
        ]
      >()
      .mockReturnValue(updateQuery),
  };
  const configValues: Record<string, string> = {
    STRIPE_SECRET_KEY: 'sk_test_local_only',
    STRIPE_WEBHOOK_SECRET: 'whsec_local_only',
    FRONTEND_ORIGINS: 'http://localhost:4200,http://localhost:3000',
  };
  const configService = {
    get: jest.fn((key: string) => configValues[key]),
    getOrThrow: jest.fn((key: string) => configValues[key]),
  };
  let service: StripePaymentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    registrationRequest.registrationStatus = 'pending';
    registrationRequest.paymentStatus = 'unpaid';
    registrationRequest.stripeCheckoutSessionId = undefined;
    registrationRequest.stripeSubscriptionId = undefined;
    lookupQuery.exec.mockResolvedValue(registrationRequest);
    updateQuery.exec.mockResolvedValue(registrationRequest);
    subscriptionInvoices.findOne.mockReturnValue(invoiceLookupQuery);
    subscriptionInvoices.findOneAndUpdate.mockReturnValue(updateQuery);
    mockStripeClient.checkout.sessions.create.mockResolvedValue({
      id: 'cs_test_checkout',
      status: 'open',
      url: 'https://checkout.stripe.test/session',
    });
    mockStripeClient.webhooks.constructEvent.mockReturnValue({
      type: 'ignored.event',
      data: { object: {} },
    });
    service = new StripePaymentsService(
      configService as unknown as ConfigService,
      registrationRequests as unknown as import('mongoose').Model<RegistrationRequest>,
      subscriptionInvoices as unknown as import('mongoose').Model<
        import('./schemas/shop-subscription-invoice.schema').ShopSubscriptionInvoice
      >,
    );
  });

  it('creates a USD 29 monthly subscription checkout for the pending shop', async () => {
    await expect(
      service.createShopCheckout(
        userId,
        'owner@example.com',
        registrationRequestId,
      ),
    ).resolves.toBe('https://checkout.stripe.test/session');

    expect(mockStripeClient.checkout.sessions.create).toHaveBeenCalledWith({
      mode: 'subscription',
      customer_email: 'owner@example.com',
      client_reference_id: registrationRequestId,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: 2900,
            recurring: { interval: 'month' },
            product_data: { name: 'Fixroa Shop monthly subscription' },
          },
          quantity: 1,
        },
      ],
      metadata: {
        registrationRequestId,
        userId,
        accountType: 'shop',
      },
      subscription_data: {
        metadata: {
          registrationRequestId,
          userId,
          accountType: 'shop',
        },
      },
      success_url:
        'http://localhost:4200/auth/register/shop/payment/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'http://localhost:4200/shop/payment?cancelled=1',
    });
    expect(registrationRequests.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: new Types.ObjectId(registrationRequestId),
        userId: new Types.ObjectId(userId),
        accountType: 'shop',
        registrationStatus: 'pending',
        paymentStatus: { $ne: 'paid' },
      },
      {
        $set: {
          paymentStatus: 'unpaid',
          stripeCheckoutSessionId: 'cs_test_checkout',
        },
      },
      { new: true, runValidators: true },
    );
  });

  it('resumes checkout for a legacy pending shop registration without unpaid status', async () => {
    registrationRequest.paymentStatus = undefined;
    await expect(
      service.createShopCheckout(
        userId,
        'owner@example.com',
        registrationRequestId,
      ),
    ).resolves.toBe('https://checkout.stripe.test/session');

    expect(registrationRequests.findOne).toHaveBeenCalledWith({
      _id: new Types.ObjectId(registrationRequestId),
      userId: new Types.ObjectId(userId),
      accountType: 'shop',
    });
    expect(registrationRequests.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentStatus: { $ne: 'paid' },
      }),
      {
        $set: {
          paymentStatus: 'unpaid',
          stripeCheckoutSessionId: 'cs_test_checkout',
        },
      },
      { new: true, runValidators: true },
    );
  });

  it('explains when checkout is requested after Admin review is complete', async () => {
    registrationRequest.registrationStatus = 'approved';

    await expect(
      service.createShopCheckout(
        userId,
        'owner@example.com',
        registrationRequestId,
      ),
    ).rejects.toThrow(
      'This shop registration is no longer pending Admin review. Sign in to view its status.',
    );
    expect(mockStripeClient.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('prevents a second checkout after Stripe payment has been recorded', async () => {
    registrationRequest.paymentStatus = 'paid';

    await expect(
      service.createShopCheckout(
        userId,
        'owner@example.com',
        registrationRequestId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(mockStripeClient.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('reuses an open checkout session when a shop retries payment', async () => {
    registrationRequest.stripeCheckoutSessionId = 'cs_test_existing';
    mockStripeClient.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_test_existing',
      status: 'open',
      url: 'https://checkout.stripe.test/existing',
    });

    await expect(
      service.createShopCheckout(
        userId,
        'owner@example.com',
        registrationRequestId,
      ),
    ).resolves.toBe('https://checkout.stripe.test/existing');

    expect(mockStripeClient.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it('marks a completed shop subscription as paid only after signature verification', async () => {
    const paidSession = {
      id: 'cs_test_checkout',
      mode: 'subscription',
      payment_status: 'paid',
      metadata: { registrationRequestId, userId, accountType: 'shop' },
      customer: 'cus_test',
      subscription: 'sub_test',
    };
    mockStripeClient.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: paidSession },
    });

    await service.handleWebhook(Buffer.from('{}'), 'stripe-signature');

    expect(mockStripeClient.webhooks.constructEvent).toHaveBeenCalledWith(
      Buffer.from('{}'),
      'stripe-signature',
      'whsec_local_only',
    );
    const updatePayload =
      registrationRequests.findOneAndUpdate.mock.calls[0]?.[1];
    expect(updatePayload).toMatchObject({
      $set: {
        paymentStatus: 'paid',
        stripeCustomerId: 'cus_test',
        stripeSubscriptionId: 'sub_test',
        stripePaymentId: 'cs_test_checkout',
        paymentAmountCents: 2900,
        paymentCurrency: 'usd',
      },
    });
    expect(
      (updatePayload as { $min: Record<string, unknown> }).$min['paidAt'],
    ).toBeInstanceOf(Date);
  });

  it('persists finalized and paid subscription invoices idempotently', async () => {
    registrationRequest.stripeSubscriptionId = 'sub_test';
    lookupQuery.exec.mockResolvedValue(registrationRequest);
    updateQuery.exec.mockResolvedValueOnce(null).mockResolvedValueOnce({
      stripeInvoiceId: 'in_test_invoice',
    });
    const invoice = {
      id: 'in_test_invoice',
      customer: 'cus_test',
      currency: 'usd',
      created: 1794268800,
      due_date: 1794355200,
      amount_due: 2900,
      amount_paid: 2900,
      total: 2900,
      status: 'paid',
      status_transitions: { paid_at: 1794268800 },
      parent: {
        subscription_details: {
          subscription: 'sub_test',
          metadata: { registrationRequestId },
        },
      },
    };
    mockStripeClient.webhooks.constructEvent.mockReturnValue({
      id: 'evt_invoice_paid',
      type: 'invoice.paid',
      created: 1794268800,
      data: { object: invoice },
    });

    await service.handleWebhook(Buffer.from('{}'), 'stripe-signature');

    expect(registrationRequests.findOne).toHaveBeenCalledWith({
      _id: new Types.ObjectId(registrationRequestId),
      accountType: 'shop',
    });
    const invoiceUpdate = subscriptionInvoices.findOneAndUpdate.mock.calls[1];
    expect(invoiceUpdate?.[0]).toMatchObject({
      stripeInvoiceId: 'in_test_invoice',
      processedStripeEventIds: { $ne: 'evt_invoice_paid' },
    });
    expect(invoiceUpdate?.[1]).toMatchObject({
      $set: {
        totalAmountCents: 2900,
        amountPaidCents: 2900,
        status: 'paid',
        currency: 'usd',
      },
      $addToSet: { processedStripeEventIds: 'evt_invoice_paid' },
      $push: {
        events: {
          eventId: 'evt_invoice_paid',
          type: 'invoice.paid',
          amountCents: 2900,
        },
      },
    });
    expect(invoiceUpdate?.[2]).toMatchObject({ upsert: true });
  });

  it('persists cumulative Stripe refunds for subscription invoices', async () => {
    mockStripeClient.webhooks.constructEvent.mockReturnValue({
      id: 'evt_refund',
      type: 'charge.refunded',
      created: 1794268800,
      data: {
        object: {
          id: 'ch_test',
          invoice: 'in_test_invoice',
          payment_intent: 'pi_test',
          amount_refunded: 1200,
          currency: 'usd',
        },
      },
    });

    await service.handleWebhook(Buffer.from('{}'), 'stripe-signature');

    expect(subscriptionInvoices.findOneAndUpdate).toHaveBeenCalledWith(
      {
        stripeInvoiceId: 'in_test_invoice',
        processedStripeEventIds: { $ne: 'evt_refund' },
        'refunds.stripeChargeId': 'ch_test',
      },
      expect.objectContaining({
        $max: { 'refunds.$.amountCents': 1200 },
        $addToSet: { processedStripeEventIds: 'evt_refund' },
      }),
      { new: true },
    );
  });

  it('returns only this shop registration payment details', async () => {
    lookupQuery.exec.mockResolvedValue({
      registrationStatus: 'pending',
      paymentStatus: 'paid',
      paymentAmountCents: 2900,
      paymentCurrency: 'usd',
      paidAt: new Date('2026-01-02T00:00:00.000Z'),
      stripeCustomerId: 'cus_test',
      stripeSubscriptionId: 'sub_test',
      stripePaymentIntentId: 'pi_test',
      stripePaymentId: 'pi_test',
    });

    await expect(service.getPaymentStatus(userId)).resolves.toMatchObject({
      registrationStatus: 'pending',
      paymentStatus: 'paid',
      amountCents: 2900,
      currency: 'usd',
      stripePaymentIntentId: 'pi_test',
      paymentId: 'pi_test',
    });
    expect(registrationRequests.findOne).toHaveBeenCalledWith({
      userId: new Types.ObjectId(userId),
      accountType: 'shop',
    });
  });

  it('confirms payment from the Stripe Checkout session before returning success', async () => {
    mockStripeClient.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_test_checkout',
      mode: 'subscription',
      payment_status: 'paid',
      metadata: { registrationRequestId, userId, accountType: 'shop' },
      customer: 'cus_test',
      subscription: 'sub_test',
    });

    await expect(
      service.confirmCheckout('cs_test_checkout', userId),
    ).resolves.toBeUndefined();
    expect(mockStripeClient.checkout.sessions.retrieve).toHaveBeenCalledWith(
      'cs_test_checkout',
    );
    expect(registrationRequests.findOneAndUpdate).toHaveBeenCalled();
  });

  it('lets Stripe verify the public return redirect without trusting its response', async () => {
    mockStripeClient.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_test_checkout',
      mode: 'subscription',
      payment_status: 'paid',
      metadata: { registrationRequestId, userId, accountType: 'shop' },
    });

    await expect(
      service.confirmCheckout('cs_test_checkout'),
    ).resolves.toBeUndefined();
    expect(registrationRequests.findOneAndUpdate).toHaveBeenCalled();
  });

  it('does not confirm a checkout belonging to a different Shop user', async () => {
    mockStripeClient.checkout.sessions.retrieve.mockResolvedValue({
      id: 'cs_test_checkout',
      mode: 'subscription',
      payment_status: 'paid',
      metadata: {
        registrationRequestId,
        userId: '507f1f77bcf86cd799439099',
        accountType: 'shop',
      },
    });

    await expect(
      service.confirmCheckout('cs_test_checkout', userId),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(registrationRequests.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects webhooks with an invalid Stripe signature', async () => {
    mockStripeClient.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('invalid signature');
    });

    await expect(
      service.handleWebhook(Buffer.from('{}'), 'bad-signature'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(registrationRequests.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
