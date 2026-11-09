import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MaxUtf8Bytes } from '../validators/max-utf8-bytes.validator';

export class LoginDto {
  @ApiProperty({ example: 'alex@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'a-correct-horse-battery' })
  @IsString()
  @MaxUtf8Bytes(72)
  password!: string;
}
