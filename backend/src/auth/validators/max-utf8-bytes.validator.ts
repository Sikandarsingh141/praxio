import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'maxUtf8Bytes', async: false })
export class MaxUtf8BytesConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, arguments_: ValidationArguments): boolean {
    const maximum = Number(arguments_.constraints[0]);
    return (
      typeof value === 'string' &&
      Number.isSafeInteger(maximum) &&
      Buffer.byteLength(value, 'utf8') <= maximum
    );
  }

  defaultMessage(arguments_: ValidationArguments): string {
    return `${arguments_.property} must not exceed ${arguments_.constraints[0]} UTF-8 bytes`;
  }
}

export function MaxUtf8Bytes(
  maximum: number,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyKey.toString(),
      constraints: [maximum],
      options: validationOptions,
      validator: MaxUtf8BytesConstraint,
    });
  };
}
