import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ArrayMaxSize,
  ArrayUnique,
  ArrayNotEmpty,
} from 'class-validator';

const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract'] as const;
const AVAILABILITY_PREFERENCES = ['available', 'on_leave'] as const;
const TECHNICIAN_STATUSES = ['active', 'inactive'] as const;

export class CreateTechnicianDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  firstName!: string;

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  lastName!: string;

  @ApiProperty({ maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: '+91' })
  @IsIn(['+91', '+1', '+44', '+61', '+971', '+92', '+880'])
  countryCode!: string;

  @ApiProperty({ example: '9876543210' })
  @IsString()
  @Matches(/^\d{10}$/)
  mobileNumber!: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
  password!: string;

  @ApiProperty({ maxLength: 30 })
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  employeeId!: string;

  @ApiProperty({ type: [String], maxItems: 20 })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  skills!: string[];

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  specialization!: string;

  @ApiProperty({ minimum: 0, maximum: 80 })
  @IsInt()
  @Min(0)
  @Max(80)
  experienceYears!: number;

  @ApiProperty({ enum: EMPLOYMENT_TYPES })
  @IsIn([...EMPLOYMENT_TYPES])
  employmentType!: (typeof EMPLOYMENT_TYPES)[number];

  @ApiProperty({ format: 'date' })
  @IsDateString()
  joiningDate!: string;

  @ApiProperty({ required: false, maxLength: 1_400_000 })
  @IsOptional()
  @IsString()
  @MaxLength(1_400_000)
  @Matches(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/)
  profileImageData?: string;

  @ApiProperty({ enum: TECHNICIAN_STATUSES, required: false })
  @IsOptional()
  @IsIn([...TECHNICIAN_STATUSES])
  status?: (typeof TECHNICIAN_STATUSES)[number];

  @ApiProperty({ enum: AVAILABILITY_PREFERENCES, required: false })
  @IsOptional()
  @IsIn([...AVAILABILITY_PREFERENCES])
  availabilityPreference?: (typeof AVAILABILITY_PREFERENCES)[number];
}

export class UpdateTechnicianDto extends PartialType(CreateTechnicianDto) {
  @IsOptional()
  declare password?: string;
}

export class UpdateTechnicianStatusDto {
  @ApiProperty({ enum: TECHNICIAN_STATUSES })
  @IsIn([...TECHNICIAN_STATUSES])
  status!: (typeof TECHNICIAN_STATUSES)[number];

  @ApiProperty({ enum: AVAILABILITY_PREFERENCES, required: false })
  @IsOptional()
  @IsIn([...AVAILABILITY_PREFERENCES])
  availabilityPreference?: (typeof AVAILABILITY_PREFERENCES)[number];
}

export class UpdateTechnicianAvailabilityDto {
  @ApiProperty({ enum: AVAILABILITY_PREFERENCES })
  @IsIn([...AVAILABILITY_PREFERENCES])
  availabilityPreference!: (typeof AVAILABILITY_PREFERENCES)[number];
}

export class AssignTechnicianDto {
  @ApiProperty({
    description: 'Omit to assign the authenticated shop owner to this repair.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  technicianId?: string;

  @ApiProperty({ required: false, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiProperty({ required: false, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class TechnicianProgressDto {
  @ApiProperty({ required: false, maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: string;
}
