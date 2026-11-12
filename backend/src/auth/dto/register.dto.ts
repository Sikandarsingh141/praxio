import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MaxUtf8Bytes } from '../validators/max-utf8-bytes.validator';

export class RegisterDto {
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

  @ApiProperty({
    example: 'a-correct-horse-battery',
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
}
