import { BadRequestException } from '@nestjs/common';

export function currencyFractionDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat('en', {
        style: 'currency',
        currency: currency.toUpperCase(),
      }).resolvedOptions().maximumFractionDigits ?? 2
    );
  } catch (error) {
    if (error instanceof RangeError) {
      throw new BadRequestException('The quotation currency is invalid.');
    }
    throw error;
  }
}

export function roundCurrencyAmount(amount: number, currency: string): number {
  if (!Number.isFinite(amount)) {
    throw new BadRequestException('Invoice amounts must be finite numbers.');
  }
  const scale = 10 ** currencyFractionDigits(currency);
  return Math.round((amount + Number.EPSILON) * scale) / scale;
}

export function toMinorCurrencyUnits(amount: number, currency: string): number {
  const scale = 10 ** currencyFractionDigits(currency);
  const units = amount * scale;
  const roundedUnits = Math.round(units);
  if (
    !Number.isSafeInteger(roundedUnits) ||
    Math.abs(units - roundedUnits) > 0.000001
  ) {
    throw new BadRequestException(
      'The payment amount has unsupported currency precision.',
    );
  }
  return roundedUnits;
}

export function fromMinorCurrencyUnits(
  amount: number,
  currency: string,
): number {
  const scale = 10 ** currencyFractionDigits(currency);
  return amount / scale;
}
