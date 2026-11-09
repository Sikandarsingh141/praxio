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
import { QuotationListQueryDto } from './customer-portal.dto';
import { CustomerPortalService } from './customer-portal.service';

@Controller('shop/quotations')
@UseGuards(JwtAuthGuard, ShopPortalGuard)
@ApiTags('Shop quotations')
@ApiCookieAuth('access_token')
export class ShopQuotationsController {
  constructor(private readonly portal: CustomerPortalService) {}

  @Get('reviews')
  @ApiOperation({ summary: 'List verified reviews for the authenticated shop' })
  async reviews(@Req() request: AuthenticatedRequest) {
    const shopId = request.auth?.userId;
    if (!shopId) {
      throw new UnauthorizedException('Authentication required');
    }
    return { data: await this.portal.getShopReviews(shopId) };
  }

  @Get()
  @ApiOperation({
    summary: 'List quotations submitted by the authenticated shop',
  })
  async list(
    @Req() request: AuthenticatedRequest,
    @Query() query: QuotationListQueryDto,
  ) {
    const shopId = request.auth?.userId;
    if (!shopId) {
      throw new UnauthorizedException('Authentication required');
    }
    return {
      data: await this.portal.getShopQuotations(shopId, query),
    };
  }
}
