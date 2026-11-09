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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ShopPortalGuard } from '../auth/shop-portal.guard';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { AdminRoleGuard } from '../admin/admin-role.guard';
import {
  CloseDisputeDto,
  CompleteDisputeReworkDto,
  CreateDisputeDto,
  DisputeAdditionalChargeDto,
  DisputeChargeDecisionDto,
  DisputeListQueryDto,
  DisputeMessageDto,
  DisputeProgressDto,
  DisputeReinspectionDto,
  InternalDisputeNoteDto,
  ReportUnresolvedDto,
  ShopRejectDisputeDto,
} from './dto/dispute.dto';
import { DisputesService } from './disputes.service';

@Controller('customer/disputes')
@UseGuards(JwtAuthGuard)
export class CustomerDisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Query() query: DisputeListQueryDto,
  ) {
    return {
      data: await this.disputes.listDisputes(
        { userId: this.userId(request), role: 'customer' },
        query,
      ),
    };
  }

  @Post('repair/:repairRequestId')
  async create(
    @Req() request: AuthenticatedRequest,
    @Param('repairRequestId') repairRequestId: string,
    @Body() dto: CreateDisputeDto,
  ) {
    return {
      data: await this.disputes.createCustomerDispute(
        { userId: this.userId(request), role: 'customer' },
        repairRequestId,
        dto,
      ),
    };
  }

  @Get(':id')
  async detail(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return {
      data: await this.disputes.getDispute(
        { userId: this.userId(request), role: 'customer' },
        id,
      ),
    };
  }

  @Post(':id/messages')
  async message(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: DisputeMessageDto,
  ) {
    return {
      data: await this.disputes.sendMessage(
        { userId: this.userId(request), role: 'customer' },
        id,
        dto,
      ),
    };
  }

  @Patch(':id/additional-charges/:chargeId/decision')
  async decideAdditionalCharges(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('chargeId') chargeId: string,
    @Body() dto: DisputeChargeDecisionDto,
  ) {
    return {
      data: await this.disputes.decideAdditionalCharges(
        { userId: this.userId(request), role: 'customer' },
        id,
        chargeId,
        dto,
      ),
    };
  }

  @Patch(':id/confirm-resolution')
  async confirmResolution(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: DisputeMessageDto,
  ) {
    return {
      data: await this.disputes.confirmResolution(
        { userId: this.userId(request), role: 'customer' },
        id,
        dto,
      ),
    };
  }

  @Patch(':id/report-unresolved')
  async reportUnresolved(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ReportUnresolvedDto,
  ) {
    return {
      data: await this.disputes.reportUnresolved(
        { userId: this.userId(request), role: 'customer' },
        id,
        dto,
      ),
    };
  }

  private userId(request: AuthenticatedRequest): string {
    const userId = request.auth?.userId;
    if (!userId) throw new UnauthorizedException('Authentication required');
    return userId;
  }
}

@Controller('shop/disputes')
@UseGuards(JwtAuthGuard, ShopPortalGuard)
export class ShopDisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Query() query: DisputeListQueryDto,
  ) {
    return {
      data: await this.disputes.listDisputes(
        { userId: this.userId(request), role: 'shop' },
        query,
      ),
    };
  }

  @Get(':id')
  async detail(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return {
      data: await this.disputes.getDispute(
        { userId: this.userId(request), role: 'shop' },
        id,
      ),
    };
  }

  @Post(':id/messages')
  async message(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: DisputeMessageDto,
  ) {
    return {
      data: await this.disputes.sendMessage(
        { userId: this.userId(request), role: 'shop' },
        id,
        dto,
      ),
    };
  }

  @Patch(':id/accept')
  async accept(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return {
      data: await this.disputes.acceptDispute(
        { userId: this.userId(request), role: 'shop' },
        id,
      ),
    };
  }

  @Patch(':id/reject')
  async reject(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ShopRejectDisputeDto,
  ) {
    return {
      data: await this.disputes.rejectDispute(
        { userId: this.userId(request), role: 'shop' },
        id,
        dto,
      ),
    };
  }

  @Patch(':id/reinspection/start')
  async startReinspection(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return {
      data: await this.disputes.startReinspection(
        { userId: this.userId(request), role: 'shop' },
        id,
      ),
    };
  }

  @Post(':id/reinspection')
  async submitReinspection(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: DisputeReinspectionDto,
  ) {
    return {
      data: await this.disputes.submitReinspection(
        { userId: this.userId(request), role: 'shop' },
        id,
        dto,
      ),
    };
  }

  @Post(':id/additional-charges')
  async requestAdditionalCharges(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: DisputeAdditionalChargeDto,
  ) {
    return {
      data: await this.disputes.requestAdditionalCharges(
        { userId: this.userId(request), role: 'shop' },
        id,
        dto,
      ),
    };
  }

  @Patch(':id/start-rework')
  async startRework(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return {
      data: await this.disputes.startRework(
        { userId: this.userId(request), role: 'shop' },
        id,
      ),
    };
  }

  @Post(':id/progress')
  async addProgress(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: DisputeProgressDto,
  ) {
    return {
      data: await this.disputes.addReworkProgress(
        { userId: this.userId(request), role: 'shop' },
        id,
        dto,
      ),
    };
  }

  @Patch(':id/complete-rework')
  async completeRework(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CompleteDisputeReworkDto,
  ) {
    return {
      data: await this.disputes.completeRework(
        { userId: this.userId(request), role: 'shop' },
        id,
        dto,
      ),
    };
  }

  @Patch(':id/close')
  async close(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CloseDisputeDto,
  ) {
    return {
      data: await this.disputes.closeDispute(
        { userId: this.userId(request), role: 'shop' },
        id,
        dto,
      ),
    };
  }

  private userId(request: AuthenticatedRequest): string {
    const userId = request.auth?.userId;
    if (!userId) throw new UnauthorizedException('Authentication required');
    return userId;
  }
}

@Controller('admin/disputes')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminDisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Query() query: DisputeListQueryDto,
  ) {
    return {
      data: await this.disputes.listDisputes(
        { userId: this.userId(request), role: 'admin' },
        query,
      ),
    };
  }

  @Get(':id')
  async detail(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return {
      data: await this.disputes.getDispute(
        { userId: this.userId(request), role: 'admin' },
        id,
      ),
    };
  }

  @Post(':id/messages')
  async message(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: DisputeMessageDto,
  ) {
    return {
      data: await this.disputes.sendMessage(
        { userId: this.userId(request), role: 'admin' },
        id,
        dto,
      ),
    };
  }

  @Post(':id/internal-notes')
  async addInternalNote(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: InternalDisputeNoteDto,
  ) {
    return {
      data: await this.disputes.addInternalNote(
        { userId: this.userId(request), role: 'admin' },
        id,
        dto,
      ),
    };
  }

  private userId(request: AuthenticatedRequest): string {
    const userId = request.auth?.userId;
    if (!userId) throw new UnauthorizedException('Authentication required');
    return userId;
  }
}
