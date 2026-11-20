import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RepairInvoiceDocument = HydratedDocument<RepairInvoice>;

@Schema({ _id: false })
export class RepairInvoiceLineItem {
  @Prop({ required: true, trim: true })
  description!: string;

  @Prop({ required: true, min: 0 })
  quantity!: number;

  @Prop({ required: true, min: 0 })
  unitPrice!: number;

  @Prop({ required: true, min: 0 })
  amount!: number;
}

export const RepairInvoiceLineItemSchema = SchemaFactory.createForClass(
  RepairInvoiceLineItem,
);

@Schema({ _id: false })
export class RepairInvoiceTaxDetail {
  @Prop({ required: true, enum: ['CGST', 'SGST', 'IGST'] })
  type!: 'CGST' | 'SGST' | 'IGST';

  @Prop({ required: true, min: 0 })
  rate!: number;

  @Prop({ required: true, min: 0 })
  amount!: number;
}

export const RepairInvoiceTaxDetailSchema = SchemaFactory.createForClass(
  RepairInvoiceTaxDetail,
);

@Schema({ _id: false })
export class RepairInvoicePartySnapshot {
  @Prop({ required: true })
  name!: string;

  @Prop({ type: String, default: null })
  ownerName!: string | null;

  @Prop({ type: String, default: null })
  address!: string | null;

  @Prop({ type: String, default: null })
  phone!: string | null;

  @Prop({ type: String, default: null })
  email!: string | null;

  @Prop({ type: String, default: null })
  logoData!: string | null;

  @Prop({ type: String, default: null })
  gstin!: string | null;
}

export const RepairInvoicePartySnapshotSchema = SchemaFactory.createForClass(
  RepairInvoicePartySnapshot,
);

@Schema({ _id: false })
export class RepairInvoiceRepairSnapshot {
  @Prop({ required: true })
  category!: string;

  @Prop({ required: true })
  productName!: string;

  @Prop({ type: String, default: null })
  brand!: string | null;

  @Prop({ type: String, default: null })
  model!: string | null;

  @Prop({ required: true })
  problemDescription!: string;

  @Prop({ type: Date, default: null })
  completedAt!: Date | null;

  @Prop({ type: String, default: null })
  serviceType!: string | null;
}

export const RepairInvoiceRepairSnapshotSchema = SchemaFactory.createForClass(
  RepairInvoiceRepairSnapshot,
);

@Schema()
export class RepairInvoicePayment {
  _id!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ required: true, uppercase: true })
  currency!: string;

  @Prop({ required: true, enum: ['cash', 'upi', 'bank_transfer', 'stripe'] })
  method!: 'cash' | 'upi' | 'bank_transfer' | 'stripe';

  @Prop({
    required: true,
    enum: ['pending', 'succeeded', 'failed', 'cancelled'],
    default: 'succeeded',
  })
  status!: 'pending' | 'succeeded' | 'failed' | 'cancelled';

  @Prop({ type: String, default: null, trim: true, maxlength: 120 })
  reference!: string | null;

  @Prop({ type: Date, required: true })
  paymentDate!: Date;

  @Prop({ type: Date, required: true, default: Date.now })
  recordedAt!: Date;

  @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
  recordedBy!: Types.ObjectId;

  @Prop({ required: true })
  recordedByName!: string;

  @Prop({ type: String, default: null })
  stripeAttemptId!: string | null;

  @Prop({ type: String, default: null })
  stripeCheckoutSessionId!: string | null;

  @Prop({ type: String, default: null })
  stripePaymentIntentId!: string | null;

  @Prop({ type: String, default: null })
  stripeEventId!: string | null;

  @Prop({ type: String, default: null })
  checkoutUrl!: string | null;

  @Prop({ type: Date, default: null })
  checkoutExpiresAt!: Date | null;
}

export const RepairInvoicePaymentSchema =
  SchemaFactory.createForClass(RepairInvoicePayment);

@Schema({
  timestamps: true,
  collection: 'repair_invoices',
  optimisticConcurrency: true,
})
export class RepairInvoice {
  @Prop({ type: String, default: null })
  invoiceNumber!: string | null;

  @Prop({ type: Types.ObjectId, required: true, ref: 'RepairRequest' })
  repairRequestId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, ref: 'User', index: true })
  shopId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, ref: 'User', index: true })
  customerId!: Types.ObjectId;

  @Prop({ type: Date, default: null })
  invoiceDate!: Date | null;

  @Prop({ type: Date, default: null })
  dueDate!: Date | null;

  @Prop({
    required: true,
    enum: ['draft', 'issued', 'cancelled'],
    default: 'draft',
    index: true,
  })
  invoiceStatus!: 'draft' | 'issued' | 'cancelled';

  @Prop({
    required: true,
    enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID'],
    default: 'UNPAID',
    index: true,
  })
  paymentStatus!: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

  @Prop({ required: true, uppercase: true })
  currency!: string;

  @Prop({ type: [RepairInvoiceLineItemSchema], default: [] })
  items!: RepairInvoiceLineItem[];

  @Prop({ required: true, min: 0 })
  subtotal!: number;

  @Prop({ required: true, min: 0, default: 0 })
  discount!: number;

  @Prop({ required: true, min: 0 })
  taxableAmount!: number;

  @Prop({ type: [RepairInvoiceTaxDetailSchema], default: [] })
  taxDetails!: RepairInvoiceTaxDetail[];

  @Prop({ required: true, min: 0 })
  grandTotal!: number;

  @Prop({ required: true, min: 0, default: 0 })
  amountPaid!: number;

  @Prop({ required: true, min: 0 })
  balanceDue!: number;

  @Prop({ type: RepairInvoicePartySnapshotSchema, required: true })
  shop!: RepairInvoicePartySnapshot;

  @Prop({ type: RepairInvoicePartySnapshotSchema, required: true })
  customer!: RepairInvoicePartySnapshot;

  @Prop({ type: RepairInvoiceRepairSnapshotSchema, required: true })
  repair!: RepairInvoiceRepairSnapshot;

  @Prop({ type: [Types.ObjectId], default: [] })
  pdfFileIds!: Types.ObjectId[];

  @Prop({ type: [RepairInvoicePaymentSchema], default: [] })
  payments!: RepairInvoicePayment[];

  @Prop({ type: Date, default: null })
  cancelledAt!: Date | null;

  @Prop({ type: Types.ObjectId, default: null, ref: 'User' })
  cancelledBy!: Types.ObjectId | null;

  @Prop({ type: Boolean, default: false })
  issuing!: boolean;

  @Prop({ type: Date, default: null })
  issueStartedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export const RepairInvoiceSchema = SchemaFactory.createForClass(RepairInvoice);
RepairInvoiceSchema.index({ repairRequestId: 1 }, { unique: true });
RepairInvoiceSchema.index(
  { invoiceNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { invoiceNumber: { $type: 'string' } },
  },
);
RepairInvoiceSchema.index({ shopId: 1, invoiceDate: -1 });
RepairInvoiceSchema.index({ customerId: 1, invoiceDate: -1 });

@Schema({ collection: 'repair_invoice_sequences', versionKey: false })
export class RepairInvoiceSequence {
  @Prop({ required: true, unique: true })
  year!: number;

  @Prop({ required: true, min: 0, default: 0 })
  sequence!: number;
}

export const RepairInvoiceSequenceSchema = SchemaFactory.createForClass(
  RepairInvoiceSequence,
);
