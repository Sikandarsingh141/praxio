import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { RegisterCredentialsDto } from './register-credentials.dto';

export class RegisterCustomerDto extends RegisterCredentialsDto {
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
