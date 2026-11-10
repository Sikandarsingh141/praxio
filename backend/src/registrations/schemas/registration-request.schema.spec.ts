import { RegistrationRequestSchema } from './registration-request.schema';

describe('RegistrationRequestSchema', () => {
  it('enforces one request per user and unique registration numbers', () => {
    const indexes = RegistrationRequestSchema.indexes();

    expect(indexes).toEqual(
      expect.arrayContaining([
        [
          { userId: 1 },
          expect.objectContaining({
            unique: true,
            name: 'UQ_registration_requests_user',
          }),
        ],
        [
          { registrationNumber: 1 },
          expect.objectContaining({
            unique: true,
            name: 'UQ_registration_requests_number',
          }),
        ],
      ]),
    );
    expect(indexes.filter(([fields]) => fields.userId === 1)).toHaveLength(1);
    expect(
      indexes.filter(([fields]) => fields.registrationNumber === 1),
    ).toHaveLength(1);
  });

  it('stores the registration status with timestamps', () => {
    expect(RegistrationRequestSchema.path('registrationStatus')).toBeDefined();
    expect(RegistrationRequestSchema.path('paymentStatus')).toBeDefined();
    expect(RegistrationRequestSchema.options.timestamps).toBe(true);
  });
});
