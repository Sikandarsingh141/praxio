import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

function parseJsonArrayField(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed;
  } catch {
    return value;
  }
}

export class ShopSearchDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  query?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  service?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  @Type(() => Number)
  maxDistanceKm?: number;

  @IsOptional()
  @IsIn(['nearest', 'relevant'])
  sort?: 'nearest' | 'relevant';
}

export class GeocodeQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  q!: string;
}

export class CreateRepairRequestDto {
  @Transform(({ value }) => parseJsonArrayField(value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsMongoId({ each: true })
  shopIds!: string[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  appliance!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @IsOptional()
  @IsDateString()
  preferredServiceDate?: string;

  @IsOptional()
  @IsIn(['shop_visit', 'home_service'])
  serviceType?: 'shop_visit' | 'home_service';

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  customerLatitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  customerLongitude?: number;
}

export class UpdateRepairRequestDto extends CreateRepairRequestDto {
  @Transform(({ value }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  removeExistingPhotos!: boolean;
}

export class CreateQuotationDto {
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  currency!: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @MaxLength(1000)
  message!: string;

  @IsNumber()
  @IsInt()
  @Min(1)
  @Max(365)
  @Type(() => Number)
  estimatedDays!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  inspectionCharge?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  partsCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  labourCharge?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  additionalCharges?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  proposedSolution?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  warrantyInformation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  additionalNotes?: string;

  @IsDateString()
  validUntil!: string;
}

export class RepairRequestListQueryDto {
  @IsOptional()
  @IsIn(['all', 'new', 'pending', 'accepted', 'declined', 'expired'])
  status?: 'all' | 'new' | 'pending' | 'accepted' | 'declined' | 'expired';

  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  appliance?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(['newest', 'oldest'])
  sort?: 'newest' | 'oldest';

  @IsOptional()
  @IsIn([
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
  ])
  repairStatus?:
    | 'confirmed'
    | 'inspection_pending'
    | 'inspection_in_progress'
    | 'awaiting_customer_approval'
    | 'inspection_approved'
    | 'repair_declined'
    | 'in_progress'
    | 'on_hold'
    | 'repair_completed'
    | 'ready_for_pickup'
    | 'picked_up'
    | 'completed';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit = 10;
}

export class CustomerRepairRequestListQueryDto {
  @IsOptional()
  @IsIn(['open', 'cancelled', 'completed'])
  status?: 'open' | 'cancelled' | 'completed';

  @IsOptional()
  @IsIn([
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
  ])
  repairStatus?:
    | 'confirmed'
    | 'inspection_pending'
    | 'inspection_in_progress'
    | 'awaiting_customer_approval'
    | 'inspection_approved'
    | 'repair_declined'
    | 'in_progress'
    | 'on_hold'
    | 'repair_completed'
    | 'ready_for_pickup'
    | 'picked_up'
    | 'completed';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  appliance?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class QuotationListQueryDto {
  @IsOptional()
  @IsMongoId()
  quotationId?: string;

  @IsOptional()
  @IsIn(['all', 'pending', 'accepted', 'rejected', 'expired', 'withdrawn'])
  status?:
    'all' | 'pending' | 'accepted' | 'rejected' | 'expired' | 'withdrawn';

  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  appliance?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  shop?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  customer?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxAmount?: number;

  @IsOptional()
  @IsIn(['valid', 'expired'])
  validity?: 'valid' | 'expired';

  @IsOptional()
  @IsIn(['newest', 'oldest', 'amount_low', 'amount_high'])
  sort?: 'newest' | 'oldest' | 'amount_low' | 'amount_high';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit = 10;
}

export class ShopDashboardQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class DeclineRepairRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class UpdateQuotationStatusDto {
  @IsIn(['accepted', 'declined'])
  status!: 'accepted' | 'declined';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}

export class RepairProgressDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CompleteRepairDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  completionDescription!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  workPerformed!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  partsReplaced?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  finalNotes?: string;
}

export class ReadyForPickupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  pickupInstructions!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

export class CustomerPickupVerificationDto {
  @IsBoolean()
  received!: boolean;

  @IsBoolean()
  inspected!: boolean;

  @IsOptional()
  @IsIn([
    'very_satisfied',
    'satisfied',
    'neutral',
    'dissatisfied',
    'very_dissatisfied',
  ])
  satisfaction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comments?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  issueDescription?: string;
}

export class ReportRepairIssueDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description!: string;
}

export class CreateRepairReviewDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  overallRating!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  repairQuality!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  communication!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  professionalism!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  timeliness!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  valueForMoney!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reviewText!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  liked?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  improvement?: string;

  @IsBoolean()
  wouldRecommend!: boolean;
}
