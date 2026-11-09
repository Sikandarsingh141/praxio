import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { AdminRoleGuard } from './admin-role.guard';

describe('AdminRoleGuard', () => {
  const usersService = {
    findById: jest.fn(),
  };
  const guard = new AdminRoleGuard(usersService as unknown as UsersService);
  const contextFor = (userId?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          auth: userId ? { userId, email: 'admin@example.com' } : undefined,
        }),
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows only an active administrator account', async () => {
    usersService.findById.mockResolvedValue({
      accountType: 'admin',
      accountStatus: 'active',
    });

    await expect(guard.canActivate(contextFor('admin-id'))).resolves.toBe(true);
  });

  it.each([
    ['customer', 'active'],
    ['shop', 'active'],
    ['admin', 'pending_approval'],
  ])(
    'denies a %s account with %s status',
    async (accountType, accountStatus) => {
      usersService.findById.mockResolvedValue({ accountType, accountStatus });

      await expect(
        guard.canActivate(contextFor('account-id')),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it('denies requests without an authenticated user', async () => {
    await expect(guard.canActivate(contextFor())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(usersService.findById).not.toHaveBeenCalled();
  });
});
