import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserStatusDto {
  @ApiProperty({ enum: ['active', 'inactive', 'suspended'] })
  @IsIn(['active', 'inactive', 'suspended'])
  status!: 'active' | 'inactive' | 'suspended';

  @ApiProperty({ maxLength: 500, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
