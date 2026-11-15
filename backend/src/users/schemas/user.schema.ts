import { HydratedDocument, Types } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export const ACCOUNT_TYPES = [
  'customer',
  'shop',
  'admin',
  'technician',
] as const;
export const ACCOUNT_STATUSES = [
  'active',
  'pending_approval',
  'rejected',
] as const;
export const ACCOUNT_LIFECYCLE_STATUSES = [
  'active',
  'inactive',
  'suspended',
] as const;

@Schema({ _id: false })
export class LocationCoordinates {
  @Prop({ type: Number, required: true, min: -90, max: 90 })
  latitude!: number;

  @Prop({ type: Number, required: true, min: -180, max: 180 })
  longitude!: number;
}

export const LocationCoordinatesSchema =
  SchemaFactory.createForClass(LocationCoordinates);

@Schema({ _id: false })
export class TechnicianProfileActivity {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actorId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['created', 'updated', 'activated', 'deactivated'],
    required: true,
  })
  action!: 'created' | 'updated' | 'activated' | 'deactivated';

  @Prop({ type: Date, required: true, default: Date.now })
  at!: Date;
}

export const TechnicianProfileActivitySchema = SchemaFactory.createForClass(
  TechnicianProfileActivity,
);

@Schema({ _id: false })
export class TechnicianDetails {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  shopId!: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    maxlength: 30,
  })
  employeeId!: string;

  @Prop({ type: [String], required: true, default: [] })
  skills!: string[];

  @Prop({ type: String, required: true, trim: true, maxlength: 120 })
  specialization!: string;

  @Prop({ type: Number, required: true, min: 0, max: 80 })
  experienceYears!: number;

  @Prop({
    type: String,
    enum: ['full_time', 'part_time', 'contract'],
    required: true,
  })
  employmentType!: 'full_time' | 'part_time' | 'contract';

  @Prop({ type: Date, required: true })
  joiningDate!: Date;

  @Prop({ type: String, enum: ['available', 'on_leave'], default: 'available' })
  availabilityPreference!: 'available' | 'on_leave';

  @Prop({ type: [TechnicianProfileActivitySchema], default: [] })
  activityHistory!: TechnicianProfileActivity[];
}

export const TechnicianDetailsSchema =
  SchemaFactory.createForClass(TechnicianDetails);

@Schema({ _id: false })
export class ShopDetails {
  @Prop({ type: String, required: true, trim: true, maxlength: 120 })
  shopName!: string;

  @Prop({ type: String, maxlength: 1400000 })
  shopImageData?: string;

  @Prop({ type: String, required: true, trim: true })
  businessType!: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 1000 })
  description!: string;

  @Prop({ type: Number, required: true, min: 0, max: 100 })
  yearsOfExperience!: number;

  @Prop({ type: String, required: true, trim: true, maxlength: 200 })
  address!: string;

  @Prop({ type: String, trim: true, maxlength: 200 })
  street?: string;

  @Prop({ type: String, trim: true, maxlength: 100 })
  area?: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 100 })
  city!: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 100 })
  state!: string;

  @Prop({ type: String, trim: true, maxlength: 100 })
  country?: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 12 })
  postalCode!: string;

  @Prop({ type: String, trim: true, maxlength: 150, default: '' })
  landmark!: string;

  @Prop({ type: [String], required: true })
  services!: string[];

  @Prop({ type: LocationCoordinatesSchema })
  location?: LocationCoordinates;
}

export const ShopDetailsSchema = SchemaFactory.createForClass(ShopDetails);

@Schema({ collection: 'users', timestamps: true, versionKey: false })
export class User {
  @Prop({ type: String, trim: true, maxlength: 50 })
  firstName?: string;

  @Prop({ type: String, trim: true, maxlength: 50 })
  lastName?: string;

  // Retained for reading accounts created before names were stored separately.
  @Prop({ type: String, trim: true, maxlength: 100 })
  fullName?: string;

  @Prop({ type: String, maxlength: 1400000 })
  profileImageData?: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 254,
  })
  email!: string;

  @Prop({ type: String, required: true, select: false, maxlength: 60 })
  passwordHash!: string;

  @Prop({
    type: String,
    enum: ACCOUNT_TYPES,
    default: 'customer',
    required: true,
  })
  accountType!: (typeof ACCOUNT_TYPES)[number];

  @Prop({
    type: String,
    enum: ACCOUNT_STATUSES,
    default: 'active',
    required: true,
  })
  accountStatus!: (typeof ACCOUNT_STATUSES)[number];

  @Prop({
    type: String,
    enum: ACCOUNT_LIFECYCLE_STATUSES,
    default: 'active',
    required: true,
  })
  accountLifecycleStatus!: (typeof ACCOUNT_LIFECYCLE_STATUSES)[number];

  @Prop({ type: String, trim: true, match: /^\+\d{1,4}$/ })
  countryCode?: string;

  @Prop({ type: String, trim: true, match: /^\d{10}$/ })
  mobileNumber?: string;

  @Prop({ type: LocationCoordinatesSchema })
  location?: LocationCoordinates;

  @Prop({ type: ShopDetailsSchema })
  shopDetails?: ShopDetails;

  @Prop({ type: TechnicianDetailsSchema })
  technicianDetails?: TechnicianDetails;

  @Prop({ type: [String], default: [], select: false })
  notificationTokens!: string[];

  createdAt!: Date;
  updatedAt!: Date;
}

export type UserDocument = HydratedDocument<User>;

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ email: 1 }, { unique: true, name: 'UQ_users_email' });
UserSchema.index(
  { countryCode: 1, mobileNumber: 1 },
  { unique: true, sparse: true, name: 'UQ_users_mobile' },
);
UserSchema.index(
  { accountType: 1, createdAt: -1 },
  { name: 'IX_users_type_created' },
);
UserSchema.index(
  { 'technicianDetails.shopId': 1, 'technicianDetails.employeeId': 1 },
  {
    unique: true,
    name: 'UQ_technician_shop_employee',
    partialFilterExpression: { accountType: 'technician' },
  },
);
