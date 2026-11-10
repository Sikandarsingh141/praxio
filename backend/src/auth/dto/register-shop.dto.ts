import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Matches,
  IsNumber,
  Min,
} from 'class-validator';
import { RegisterCredentialsDto } from './register-credentials.dto';

export const SHOP_BUSINESS_TYPES = [
  'Electronics Repair Shop',
  'Electrician',
  'AC Repair Service',
  'Mobile Repair Shop',
  'Laptop & Computer Repair',
  'Home Appliance Repair',
  'Independent Technician',
] as const;

export const SHOP_SERVICES = [
  'Refrigerator Repair',
  'AC Repair',
  'Washing Machine Repair',
  'TV Repair',
  'Mobile Repair',
  'Laptop Repair',
  'Fan Repair',
  'Cooler Repair',
] as const;

export class RegisterShopDto extends RegisterCredentialsDto {
  @ApiProperty({
    description:
      'Optional JPEG, PNG, or WebP profile photo as a base64 data URL.',
    required: false,
    maxLength: 1_400_000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1_400_000)
  @Matches(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/)
  profileImageData?: string;

  @ApiProperty({
    description: 'Optional JPEG, PNG, or WebP shop image as a base64 data URL.',
    required: false,
    maxLength: 1_400_000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1_400_000)
  @Matches(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/)
  shopImageData?: string;

  @ApiProperty({ example: 'Fixroa Repairs', maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  shopName!: string;

  @ApiProperty({ enum: SHOP_BUSINESS_TYPES })
  @IsIn([...SHOP_BUSINESS_TYPES])
  businessType!: (typeof SHOP_BUSINESS_TYPES)[number];

  @ApiProperty({
    example: 'Repairs for household electronics.',
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description!: string;

  @ApiProperty({ example: 5, minimum: 0, maximum: 100 })
  @IsInt()
  @Min(0)
  @Max(100)
  yearsOfExperience!: number;

  @ApiProperty({ example: '10 Main Street', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  address!: string;

  @ApiProperty({ example: '10 Main Street', maxLength: 200, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  street?: string;

  @ApiProperty({ example: 'Sector 70', maxLength: 100, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  area?: string;

  @ApiProperty({ example: 'Springfield', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @ApiProperty({ example: 'CA', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  state!: string;

  @ApiProperty({ example: 'United States', maxLength: 100, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiProperty({ example: '90210', maxLength: 12 })
  @IsString()
  @MaxLength(12)
  @Matches(/^[\p{L}\d -]{3,12}$/u)
  postalCode!: string;

  @ApiProperty({ example: 'Near the park', maxLength: 150, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  landmark?: string;

  @ApiProperty({ enum: SHOP_SERVICES, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn([...SHOP_SERVICES], { each: true })
  services!: (typeof SHOP_SERVICES)[number][];

  @ApiProperty({ minimum: -90, maximum: 90, required: false })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiProperty({ minimum: -180, maximum: 180, required: false })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
