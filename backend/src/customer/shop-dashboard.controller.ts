import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ShopPortalGuard } from '../auth/shop-portal.guard';
import { ShopDashboardQueryDto } from './customer-portal.dto';
import { CustomerPortalService } from './customer-portal.service';

@Controller('shop/dashboard')
@UseGuards(JwtAuthGuard, ShopPortalGuard)
@ApiTags('Shop dashboard')
@ApiCookieAuth('access_token')
export class ShopDashboardController {
  constructor(private readonly portal: CustomerPortalService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Get dashboard metrics for the authenticated repair shop',
  })
  async overview(
    @Req() request: AuthenticatedRequest,
    @Query() query: ShopDashboardQueryDto,
  ) {
    const shopId = request.auth?.userId;
    if (!shopId) {
      throw new UnauthorizedException('Authentication required');
    }
    return {
      data: await this.portal.getShopDashboardOverview(shopId, query),
    };
  }
}
