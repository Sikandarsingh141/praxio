import { HydratedDocument, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export const REGISTRATION_STATUSES = [
  'pending',
  'approved',
  'declined',
] as const;

export const REGISTRATION_ACCOUNT_TYPES = ['customer', 'shop'] as const;
export const REGISTRATION_PAYMENT_STATUSES = [
  'not_required',
  'unpaid',
  'paid',
] as const;

@Schema({
  collection: 'registration_requests',
  timestamps: true,
  versionKey: false,
})
export class RegistrationRequest {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: REGISTRATION_ACCOUNT_TYPES, required: true })
  accountType!: (typeof REGISTRATION_ACCOUNT_TYPES)[number];

  @Prop({ type: String, required: true, unique: true, trim: true })
  registrationNumber!: string;

  @Prop({
    type: String,
    enum: REGISTRATION_STATUSES,
    required: true,
    default: 'pending',
  })
  registrationStatus!: (typeof REGISTRATION_STATUSES)[number];

  @Prop({ type: Date, required: true, default: Date.now })
  submittedAt!: Date;

  @Prop({ type: Date })
  reviewedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewedBy?: Types.ObjectId;

  @Prop({ type: String, trim: true, maxlength: 500 })
  declineReason?: string;

  @Prop({ type: String, trim: true, maxlength: 1000 })
  adminRemarks?: string;

  @Prop({
    type: String,
    enum: REGISTRATION_PAYMENT_STATUSES,
    required: true,
    default: 'not_required',
  })
  paymentStatus!: (typeof REGISTRATION_PAYMENT_STATUSES)[number];

  @Prop({ type: String, trim: true })
  stripeCheckoutSessionId?: string;

  @Prop({ type: String, trim: true })
  stripeCustomerId?: string;

  @Prop({ type: String, trim: true })
  stripeSubscriptionId?: string;

  @Prop({ type: String, trim: true })
  stripePaymentIntentId?: string;

  @Prop({ type: String, trim: true })
  stripePaymentId?: string;

  @Prop({ type: Number, min: 0 })
  paymentAmountCents?: number;

  @Prop({ type: String, lowercase: true, trim: true, maxlength: 3 })
  paymentCurrency?: string;

  @Prop({ type: Date })
  paidAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export type RegistrationRequestDocument = HydratedDocument<RegistrationRequest>;

export const RegistrationRequestSchema =
  SchemaFactory.createForClass(RegistrationRequest);

RegistrationRequestSchema.index(
  { userId: 1 },
  { unique: true, name: 'UQ_registration_requests_user' },
);
RegistrationRequestSchema.index(
  { registrationNumber: 1 },
  { unique: true, name: 'UQ_registration_requests_number' },
);
RegistrationRequestSchema.index(
  { registrationStatus: 1, submittedAt: -1 },
  { name: 'IX_registration_requests_status_submitted' },
);
