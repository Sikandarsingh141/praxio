import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RegistrationService } from '../registrations/registration.service';
import { UsersService } from '../users/users.service';
import { ShopPortalGuard } from './shop-portal.guard';

describe('ShopPortalGuard', () => {
  const request = {
    auth: { userId: '507f1f77bcf86cd799439011', email: 'shop@example.com' },
  };
  const usersService = { findById: jest.fn() };
  const registrationService = { findShopRequestForUser: jest.fn() };
  const guard = new ShopPortalGuard(
    usersService as unknown as UsersService,
    registrationService as unknown as RegistrationService,
  );
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows the portal only for a paid, approved, active shop', async () => {
    usersService.findById.mockResolvedValue({
      accountType: 'shop',
      accountStatus: 'active',
    });
    registrationService.findShopRequestForUser.mockResolvedValue({
      registrationStatus: 'approved',
      paymentStatus: 'paid',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(registrationService.findShopRequestForUser).toHaveBeenCalledWith(
      request.auth.userId,
    );
  });

  it.each([
    ['unpaid', 'pending', 'pending_approval'],
    ['paid', 'pending', 'pending_approval'],
    ['paid', 'declined', 'rejected'],
  ] as const)(
    'blocks a %s, %s, %s Shop',
    async (paymentStatus, registrationStatus, accountStatus) => {
      usersService.findById.mockResolvedValue({
        accountType: 'shop',
        accountStatus,
      });
      registrationService.findShopRequestForUser.mockResolvedValue({
        registrationStatus,
        paymentStatus,
      });

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    },
  );

  it('blocks legacy shops without a payment-backed registration request', async () => {
    usersService.findById.mockResolvedValue({
      accountType: 'shop',
      accountStatus: 'active',
    });
    registrationService.findShopRequestForUser.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
