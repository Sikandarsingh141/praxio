import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  DISPUTE_ATTACHMENT_TYPES,
  DISPUTE_CATEGORIES,
  DISPUTE_PRIORITIES,
  DISPUTE_STATUSES,
  DISPUTE_WORKFLOW_STATUSES,
} from '../schemas/dispute.schema';

export class DisputeAttachmentDto {
  @IsIn(DISPUTE_ATTACHMENT_TYPES)
  mimeType!: (typeof DISPUTE_ATTACHMENT_TYPES)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(700_000)
  data!: string;
}

export class CreateDisputeDto {
  @IsIn(DISPUTE_CATEGORIES)
  category!: (typeof DISPUTE_CATEGORIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(180)
  subject?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  expectedResolution?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  @Type(() => Number)
  amountInDispute?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => DisputeAttachmentDto)
  attachments?: DisputeAttachmentDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customerComments?: string;
}

export class DisputeMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => DisputeAttachmentDto)
  attachments?: DisputeAttachmentDto[];
}

export class ShopDisputeResponseDto extends DisputeMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  explanation!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  proposedResolution?: string;
}

export class AdminDisputeStatusDto {
  @IsIn(DISPUTE_WORKFLOW_STATUSES)
  status!: (typeof DISPUTE_WORKFLOW_STATUSES)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsIn(DISPUTE_PRIORITIES)
  priority?: (typeof DISPUTE_PRIORITIES)[number];
}

export class ProposeDisputeResolutionDto {
  @IsIn([
    'repair_again',
    'partial_refund',
    'full_refund',
    'additional_repair',
    'price_adjustment',
    'customer_compensation',
    'shop_compensation',
    'no_action',
    'other',
  ])
  type!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  description!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  @Type(() => Number)
  amount?: number;

  @IsIn(['customer', 'shop', 'both', 'not_applicable'])
  responsibleParty!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  notes!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => DisputeAttachmentDto)
  documents?: DisputeAttachmentDto[];
}

export class DisputeDecisionDto {
  @IsIn(['accept', 'reject'])
  decision!: 'accept' | 'reject';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class ResolveDisputeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  completionNotes!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  refundTransactionId?: string;

  @IsOptional()
  @IsBoolean()
  requiredActionCompleted?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => DisputeAttachmentDto)
  documents?: DisputeAttachmentDto[];
}

export class ShopRejectDisputeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  explanation!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => DisputeAttachmentDto)
  attachments?: DisputeAttachmentDto[];
}

export class DisputeReinspectionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  findings!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  identifiedProblem?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  requiredRepairWork!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  partsRequired?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  @Type(() => Number)
  labourCharges?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  @Type(() => Number)
  otherCharges?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  estimatedCompletionTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => DisputeAttachmentDto)
  attachments?: DisputeAttachmentDto[];
}

export class DisputeChargeLineDto {
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  description!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  @Type(() => Number)
  amount!: number;
}

export class DisputeAdditionalChargeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => DisputeChargeLineDto)
  items!: DisputeChargeLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

export class DisputeChargeDecisionDto {
  @IsIn(['accept', 'decline'])
  decision!: 'accept' | 'decline';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class DisputeProgressDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  notes!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => DisputeAttachmentDto)
  attachments?: DisputeAttachmentDto[];
}

export class CompleteDisputeReworkDto {
  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  workPerformed!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  partsReplaced?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  testingResults!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  finalNotes?: string;

  @IsBoolean()
  tested!: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => DisputeAttachmentDto)
  attachments?: DisputeAttachmentDto[];
}

export class ReportUnresolvedDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  notes!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => DisputeAttachmentDto)
  attachments?: DisputeAttachmentDto[];
}

export class CloseDisputeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}

export class ReopenDisputeDto extends CloseDisputeDto {}

export class InternalDisputeNoteDto extends DisputeMessageDto {}

export class DisputeListQueryDto {
  @IsOptional()
  @IsIn(DISPUTE_STATUSES)
  status?: (typeof DISPUTE_STATUSES)[number];

  @IsOptional()
  @IsIn(DISPUTE_CATEGORIES)
  category?: (typeof DISPUTE_CATEGORIES)[number];

  @IsOptional()
  @IsIn(DISPUTE_PRIORITIES)
  priority?: (typeof DISPUTE_PRIORITIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(150)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  from?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  to?: string;

  @IsOptional()
  @IsIn(['newest', 'oldest', 'priority'])
  sort?: 'newest' | 'oldest' | 'priority';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit = 10;
}
