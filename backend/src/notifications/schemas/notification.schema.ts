import { HydratedDocument, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export const NOTIFICATION_TYPES = [
  'new_registration',
  'registration_approved',
  'registration_declined',
  'new_repair_request',
  'repair_request_cancelled',
  'new_repair_quotation',
  'repair_request_declined',
  'customer_accepted_quotation',
  'customer_rejected_quotation',
  'quotation_expired',
  'account_activated',
  'account_deactivated',
  'account_suspended',
  'repair_started',
  'repair_marked_complete',
  'repair_ready_for_pickup',
  'repair_picked_up',
  'repair_disputed',
  'repair_review_received',
  'repair_job_completed',
  'repair_inspection_started',
  'repair_inspection_submitted',
  'repair_inspection_approved',
  'repair_inspection_declined',
  'additional_charges_requested',
  'additional_charges_approved',
  'additional_charges_declined',
  'new_dispute',
  'dispute_message',
  'dispute_shop_response',
  'dispute_resolution_proposed',
  'dispute_resolution_decision',
  'dispute_resolved',
  'dispute_closed',
  'dispute_reopened',
  'dispute_status_updated',
  'dispute_accepted',
  'dispute_rejected',
  'dispute_reinspection_started',
  'dispute_reinspection_submitted',
  'dispute_additional_charges_requested',
  'dispute_additional_charges_approved',
  'dispute_additional_charges_declined',
  'dispute_rework_started',
  'dispute_rework_progress',
  'dispute_rework_completed',
  'dispute_customer_confirmed',
  'dispute_issue_unresolved',
] as const;

export const NOTIFICATION_ENTITY_TYPES = [
  'registration_request',
  'repair_request',
  'repair_quotation',
  'repair_review',
  'user_account',
  'repair_dispute',
] as const;

@Schema({ collection: 'notifications', timestamps: true, versionKey: false })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  recipientId!: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true, maxlength: 120 })
  title!: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 1000 })
  message!: string;

  @Prop({ type: String, enum: NOTIFICATION_TYPES, required: true })
  type!: (typeof NOTIFICATION_TYPES)[number];

  @Prop({ type: Types.ObjectId, required: true })
  relatedEntityId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: NOTIFICATION_ENTITY_TYPES,
    required: true,
  })
  relatedEntityType!: (typeof NOTIFICATION_ENTITY_TYPES)[number];

  @Prop({ type: String, trim: true, maxlength: 300 })
  link?: string;

  @Prop({ type: Boolean, required: true, default: false })
  isRead!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}

export type NotificationDocument = HydratedDocument<Notification>;

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index(
  { recipientId: 1, isRead: 1, createdAt: -1 },
  { name: 'IX_notifications_recipient_read_created' },
);
