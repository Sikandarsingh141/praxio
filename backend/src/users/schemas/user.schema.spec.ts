import { UserSchema } from './user.schema';

describe('UserSchema', () => {
  it('creates a unique index for normalized email identity', () => {
    expect(UserSchema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { email: 1 },
          expect.objectContaining({ unique: true, name: 'UQ_users_email' }),
        ],
      ]),
    );
  });

  it('excludes password hashes by default and manages timestamps', () => {
    expect(UserSchema.path('passwordHash')?.options.select).toBe(false);
    expect(UserSchema.options.timestamps).toBe(true);
  });

  it('enforces unique mobile numbers when a phone is supplied', () => {
    expect(UserSchema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { countryCode: 1, mobileNumber: 1 },
          expect.objectContaining({
            unique: true,
            sparse: true,
            name: 'UQ_users_mobile',
          }),
        ],
      ]),
    );
  });
});
