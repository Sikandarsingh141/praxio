import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  NotificationsService,
  RegistrationNotification,
} from '../notifications/notifications.service';
import type { AuthenticatedRequest } from './interfaces/authenticated-request.interface';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiTags('Notifications')
@ApiCookieAuth('access_token')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('my')
  @ApiOperation({
    summary: 'List the authenticated user registration notifications',
  })
  async getMyNotifications(
    @Req() request: AuthenticatedRequest,
  ): Promise<{ data: { notifications: RegistrationNotification[] } }> {
    const userId = request.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    return {
      data: {
        notifications: await this.notificationsService.getForUser(userId),
      },
    };
  }

  @Post('device-token')
  @ApiOperation({
    summary: 'Register a Firebase push token for the current user',
  })
  async registerDeviceToken(
    @Req() request: AuthenticatedRequest,
    @Body() body: { token?: unknown },
  ): Promise<{ data: { registered: true } }> {
    const userId = request.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    if (
      typeof body?.token !== 'string' ||
      body.token.trim().length < 20 ||
      body.token.length > 4096
    ) {
      throw new BadRequestException(
        'A valid Firebase device token is required',
      );
    }

    await this.notificationsService.registerDeviceToken(
      userId,
      body.token.trim(),
    );
    return { data: { registered: true } };
  }

  @Delete('device-token')
  @ApiOperation({
    summary: 'Remove a Firebase push token from the current user',
  })
  async removeDeviceToken(
    @Req() request: AuthenticatedRequest,
    @Body() body: { token?: unknown },
  ): Promise<{ data: { removed: true } }> {
    const userId = request.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    if (typeof body?.token !== 'string' || body.token.length > 4096) {
      throw new BadRequestException(
        'A valid Firebase device token is required',
      );
    }

    await this.notificationsService.removeDeviceToken(userId, body.token);
    return { data: { removed: true } };
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: 'Mark one of the current user notifications as read',
  })
  async markRead(
    @Req() request: AuthenticatedRequest,
    @Param('id') notificationId: string,
  ): Promise<{ data: { read: true } }> {
    const userId = request.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    await this.notificationsService.markRead(userId, notificationId);
    return { data: { read: true } };
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all current user notifications as read' })
  async markAllRead(
    @Req() request: AuthenticatedRequest,
  ): Promise<{ data: { read: true } }> {
    const userId = request.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    await this.notificationsService.markAllRead(userId);
    return { data: { read: true } };
  }
}
