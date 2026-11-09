import { HydratedDocument, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export const DISPUTE_CATEGORIES = [
  'same_issue_exists',
  'repair_quality',
  'device_not_working',
  'new_issue_discovered',
  'unauthorized_work',
  'incorrect_charges',
  'overcharge',
  'incomplete_repair',
  'item_not_returned',
  'device_damaged',
  'shop_unresponsive',
  'payment',
  'collection',
  'other',
] as const;

export const DISPUTE_WORKFLOW_STATUSES = [
  'OPEN',
  'UNDER_REVIEW',
  'AWAITING_SHOP_RESPONSE',
  'AWAITING_CUSTOMER_RESPONSE',
  'RESOLVED',
  'CLOSED',
  'REJECTED',
] as const;

export const LEGACY_DISPUTE_STATUSES = [
  'ACCEPTED',
  'REINSPECTION_IN_PROGRESS',
  'AWAITING_CUSTOMER_APPROVAL',
  'REPAIR_IN_PROGRESS',
  'CUSTOMER_VERIFICATION_PENDING',
  'CUSTOMER_CONFIRMED',
  'REOPENED',
  'RESOLUTION_PROPOSED',
] as const;

export const DISPUTE_STATUSES = [
  ...DISPUTE_WORKFLOW_STATUSES,
  ...LEGACY_DISPUTE_STATUSES,
] as const;

export const DISPUTE_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export const DISPUTE_ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

@Schema({ _id: false })
export class DisputeAttachment {
  @Prop({ type: String, required: true, enum: DISPUTE_ATTACHMENT_TYPES })
  mimeType!: (typeof DISPUTE_ATTACHMENT_TYPES)[number];

  @Prop({ type: String, required: true, trim: true, maxlength: 180 })
  name!: string;

  @Prop({ type: Types.ObjectId })
  fileId?: Types.ObjectId;

  @Prop({ type: Number, min: 0 })
  size?: number;

  @Prop({ type: String })
  data?: string;
}

export const DisputeAttachmentSchema =
  SchemaFactory.createForClass(DisputeAttachment);

@Schema({ _id: false })
export class DisputeMessage {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  authorId!: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ['customer', 'shop', 'admin'] })
  authorRole!: 'customer' | 'shop' | 'admin';

  @Prop({ type: String, required: true, trim: true, maxlength: 4000 })
  message!: string;

  @Prop({ type: [DisputeAttachmentSchema], default: [] })
  attachments!: DisputeAttachment[];

  @Prop({ type: Boolean, default: false })
  internal!: boolean;

  @Prop({ type: Date, required: true, default: Date.now })
  createdAt!: Date;
}

export const DisputeMessageSchema =
  SchemaFactory.createForClass(DisputeMessage);

@Schema({ _id: false })
export class DisputeStatusChange {
  @Prop({ type: String, required: true, enum: [...DISPUTE_STATUSES, 'NONE'] })
  from!: (typeof DISPUTE_STATUSES)[number] | 'NONE';

  @Prop({ type: String, required: true, enum: DISPUTE_STATUSES })
  to!: (typeof DISPUTE_STATUSES)[number];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actorId!: Types.ObjectId;

  @Prop({ type: String, required: true, enum: ['customer', 'shop', 'admin'] })
  actorRole!: 'customer' | 'shop' | 'admin';

  @Prop({ type: String, trim: true, maxlength: 1000 })
  reason?: string;

  @Prop({ type: Date, required: true, default: Date.now })
  at!: Date;
}

export const DisputeStatusChangeSchema =
  SchemaFactory.createForClass(DisputeStatusChange);

@Schema({ _id: false })
export class ShopDisputeResponse {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  respondedBy!: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, maxlength: 3000 })
  explanation!: string;

  @Prop({ type: String, trim: true, maxlength: 2000 })
  proposedResolution?: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 4000 })
  message!: string;

  @Prop({ type: [DisputeAttachmentSchema], default: [] })
  attachments!: DisputeAttachment[];

  @Prop({ type: Date, required: true, default: Date.now })
  respondedAt!: Date;
}

export const ShopDisputeResponseSchema =
  SchemaFactory.createForClass(ShopDisputeResponse);

@Schema({ _id: false })
export class DisputeResolution {
  @Prop({
    type: String,
    enum: [
      'repair_again',
      'partial_refund',
      'full_refund',
      'additional_repair',
      'price_adjustment',
      'customer_compensation',
      'shop_compensation',
      'no_action',
      'other',
    ],
  })
  type?: string;

  @Prop({ type: String, trim: true, maxlength: 3000 })
  description?: string;

  @Prop({ type: Number, min: 0 })
  amount?: number;

  @Prop({ type: String, enum: ['customer', 'shop', 'both', 'not_applicable'] })
  responsibleParty?: string;

