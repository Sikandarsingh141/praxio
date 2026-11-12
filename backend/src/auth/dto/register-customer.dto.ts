import { ApiProperty } from '@nestjs/swagger';
import {
  Equals,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RegisterCredentialsDto } from './register-credentials.dto';

export class RegisterCustomerDto extends RegisterCredentialsDto {
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

  @ApiProperty({ example: true, description: 'Terms must be accepted.' })
  @Equals(true, { message: 'Terms and conditions must be accepted.' })
  acceptTerms!: true;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
