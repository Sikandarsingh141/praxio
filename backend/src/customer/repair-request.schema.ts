import { HydratedDocument, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ _id: false })
export class RepairRequestPhoto {
  @Prop({ type: String, required: true })
  mimeType!: string;

  @Prop({ type: String, required: true })
  data!: string;
}

export const RepairRequestPhotoSchema =
  SchemaFactory.createForClass(RepairRequestPhoto);

@Schema({ _id: false })
export class RepairRequestShopResponse {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  shopId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: [
      'new',
      'pending',
      'quotation_submitted',
      'customer_accepted',
      'customer_rejected',
      'declined',
      'expired',
    ],
    default: 'new',
  })
  status!:
    | 'new'
    | 'pending'
    | 'quotation_submitted'
    | 'customer_accepted'
    | 'customer_rejected'
    | 'declined'
    | 'expired';

  @Prop({ type: String, trim: true, maxlength: 500 })
  declineReason?: string;

  @Prop({ type: Date })
  respondedAt?: Date;

  @Prop({ type: Date })
  responseDeadline?: Date;
}

export const RepairRequestShopResponseSchema = SchemaFactory.createForClass(
  RepairRequestShopResponse,
);

export const REPAIR_JOB_STATUSES = [
  'confirmed',
  'inspection_pending',
  'inspection_in_progress',
  'awaiting_customer_approval',
  'inspection_approved',
  'repair_declined',
  'in_progress',
  'on_hold',
  'repair_completed',
  'ready_for_pickup',
  'picked_up',
  'completed',
  'disputed',
] as const;

@Schema({ _id: false })
export class RepairEstimatePart {
  @Prop({ type: String, required: true, trim: true, maxlength: 120 })
  name!: string;

  @Prop({ type: Number, required: true, min: 1, max: 1000 })
  quantity!: number;

  @Prop({ type: Number, required: true, min: 0 })
  unitPrice!: number;

  @Prop({ type: Number, required: true, min: 0 })
  total!: number;
}

export const RepairEstimatePartSchema =
  SchemaFactory.createForClass(RepairEstimatePart);

@Schema({ _id: false })
export class RepairInspectionReport {
  @Prop({
    type: String,
    enum: ['in_progress', 'draft', 'awaiting_approval', 'approved', 'declined'],
    default: 'in_progress',
  })
  status!:
    'in_progress' | 'draft' | 'awaiting_approval' | 'approved' | 'declined';

  @Prop({ type: String, trim: true, maxlength: 2000 })
  identifiedProblem?: string;

  @Prop({ type: String, trim: true, maxlength: 2000 })
  findings?: string;

  @Prop({ type: String, trim: true, maxlength: 2000 })
  requiredRepairWork?: string;

  @Prop({ type: [RepairEstimatePartSchema], default: [] })
  parts!: RepairEstimatePart[];

  @Prop({ type: Number, min: 0, default: 0 })
  partsTotal!: number;

  @Prop({ type: Number, min: 0, default: 0 })
  labourCharge!: number;

  @Prop({ type: Number, min: 0, default: 0 })
  inspectionCharges!: number;

  @Prop({ type: Number, min: 0, default: 0 })
  otherCharges!: number;

  @Prop({ type: Number, min: 0, default: 0 })
  estimatedTotal!: number;

  @Prop({ type: Number, min: 0 })
  estimatedTimeValue?: number;

  @Prop({ type: String, enum: ['hours', 'days'] })
  estimatedTimeUnit?: 'hours' | 'days';

  @Prop({ type: String, trim: true, maxlength: 1000 })
  warranty?: string;

  @Prop({ type: [RepairRequestPhotoSchema], default: [] })
  images!: RepairRequestPhoto[];

  @Prop({ type: String, trim: true, maxlength: 2000 })
  message?: string;

  @Prop({ type: String, trim: true, maxlength: 500 })
  decisionReason?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  submittedBy?: Types.ObjectId;

  @Prop({ type: Date })
  submittedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  decidedBy?: Types.ObjectId;

  @Prop({ type: Date })
  decidedAt?: Date;
}

export const RepairInspectionReportSchema = SchemaFactory.createForClass(
  RepairInspectionReport,
);

@Schema()
export class AdditionalChargeRequest {
  _id!: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['draft', 'pending', 'accepted', 'rejected'],
    required: true,
  })
  status!: 'draft' | 'pending' | 'accepted' | 'rejected';

  @Prop({ type: String, trim: true, maxlength: 2000 })
  issue?: string;

  @Prop({ type: String, trim: true, maxlength: 2000 })
  reason?: string;

  @Prop({ type: String, trim: true, maxlength: 2000 })
  repairDescription?: string;

  @Prop({ type: [RepairEstimatePartSchema], default: [] })
  parts!: RepairEstimatePart[];

  @Prop({ type: Number, min: 0, default: 0 })
  partsTotal!: number;

  @Prop({ type: Number, min: 0, default: 0 })
  labourCharge!: number;

  @Prop({ type: Number, min: 0, default: 0 })
  otherCharges!: number;

  @Prop({ type: Number, min: 0, required: true })
  amount!: number;

  @Prop({ type: Boolean, default: false })
  blocksRepair!: boolean;

  @Prop({ type: Number, min: 0 })
  estimatedTimeValue?: number;

  @Prop({ type: String, enum: ['hours', 'days'] })
  estimatedTimeUnit?: 'hours' | 'days';

  @Prop({ type: [RepairRequestPhotoSchema], default: [] })
  images!: RepairRequestPhoto[];

  @Prop({ type: String, trim: true, maxlength: 2000 })
  message?: string;

  @Prop({ type: String, trim: true, maxlength: 500 })
  decisionReason?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  shopId!: Types.ObjectId;

  @Prop({ type: Date, required: true, default: Date.now })
  requestedAt!: Date;

  @Prop({ type: Date })
  decidedAt?: Date;
}

