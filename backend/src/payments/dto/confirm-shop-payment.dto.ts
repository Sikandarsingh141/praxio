import { IsString, Matches, MaxLength } from 'class-validator';

export class ConfirmShopPaymentDto {
  @IsString()
  @MaxLength(255)
  @Matches(/^cs_(test|live)_[A-Za-z0-9]+$/)
  sessionId!: string;
}
