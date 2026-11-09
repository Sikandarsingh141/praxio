import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ShopPortalGuard } from '../auth/shop-portal.guard';
import {
  AdditionalChargeRequestDto,
  CustomerRepairDecisionDto,
  InspectionReportDto,
} from './repair-workflow.dto';
import { CustomerPortalService } from './customer-portal.service';

@Controller('shop/repair-requests')
@UseGuards(JwtAuthGuard, ShopPortalGuard)
@ApiTags('Shop repair workflow')
@ApiCookieAuth('access_token')
export class ShopRepairWorkflowController {
  constructor(private readonly portal: CustomerPortalService) {}

  @Post(':id/start-inspection')
  async startInspection(
    @Req() request: AuthenticatedRequest,
    @Param('id') requestId: string,
  ) {
    return {
      data: {
        repairJob: await this.portal.startRepairInspection(
          this.shopId(request),
          requestId,
        ),
      },
    };
  }

  @Post(':id/inspection-report')
  async saveInspection(
    @Req() request: AuthenticatedRequest,
    @Param('id') requestId: string,
    @Body() input: InspectionReportDto,
  ) {
    return {
      data: {
        repairJob: await this.portal.saveRepairInspection(
          this.shopId(request),
          requestId,
          input,
        ),
      },
    };
  }

  @Post(':id/start-repair')
  async startRepair(
    @Req() request: AuthenticatedRequest,
    @Param('id') requestId: string,
  ) {
    return {
      data: {
        repairJob: await this.portal.startApprovedRepair(
          this.shopId(request),
          requestId,
        ),
      },
    };
  }

  @Post(':id/additional-charges')
  async requestAdditionalCharges(
    @Req() request: AuthenticatedRequest,
    @Param('id') requestId: string,
    @Body() input: AdditionalChargeRequestDto,
  ) {
    return {
      data: {
        chargeRequest: await this.portal.requestAdditionalCharges(
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

@Controller('customer/repair-requests')
@UseGuards(JwtAuthGuard)
@ApiTags('Customer repair workflow')
@ApiCookieAuth('access_token')
export class CustomerRepairWorkflowController {
  constructor(private readonly portal: CustomerPortalService) {}

  @Patch(':id/inspection/approve')
  async approveInspection(
    @Req() request: AuthenticatedRequest,
    @Param('id') requestId: string,
  ) {
    return {
      data: {
        repairJob: await this.portal.decideRepairInspection(
          this.userId(request),
          requestId,
          'approve',
        ),
      },
    };
  }

  @Patch(':id/inspection/decline')
  async declineInspection(
    @Req() request: AuthenticatedRequest,
    @Param('id') requestId: string,
    @Body() input: CustomerRepairDecisionDto,
  ) {
    return {
      data: {
        repairJob: await this.portal.decideRepairInspection(
          this.userId(request),
          requestId,
          'decline',
          input.reason,
        ),
      },
    };
  }

  @Patch(':id/additional-charges/:chargeId/accept')
  async acceptAdditionalCharges(
    @Req() request: AuthenticatedRequest,
    @Param('id') requestId: string,
    @Param('chargeId') chargeId: string,
  ) {
    return {
      data: {
        chargeRequest: await this.portal.decideAdditionalCharges(
          this.userId(request),
          requestId,
          chargeId,
          'accept',
        ),
      },
    };
  }

  @Patch(':id/additional-charges/:chargeId/decline')
  async declineAdditionalCharges(
    @Req() request: AuthenticatedRequest,
    @Param('id') requestId: string,
    @Param('chargeId') chargeId: string,
    @Body() input: CustomerRepairDecisionDto,
  ) {
    return {
      data: {
        chargeRequest: await this.portal.decideAdditionalCharges(
          this.userId(request),
          requestId,
          chargeId,
          'decline',
          input.reason,
        ),
      },
    };
  }

  private userId(request: AuthenticatedRequest): string {
    const userId = request.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return userId;
  }
}
