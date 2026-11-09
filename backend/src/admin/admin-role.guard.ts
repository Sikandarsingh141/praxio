import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.auth?.userId;
    const user = userId ? await this.usersService.findById(userId) : null;

    if (
      !user ||
      user.accountType !== 'admin' ||
      user.accountStatus !== 'active' ||
      (user.accountLifecycleStatus !== undefined &&
        user.accountLifecycleStatus !== 'active')
    ) {
      throw new ForbiddenException('Administrator access required');
    }

    return true;
  }
}
