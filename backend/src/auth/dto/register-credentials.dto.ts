import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MaxUtf8Bytes } from '../validators/max-utf8-bytes.validator';

export const PHONE_COUNTRY_CODES = [
  '+91',
  '+1',
  '+44',
  '+61',
  '+971',
  '+92',
  '+880',
] as const;

export class RegisterCredentialsDto {
  @ApiProperty({ example: 'Alex', maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Matches(/\S/)
  firstName!: string;

  @ApiProperty({ example: 'Repair', maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Matches(/\S/)
  lastName!: string;

  @ApiProperty({ example: 'alex@example.com', maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: '+91', description: 'Country calling code.' })
  @IsIn(PHONE_COUNTRY_CODES)
  countryCode!: string;

  @ApiProperty({
    example: '9876543210',
    description: 'Exactly 10 local digits.',
  })
  @IsString()
  @Matches(/^\d{10}$/, {
    message: 'Mobile number must contain exactly 10 digits.',
  })
  mobileNumber!: string;

  @ApiProperty({
    example: 'RepairShop123',
    minLength: 8,
    maxLength: 72,
    description:
      'At least 8 characters with uppercase, lowercase, and a number; no more than 72 UTF-8 bytes.',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @MaxUtf8Bytes(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password must include uppercase, lowercase, and a number.',
  })
  password!: string;

  @ApiProperty({
    description:
      'Optional Firebase token when the applicant opted in to push notifications.',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  notificationToken?: string;
}
