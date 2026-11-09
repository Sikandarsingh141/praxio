import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsArray,
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

export class RepairEstimatePartDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  quantity!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;
}

export class RepairWorkflowImageDto {
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  mimeType!: 'image/jpeg' | 'image/png' | 'image/webp';

  @IsString()
  @MaxLength(3_000_000)
  data!: string;
}

export class InspectionReportDto {
  @IsIn(['draft', 'submit'])
  action!: 'draft' | 'submit';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  identifiedProblem?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  findings?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  requiredRepairWork?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => RepairEstimatePartDto)
  parts?: RepairEstimatePartDto[];

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  labourCharge?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  inspectionCharges?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  otherCharges?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedTimeValue?: number;

  @IsOptional()
  @IsIn(['hours', 'days'])
  estimatedTimeUnit?: 'hours' | 'days';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  warranty?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => RepairWorkflowImageDto)
  images?: RepairWorkflowImageDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

export class AdditionalChargeRequestDto {
  @IsIn(['draft', 'submit'])
  action!: 'draft' | 'submit';

  @IsOptional()
  @IsBoolean()
  blocksRepair?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  draftId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  issue?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  repairDescription?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => RepairEstimatePartDto)
  parts?: RepairEstimatePartDto[];

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  labourCharge?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  otherCharges?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedTimeValue?: number;

  @IsOptional()
  @IsIn(['hours', 'days'])
  estimatedTimeUnit?: 'hours' | 'days';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => RepairWorkflowImageDto)
  images?: RepairWorkflowImageDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

export class CustomerRepairDecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
