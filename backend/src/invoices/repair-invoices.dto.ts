import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum InvoicePaymentMethod {
  Cash = 'cash',
  Upi = 'upi',
  BankTransfer = 'bank_transfer',
}

export enum InvoicePaymentStatus {
  Unpaid = 'UNPAID',
  PartiallyPaid = 'PARTIALLY_PAID',
  Paid = 'PAID',
}

export class RecordInvoicePaymentDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.01)
  amount!: number;

  @IsEnum(InvoicePaymentMethod)
  method!: InvoicePaymentMethod;

  @IsDateString()
  paymentDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;
}

export class ShopInvoiceListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(InvoicePaymentStatus)
  paymentStatus?: InvoicePaymentStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;
}
