import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ShopPortalGuard } from '../auth/shop-portal.guard';
import {
  CompleteRepairDto,
  CreateQuotationDto,
  DeclineRepairRequestDto,
  ReadyForPickupDto,
  RepairProgressDto,
  RepairRequestListQueryDto,
} from './customer-portal.dto';
import { CustomerPortalService } from './customer-portal.service';

@Controller('shop/repair-requests')
@UseGuards(JwtAuthGuard, ShopPortalGuard)
@ApiTags('Shop repair requests')
@ApiCookieAuth('access_token')
export class ShopRepairRequestsController {
  constructor(private readonly repairRequests: CustomerPortalService) {}

  @Get()
  @ApiOperation({
    summary: 'List repair requests shared with the authenticated shop',
  })
  async list(
    @Req() request: AuthenticatedRequest,
    @Query() query: RepairRequestListQueryDto,
  ) {
    return {
      data: {
        ...(await this.repairRequests.getShopRepairRequests(
          this.shopId(request),
          query,
        )),
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a repair request shared with this shop' })
  async get(
    @Req() request: AuthenticatedRequest,
    @Param('id') requestId: string,
  ) {
    return {
      data: {
        request: await this.repairRequests.getShopRepairRequest(
          this.shopId(request),
          requestId,
        ),
      },
    };
  }

  @Post(':id/quotation')
  @ApiOperation({
    summary: 'Accept a shared repair request and submit a quotation',
  })
  async submitQuotation(
    @Req() request: AuthenticatedRequest,
    @Param('id') requestId: string,
    @Body() input: CreateQuotationDto,
  ) {
    return {
      data: {
        quotation: await this.repairRequests.createQuotation(
          this.shopId(request),
          requestId,
          input,
        ),
      },
    };
  }

  @Post(':id/decline')
  @ApiOperation({ summary: 'Decline a shared repair request with a reason' })
  async decline(
    @Req() request: AuthenticatedRequest,
    @Param('id') requestId: string,
    @Body() input: DeclineRepairRequestDto,
  ) {
    await this.repairRequests.declineRepairRequest(
      this.shopId(request),
      requestId,
      input,
    );
    return { data: { declined: true } };
  }

  @Patch(':id/start-repair')
  async startRepair(
    @Req() request: AuthenticatedRequest,
    @Param('id') requestId: string,
    @Body() input: RepairProgressDto,
  ) {
    return {
      data: {
        repairJob: await this.repairRequests.updateRepairProgress(
          this.shopId(request),
          requestId,
          'start',
          input,
        ),
      },
    };
  }

  @Patch(':id/hold-repair')
  async holdRepair(
    @Req() request: AuthenticatedRequest,
    @Param('id') requestId: string,
    @Body() input: RepairProgressDto,
  ) {
    return {
      data: {
        repairJob: await this.repairRequests.updateRepairProgress(
          this.shopId(request),
          requestId,
          'hold',
          input,
        ),
      },
    };
  }

  @Patch(':id/complete-repair')
  async completeRepair(
    @Req() request: AuthenticatedRequest,
    @Param('id') requestId: string,
    @Body() input: CompleteRepairDto,
  ) {
    return {
      data: {
        repairJob: await this.repairRequests.completeRepair(
          this.shopId(request),
          requestId,
          input,
        ),
      },
    };
  }

  @Patch(':id/ready-for-pickup')
  async readyForPickup(
    @Req() request: AuthenticatedRequest,
    @Param('id') requestId: string,
    @Body() input: ReadyForPickupDto,
  ) {
    return {
      data: {
        repairJob: await this.repairRequests.markReadyForPickup(
          this.shopId(request),
          requestId,
          input,
        ),
      },
    };
  }

  private shopId(request: AuthenticatedRequest): string {
    const userId = request.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return userId;
  }
}