  @Prop({ type: String, trim: true, maxlength: 2000 })
  notes?: string;

  @Prop({
    type: String,
    enum: ['mutual_acceptance', 'admin_decision', 'other'],
  })
  decision?: string;

  @Prop({ type: String, trim: true, maxlength: 1000 })
  decisionExplanation?: string;

  @Prop({ type: String, enum: ['draft', 'proposed', 'final'] })
  state?: 'draft' | 'proposed' | 'final';

  @Prop({ type: [DisputeAttachmentSchema], default: [] })
  documents!: DisputeAttachment[];

  @Prop({ type: [DisputeAttachmentSchema], default: [] })
  completionDocuments!: DisputeAttachment[];

  @Prop({ type: Date })
  proposedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  proposedBy?: Types.ObjectId;

  @Prop({ type: Date })
  customerAcceptedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  customerAcceptedBy?: Types.ObjectId;

  @Prop({ type: Date })
  shopAcceptedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  shopAcceptedBy?: Types.ObjectId;

  @Prop({ type: String, trim: true, maxlength: 1000 })
  customerRejectionReason?: string;

  @Prop({ type: String, trim: true, maxlength: 1000 })
  shopRejectionReason?: string;

  @Prop({ type: String, trim: true, maxlength: 200 })
  refundTransactionId?: string;

  @Prop({ type: String, trim: true, maxlength: 1000 })
  completionNotes?: string;

  @Prop({ type: Boolean, default: false })
  requiredActionCompleted!: boolean;

  @Prop({ type: Date })
  resolvedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  resolvedBy?: Types.ObjectId;

  @Prop({ type: Date })
  closedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  closedBy?: Types.ObjectId;
}

export const DisputeResolutionSchema =
  SchemaFactory.createForClass(DisputeResolution);

@Schema({ _id: false })
export class DisputeChargeLine {
  @Prop({ type: String, required: true, trim: true, maxlength: 180 })
  description!: string;

  @Prop({ type: Number, required: true, min: 0 })
  amount!: number;
}

export const DisputeChargeLineSchema =
  SchemaFactory.createForClass(DisputeChargeLine);

@Schema()
export class DisputeAdditionalCharge {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, maxlength: 2000 })
  reason!: string;

  @Prop({ type: [DisputeChargeLineSchema], required: true, default: [] })
  items!: DisputeChargeLine[];

  @Prop({ type: Number, required: true, min: 0 })
  total!: number;

  @Prop({ type: String, trim: true, maxlength: 2000 })
  message?: string;

  @Prop({
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    required: true,
  })
  status!: 'pending' | 'accepted' | 'declined';

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  requestedBy!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  requestedAt!: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  decidedBy?: Types.ObjectId;

  @Prop({ type: Date })
  decidedAt?: Date;

  @Prop({ type: String, trim: true, maxlength: 1000 })
  decisionReason?: string;
}

export const DisputeAdditionalChargeSchema = SchemaFactory.createForClass(
  DisputeAdditionalCharge,
);

@Schema({ _id: false })
export class DisputeReinspection {
  @Prop({ type: String, required: true, trim: true, maxlength: 3000 })
  findings!: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 3000 })
  identifiedProblem!: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 3000 })
  requiredRepairWork!: string;

  @Prop({ type: String, trim: true, maxlength: 2000 })
  partsRequired?: string;

  @Prop({ type: Number, min: 0 })
  labourCharges?: number;

  @Prop({ type: Number, min: 0 })
  otherCharges?: number;

  @Prop({ type: String, trim: true, maxlength: 500 })
  estimatedCompletionTime?: string;

  @Prop({ type: String, trim: true, maxlength: 2000 })
  message?: string;

  @Prop({ type: [DisputeAttachmentSchema], default: [] })
  attachments!: DisputeAttachment[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  submittedBy!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  submittedAt!: Date;
}

export const DisputeReinspectionSchema =
  SchemaFactory.createForClass(DisputeReinspection);

@Schema({ _id: false })
export class DisputeProgress {
  @Prop({ type: String, required: true, trim: true, maxlength: 2000 })
  notes!: string;

  @Prop({ type: [DisputeAttachmentSchema], default: [] })
  attachments!: DisputeAttachment[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  submittedBy!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  submittedAt!: Date;
}

export const DisputeProgressSchema =
  SchemaFactory.createForClass(DisputeProgress);

@Schema({ _id: false })
export class DisputeReworkCompletion {
  @Prop({ type: String, required: true, trim: true, maxlength: 3000 })
  workPerformed!: string;