export const AdditionalChargeRequestSchema = SchemaFactory.createForClass(
  AdditionalChargeRequest,
);

@Schema({ _id: false })
export class RepairJobEvent {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actorId!: Types.ObjectId;

  @Prop({ type: String, required: true, maxlength: 100 })
  action!: string;

  @Prop({ type: String, trim: true, maxlength: 1000 })
  notes?: string;

  @Prop({ type: Date, required: true, default: Date.now })
  at!: Date;
}

export const RepairJobEventSchema =
  SchemaFactory.createForClass(RepairJobEvent);

@Schema({ _id: false })
export class RepairCustomerVerification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  customerId!: Types.ObjectId;

  @Prop({ type: Boolean, required: true })
  received!: boolean;

  @Prop({ type: Boolean, required: true })
  inspected!: boolean;

  @Prop({
    type: String,
    enum: [
      'very_satisfied',
      'satisfied',
      'neutral',
      'dissatisfied',
      'very_dissatisfied',
    ],
  })
  satisfaction?: string;

  @Prop({ type: String, trim: true, maxlength: 1000 })
  comments?: string;

  @Prop({ type: Date, required: true })
  confirmedAt!: Date;
}

export const RepairCustomerVerificationSchema = SchemaFactory.createForClass(
  RepairCustomerVerification,
);

@Schema({ _id: false })
export class RepairJob {
  @Prop({
    type: String,
    enum: REPAIR_JOB_STATUSES,
    default: 'inspection_pending',
  })
  status!: (typeof REPAIR_JOB_STATUSES)[number];

  @Prop({ type: Types.ObjectId, ref: 'RepairQuotation', required: true })
  acceptedQuotationId!: Types.ObjectId;

  @Prop({ type: Date, required: true, default: Date.now })
  confirmedAt!: Date;

  @Prop({ type: RepairInspectionReportSchema })
  inspection?: RepairInspectionReport;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  inspectionStartedBy?: Types.ObjectId;

  @Prop({ type: Date })
  inspectionStartedAt?: Date;

  @Prop({ type: Number, min: 0 })
  approvedRepairAmount?: number;

  @Prop({ type: Number, min: 0, default: 0 })
  approvedAdditionalCharges!: number;

  @Prop({ type: [AdditionalChargeRequestSchema], default: [] })
  additionalChargeRequests!: AdditionalChargeRequest[];

  @Prop({ type: Types.ObjectId, ref: 'User' })
  repairStartedBy?: Types.ObjectId;

  @Prop({ type: Date })
  startedAt?: Date;

  @Prop({ type: Date })
  repairCompletedAt?: Date;

  @Prop({ type: String, trim: true, maxlength: 2000 })
  completionDescription?: string;

  @Prop({ type: String, trim: true, maxlength: 2000 })
  workPerformed?: string;

  @Prop({ type: String, trim: true, maxlength: 1000 })
  partsReplaced?: string;

  @Prop({ type: String, trim: true, maxlength: 2000 })
  finalNotes?: string;

  @Prop({ type: String, trim: true, maxlength: 1000 })
  pickupInstructions?: string;

  @Prop({ type: String, trim: true, maxlength: 500 })
  pickupMessage?: string;

  @Prop({ type: Date })
  readyForPickupAt?: Date;

  @Prop({ type: Date })
  pickedUpAt?: Date;

  @Prop({ type: RepairCustomerVerificationSchema })
  customerVerification?: RepairCustomerVerification;

  @Prop({ type: String, trim: true, maxlength: 1000 })
  disputeDescription?: string;

  @Prop({ type: String, trim: true, maxlength: 1000 })
  disputeResolution?: string;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'RepairReview' })
  reviewId?: Types.ObjectId;

  @Prop({ type: [RepairJobEventSchema], default: [] })
  history!: RepairJobEvent[];
}

export const RepairJobSchema = SchemaFactory.createForClass(RepairJob);

