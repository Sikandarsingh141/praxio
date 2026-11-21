import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
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
  @IsIn(['true', 'false'])
  outstandingOnly?: 'true' | 'false';

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

export class ShopFinancialReportQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export enum FinancialPaymentMethod {
  Cash = 'cash',
  Upi = 'upi',
  BankTransfer = 'bank_transfer',
  Stripe = 'stripe',
}

export enum RecordedPaymentStatus {
  Pending = 'pending',
  Succeeded = 'succeeded',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export enum FinancialTransactionSortBy {
  Date = 'date',
  Amount = 'amount',
}

export enum FinancialTransactionSortOrder {
  Ascending = 'asc',
  Descending = 'desc',
}

export class ShopFinancialTransactionsQueryDto extends ShopFinancialReportQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsEnum(FinancialPaymentMethod)
  method?: FinancialPaymentMethod;

  @IsOptional()
  @IsEnum(RecordedPaymentStatus)
  status?: RecordedPaymentStatus;

  @IsOptional()
  @IsEnum(FinancialTransactionSortBy)
  sortBy: FinancialTransactionSortBy = FinancialTransactionSortBy.Date;

  @IsOptional()
  @IsEnum(FinancialTransactionSortOrder)
  sortOrder: FinancialTransactionSortOrder =
    FinancialTransactionSortOrder.Descending;

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