  @Prop({ type: String, trim: true, maxlength: 2000 })
  partsReplaced?: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 3000 })
  testingResults!: string;

  @Prop({ type: String, trim: true, maxlength: 2000 })
  finalNotes?: string;

  @Prop({ type: Boolean, required: true })
  tested!: boolean;

  @Prop({ type: [DisputeAttachmentSchema], default: [] })
  attachments!: DisputeAttachment[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  completedBy!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  completedAt!: Date;
}

export const DisputeReworkCompletionSchema = SchemaFactory.createForClass(
  DisputeReworkCompletion,
);

@Schema({ _id: false })
export class DisputeCustomerVerification {
  @Prop({ type: String, trim: true, maxlength: 2000 })
  comments?: string;

  @Prop({ type: [DisputeAttachmentSchema], default: [] })
  attachments!: DisputeAttachment[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  confirmedBy!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  confirmedAt!: Date;
}

export const DisputeCustomerVerificationSchema = SchemaFactory.createForClass(
  DisputeCustomerVerification,
);

@Schema({
  collection: 'repair_disputes',
  timestamps: true,
  versionKey: false,
})
export class Dispute {
  _id!: Types.ObjectId;

  @Prop({ type: String, required: true, unique: true, index: true })
  reference!: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'RepairRequest',
    required: true,
    index: true,
  })
  repairRequestId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customerId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  shopId!: Types.ObjectId;

  @Prop({ type: String, required: true, enum: DISPUTE_CATEGORIES })
  category!: (typeof DISPUTE_CATEGORIES)[number];

  @Prop({ type: String, required: true, trim: true, maxlength: 180 })
  subject!: string;

  @Prop({
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  normalizedSubject!: string;

  @Prop({ type: String })
  activeIssueKey?: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 5000 })
  description!: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 2000 })
  expectedResolution!: string;

  @Prop({ type: Number, min: 0 })
  amountInDispute?: number;

  @Prop({ type: [DisputeAttachmentSchema], default: [] })
  attachments!: DisputeAttachment[];

  @Prop({ type: String, trim: true, maxlength: 2000 })
  customerComments?: string;

  @Prop({
    type: String,
    required: true,
    enum: DISPUTE_STATUSES,
    default: 'OPEN',
    index: true,
  })
  status!: (typeof DISPUTE_STATUSES)[number];

  @Prop({
    type: String,
    required: true,
    enum: DISPUTE_PRIORITIES,
    default: 'normal',
    index: true,
  })
  priority!: (typeof DISPUTE_PRIORITIES)[number];

  @Prop({ type: [DisputeMessageSchema], default: [] })
  messages!: DisputeMessage[];

  @Prop({ type: [DisputeStatusChangeSchema], default: [] })
  statusHistory!: DisputeStatusChange[];

  @Prop({ type: [DisputeMessageSchema], default: [] })
  internalNotes!: DisputeMessage[];

  @Prop({ type: ShopDisputeResponseSchema })
  shopResponse?: ShopDisputeResponse;

  @Prop({ type: DisputeResolutionSchema, default: () => ({}) })
  resolution!: DisputeResolution;

  @Prop({ type: [DisputeReinspectionSchema], default: [] })
  reinspections!: DisputeReinspection[];

  @Prop({ type: [DisputeAdditionalChargeSchema], default: [] })
  additionalCharges!: DisputeAdditionalCharge[];

  @Prop({ type: [DisputeProgressSchema], default: [] })
  reworkProgress!: DisputeProgress[];

  @Prop({ type: [DisputeReworkCompletionSchema], default: [] })
  reworkCompletions!: DisputeReworkCompletion[];

  @Prop({ type: [DisputeCustomerVerificationSchema], default: [] })
  verificationHistory!: DisputeCustomerVerification[];

  @Prop({ type: Types.ObjectId, ref: 'User' })
  closedBy?: Types.ObjectId;

  @Prop({ type: Date })
  disputeClosedAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export type DisputeDocument = HydratedDocument<Dispute>;

export const DisputeSchema = SchemaFactory.createForClass(Dispute);
DisputeSchema.index(
  { repairRequestId: 1, category: 1, normalizedSubject: 1, status: 1 },
  { name: 'IX_disputes_request_issue_status' },
);
DisputeSchema.index(
  { activeIssueKey: 1 },
  { unique: true, sparse: true, name: 'UX_disputes_active_issue' },
);
DisputeSchema.index(
  { customerId: 1, status: 1, updatedAt: -1 },
  { name: 'IX_disputes_customer_status_updated' },
);
DisputeSchema.index(
  { shopId: 1, status: 1, updatedAt: -1 },
  { name: 'IX_disputes_shop_status_updated' },
);
DisputeSchema.index(
  { status: 1, priority: 1, updatedAt: -1 },
  { name: 'IX_disputes_admin_status_priority_updated' },
);
