import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { TABLE_APPEARANCES } from '../../users/schemas/user.schema';

export class UpdateTableAppearanceDto {
  @ApiProperty({ enum: TABLE_APPEARANCES })
  @IsIn(TABLE_APPEARANCES)
  tableAppearance!: (typeof TABLE_APPEARANCES)[number];
}
