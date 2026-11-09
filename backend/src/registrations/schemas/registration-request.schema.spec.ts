import { RegistrationRequestSchema } from './registration-request.schema';

describe('RegistrationRequestSchema', () => {
  it('enforces one request per user and unique registration numbers', () => {
    expect(RegistrationRequestSchema.indexes()).toEqual(
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
  });

  it('stores the registration status with timestamps', () => {
    expect(RegistrationRequestSchema.path('registrationStatus')).toBeDefined();
    expect(RegistrationRequestSchema.path('paymentStatus')).toBeDefined();
    expect(RegistrationRequestSchema.options.timestamps).toBe(true);
  });
});