@Schema({ collection: 'repair_requests', timestamps: true, versionKey: false })
export class RepairRequest {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customerId!: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'User', required: true })
  shopIds!: Types.ObjectId[];

  @Prop({ type: String, required: true, trim: true, maxlength: 100 })
  appliance!: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 2000 })
  description!: string;

  @Prop({ type: String, trim: true, maxlength: 100 })
  brand?: string;

  @Prop({ type: String, trim: true, maxlength: 100 })
  model?: string;

  @Prop({ type: Date })
  preferredServiceDate?: Date;

  @Prop({ type: String, enum: ['shop_visit', 'home_service'] })
  serviceType?: 'shop_visit' | 'home_service';

  @Prop({ type: Number, min: -90, max: 90 })
  customerLatitude?: number;

  @Prop({ type: Number, min: -180, max: 180 })
  customerLongitude?: number;

  @Prop({ type: [RepairRequestPhotoSchema], default: [] })
  photos!: RepairRequestPhoto[];

  @Prop({ type: [RepairRequestShopResponseSchema], default: [] })
  shopResponses!: RepairRequestShopResponse[];

  @Prop({ type: Types.ObjectId, ref: 'RepairQuotation' })
  acceptedQuotationId?: Types.ObjectId;

  @Prop({ type: RepairJobSchema })
  repairJob?: RepairJob;

  @Prop({
    type: String,
    enum: ['open', 'cancelled', 'completed'],
    default: 'open',
  })
  status!: 'open' | 'cancelled' | 'completed';

  createdAt!: Date;
  updatedAt!: Date;
}

export type RepairRequestDocument = HydratedDocument<RepairRequest>;
export const RepairRequestSchema = SchemaFactory.createForClass(RepairRequest);

RepairRequestSchema.index({ customerId: 1, createdAt: -1 });
RepairRequestSchema.index({ shopIds: 1, createdAt: -1 });
RepairRequestSchema.index(
  { createdAt: -1 },
  { name: 'IX_repair_requests_created' },
);

@Schema({
  collection: 'repair_quotations',
  timestamps: true,
  versionKey: false,
})
export class RepairQuotation {
  @Prop({
    type: Types.ObjectId,
    ref: RepairRequest.name,
    required: true,
    index: true,
  })
  repairRequestId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  shopId!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  amount!: number;

  @Prop({ type: String, required: true, trim: true, maxlength: 3 })
  currency!: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 1000 })
  message!: string;

  @Prop({ type: Number, min: 0 })
  inspectionCharge?: number;

  @Prop({ type: Number, min: 0 })
  partsCost?: number;

  @Prop({ type: Number, min: 0 })
  labourCharge?: number;

  @Prop({ type: Number, min: 0 })
  additionalCharges?: number;

  @Prop({ type: String, trim: true, maxlength: 2000 })
  proposedSolution?: string;

  @Prop({ type: String, trim: true, maxlength: 500 })
  warrantyInformation?: string;

  @Prop({ type: String, trim: true, maxlength: 1000 })
  additionalNotes?: string;

  @Prop({ type: Number, min: 0, max: 365 })
  estimatedDays?: number;

  @Prop({ type: Date })
  validUntil?: Date;

  @Prop({
    type: String,
    enum: [
      'pending',
      'sent',
      'accepted',
      'rejected',
      'declined',
      'expired',
      'withdrawn',
    ],
    default: 'pending',
  })
  status!:
    | 'pending'
    | 'sent'
    | 'accepted'
    | 'rejected'
    | 'declined'
    | 'expired'
    | 'withdrawn';

  @Prop({ type: String, trim: true, maxlength: 500 })
  rejectionReason?: string;

  @Prop({ type: Date })
  respondedAt?: Date;

  @Prop({ type: Date })
  reviewedAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export type RepairQuotationDocument = HydratedDocument<RepairQuotation>;
export const RepairQuotationSchema =
  SchemaFactory.createForClass(RepairQuotation);

RepairQuotationSchema.index(
  { repairRequestId: 1, shopId: 1 },
  { unique: true, name: 'UQ_quotation_per_request_shop' },
);
RepairQuotationSchema.index(
  { createdAt: -1 },
  { name: 'IX_repair_quotations_created' },
);

@Schema({ collection: 'repair_reviews', timestamps: true, versionKey: false })
export class RepairReview {
  @Prop({
    type: Types.ObjectId,
    ref: 'RepairRequest',
    required: true,
    unique: true,
  })
  repairRequestId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customerId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  shopId!: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  overallRating!: number;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  repairQuality!: number;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  communication!: number;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  professionalism!: number;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  timeliness!: number;

  @Prop({ type: Number, required: true, min: 1, max: 5 })
  valueForMoney!: number;

  @Prop({ type: String, trim: true, maxlength: 120 })
  title?: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 2000 })
  reviewText!: string;

  @Prop({ type: String, trim: true, maxlength: 1000 })
  liked?: string;

  @Prop({ type: String, trim: true, maxlength: 1000 })
  improvement?: string;

  @Prop({ type: Boolean, required: true })
  wouldRecommend!: boolean;

  @Prop({ type: Date, required: true })
  verifiedAt!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export type RepairReviewDocument = HydratedDocument<RepairReview>;
export const RepairReviewSchema = SchemaFactory.createForClass(RepairReview);
RepairReviewSchema.index(
  { repairRequestId: 1 },
  { unique: true, name: 'UQ_repair_review_request' },
);
RepairReviewSchema.index(
  { shopId: 1, createdAt: -1 },
  { name: 'IX_repair_reviews_shop_created' },
);
