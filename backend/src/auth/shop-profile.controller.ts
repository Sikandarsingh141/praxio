import {
  Controller,
  Get,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService, ShopProfile } from './auth.service';
import type { AuthenticatedRequest } from './interfaces/authenticated-request.interface';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ShopPortalGuard } from './shop-portal.guard';

@Controller('shops')
@UseGuards(JwtAuthGuard)
@ApiTags('Shops')
@ApiCookieAuth('access_token')
export class ShopProfileController {
  constructor(private readonly authService: AuthService) {}

  @Get('my-profile')
  @ApiOperation({ summary: 'Get the authenticated shop owner profile' })
  async getMyProfile(
    @Req() request: AuthenticatedRequest,
  ): Promise<{ data: { profile: ShopProfile } }> {
    const userId = request.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    return {
      data: { profile: await this.authService.getShopProfile(userId) },
    };
  }

  @Get('dashboard')
  @UseGuards(JwtAuthGuard, ShopPortalGuard)
  @ApiOperation({
    summary: 'Get the shop portal dashboard for an approved shop owner',
  })
  async getDashboard(
    @Req() request: AuthenticatedRequest,
  ): Promise<{ data: { shopName: string } }> {
    const userId = request.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const profile = await this.authService.getShopProfile(userId);
    return { data: { shopName: profile.shopName } };
  }
}
