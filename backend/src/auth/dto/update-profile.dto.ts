import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({ example: 'Alex', minLength: 1, maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Matches(/\S/, {
    message: 'First name must contain at least one non-space character.',
  })
  firstName!: string;

  @ApiProperty({ example: 'Repair', minLength: 1, maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  @Matches(/\S/, {
    message: 'Last name must contain at least one non-space character.',
  })
  lastName!: string;
}
