import { HydratedDocument, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class ShopSubscriptionInvoiceEvent {
  @Prop({ type: String, required: true })
  eventId!: string;

  @Prop({ type: String, required: true })
  type!: string;

  @Prop({ type: Number, min: 0 })
  amountCents?: number;

  @Prop({ type: String, lowercase: true, trim: true, maxlength: 3 })
  currency?: string;

  @Prop({ type: String })
  status?: string;

  @Prop({ type: Date, required: true })
  occurredAt!: Date;
}

export const ShopSubscriptionInvoiceEventSchema = SchemaFactory.createForClass(
  ShopSubscriptionInvoiceEvent,
);

@Schema({ _id: false })
export class ShopSubscriptionInvoiceRefund {
  @Prop({ type: String, required: true })
  stripeChargeId!: string;

  @Prop({ type: Number, min: 0, required: true })
  amountCents!: number;
}

export const ShopSubscriptionInvoiceRefundSchema = SchemaFactory.createForClass(
  ShopSubscriptionInvoiceRefund,
);

@Schema({
  collection: 'shop_subscription_invoices',
  timestamps: true,
  versionKey: false,
})
export class ShopSubscriptionInvoice {
  @Prop({ type: String, required: true, trim: true })
  stripeInvoiceId!: string;

  @Prop({ type: Types.ObjectId, ref: 'RegistrationRequest', required: true })
  registrationRequestId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, trim: true })
  stripeSubscriptionId?: string;

  @Prop({ type: String, trim: true })
  stripePaymentIntentId?: string;

  @Prop({ type: String, trim: true })
  stripeCustomerId?: string;

  @Prop({ type: Number, min: 0, required: true })
  totalAmountCents!: number;

  @Prop({ type: Number, min: 0, default: 0 })
  amountPaidCents!: number;

  @Prop({ type: Number, min: 0, default: 0 })
  refundedAmountCents!: number;

  @Prop({
    type: String,
    lowercase: true,
    trim: true,
    maxlength: 3,
    required: true,
  })
  currency!: string;

  @Prop({ type: String, required: true })
  status!: string;

  @Prop({ type: String })
  billingReason?: string;

  @Prop({ type: Date })
  dueAt?: Date;

  @Prop({ type: Date, required: true })
  generatedAt!: Date;

  @Prop({ type: Date })
  paidAt?: Date;

  @Prop({ type: Date })
  lastEventCreatedAt?: Date;

  @Prop({ type: [String], default: [] })
  processedStripeEventIds!: string[];

  @Prop({ type: [ShopSubscriptionInvoiceEventSchema], default: [] })
  events!: ShopSubscriptionInvoiceEvent[];

  @Prop({ type: [ShopSubscriptionInvoiceRefundSchema], default: [] })
  refunds!: ShopSubscriptionInvoiceRefund[];
}

export type ShopSubscriptionInvoiceDocument =
  HydratedDocument<ShopSubscriptionInvoice>;

export const ShopSubscriptionInvoiceSchema = SchemaFactory.createForClass(
  ShopSubscriptionInvoice,
);

ShopSubscriptionInvoiceSchema.index(
  { stripeInvoiceId: 1 },
  { unique: true, name: 'UQ_shop_subscription_invoices_stripe_id' },
);
ShopSubscriptionInvoiceSchema.index(
  { generatedAt: -1, currency: 1 },
  { name: 'IX_shop_subscription_invoices_generated' },
);
ShopSubscriptionInvoiceSchema.index(
  { dueAt: 1, status: 1 },
  { name: 'IX_shop_subscription_invoices_due_status' },
);
ShopSubscriptionInvoiceSchema.index(
  { paidAt: -1, currency: 1 },
  { name: 'IX_shop_subscription_invoices_paid' },
);
