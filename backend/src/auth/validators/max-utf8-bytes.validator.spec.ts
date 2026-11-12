import { validate } from 'class-validator';
import { RegisterDto } from '../dto/register.dto';

describe('MaxUtf8Bytes', () => {
  it('accepts a password within bcrypt byte limits', async () => {
    const input = Object.assign(new RegisterDto(), {
      firstName: 'Alex',
      lastName: 'Repair',
      email: 'person@example.com',
      password: `Abcdef1!${'🙂'.repeat(16)}`,
    });

    await expect(validate(input)).resolves.toHaveLength(0);
  });

  it('rejects a password beyond bcrypt byte limits', async () => {
    const input = Object.assign(new RegisterDto(), {
      firstName: 'Alex',
      lastName: 'Repair',
      email: 'person@example.com',
      password: `Abcdef1!${'🙂'.repeat(17)}`,
    });

    const errors = await validate(input);
    expect(errors.map((error) => error.property)).toContain('password');
    expect(errors[0]?.constraints).toHaveProperty('maxUtf8Bytes');
  });
});
