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
export class TechnicianPortalGuard implements CanActivate {
  constructor(
    private readonly usersService: UsersService,
    private readonly registrations: RegistrationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const technicianId = request.auth?.userId;
    if (!technicianId)
      throw new UnauthorizedException('Authentication required');

    const technician = await this.usersService.findById(technicianId);
    if (
      !technician ||
      technician.accountType !== 'technician' ||
      technician.accountStatus !== 'active' ||
      technician.accountLifecycleStatus !== 'active' ||
      !technician.technicianDetails
    ) {
      throw new ForbiddenException(
        'Technician portal access is not available.',
      );
    }

    const shopId = technician.technicianDetails.shopId.toString();
    const shop = await this.usersService.findById(shopId);
    const registration =
      await this.registrations.findShopRequestForUser(shopId);
    if (
      !shop ||
      shop.accountType !== 'shop' ||
      shop.accountStatus !== 'active' ||
      shop.accountLifecycleStatus !== 'active' ||
      !registration ||
      registration.registrationStatus !== 'approved' ||
      registration.paymentStatus !== 'paid'
    ) {
      throw new ForbiddenException(
        'Technician access requires an active shop account.',
      );
    }
    return true;
  }
}
