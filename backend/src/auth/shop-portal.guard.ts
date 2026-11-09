import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { RegistrationService } from '../registrations/registration.service';
import { UsersService } from '../users/users.service';
import { AuthenticatedRequest } from './interfaces/authenticated-request.interface';

@Injectable()
export class ShopPortalGuard implements CanActivate {
  constructor(
    private readonly usersService: UsersService,
    private readonly registrationService: RegistrationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const user = await this.usersService.findById(userId);
    if (!user || user.accountType !== 'shop') {
      throw new ForbiddenException('Shop portal access is not available.');
    }

    const registration =
      await this.registrationService.findShopRequestForUser(userId);
    if (!registration) {
      throw new ForbiddenException('Shop portal access is not available.');
    }

    if (
      user.accountStatus !== 'active' ||
      (user.accountLifecycleStatus !== undefined &&
        user.accountLifecycleStatus !== 'active') ||
      registration.registrationStatus !== 'approved' ||
      registration.paymentStatus !== 'paid'
    ) {
      throw new ForbiddenException(
        'Shop portal access requires verified payment and Admin approval.',
      );
    }

    return true;
  }
}
