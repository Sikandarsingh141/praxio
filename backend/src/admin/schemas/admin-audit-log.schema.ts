import { HydratedDocument, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export const ADMIN_USER_ACTIONS = [
  'registration_approved',
  'registration_declined',
  'account_activated',
  'account_deactivated',
  'account_suspended',
] as const;

@Schema({ collection: 'admin_audit_logs', timestamps: true, versionKey: false })
export class AdminAuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  targetUserId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  adminUserId!: Types.ObjectId;

  @Prop({ type: String, enum: ADMIN_USER_ACTIONS, required: true })
  action!: (typeof ADMIN_USER_ACTIONS)[number];

  @Prop({ type: String, required: true })
  previousApprovalStatus!: string;

  @Prop({ type: String, required: true })
  newApprovalStatus!: string;

  @Prop({ type: String, required: true })
  previousAccountStatus!: string;

  @Prop({ type: String, required: true })
  newAccountStatus!: string;

  @Prop({ type: String, trim: true, maxlength: 500 })
  reason?: string;

  createdAt!: Date;
}

export type AdminAuditLogDocument = HydratedDocument<AdminAuditLog>;

export const AdminAuditLogSchema = SchemaFactory.createForClass(AdminAuditLog);
AdminAuditLogSchema.index(
  { targetUserId: 1, createdAt: -1 },
  { name: 'IX_admin_audit_target_created' },
);
