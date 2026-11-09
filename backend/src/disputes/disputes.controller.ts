import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
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
  DisputeDecisionDto,
  DisputeAdditionalChargeDto,
  DisputeChargeDecisionDto,
  DisputeListQueryDto,
  DisputeMessageDto,
  DisputeProgressDto,
  DisputeReinspectionDto,
  InternalDisputeNoteDto,
  AdminDisputeStatusDto,
  ProposeDisputeResolutionDto,
  ReportUnresolvedDto,
  ResolveDisputeDto,
  ShopRejectDisputeDto,
  ShopDisputeResponseDto,
} from './dto/dispute.dto';
import { DisputesService } from './disputes.service';
import type { DisputeRole } from './disputes.service';

async function attachmentFile(
  disputes: DisputesService,
  actor: { userId: string; role: DisputeRole },
  id: string,
  fileId: string,
): Promise<StreamableFile> {
  const attachment = await disputes.getAttachment(actor, id, fileId);
  return new StreamableFile(attachment.stream, {
    type: attachment.mimeType,
    disposition: `inline; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
  });
}

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

  @Get(':id/attachments/:fileId')
  async attachment(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
  ) {
    return attachmentFile(
      this.disputes,
      { userId: this.userId(request), role: 'customer' },
      id,
      fileId,
    );
  }

  @Post(':id/resolution')
  async proposeResolution(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ProposeDisputeResolutionDto,
  ) {
    return {
      data: await this.disputes.proposeResolution(
        { userId: this.userId(request), role: 'customer' },
        id,
        dto,
      ),
    };
  }

  @Patch(':id/resolution/decision')
  async decideResolution(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: DisputeDecisionDto,
  ) {
    return {
      data: await this.disputes.decideResolution(
        { userId: this.userId(request), role: 'customer' },
        id,
        dto,
      ),
    };
  }

  @Patch(':id/resolve')
  async resolve(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return {
      data: await this.disputes.resolveDispute(
        { userId: this.userId(request), role: 'customer' },
        id,
        dto,
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

  @Post(':id/response')
  async respond(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ShopDisputeResponseDto,
  ) {
    return {
      data: await this.disputes.respondAsShop(
        { userId: this.userId(request), role: 'shop' },
        id,
        dto,
      ),
    };
  }

  @Get(':id/attachments/:fileId')
  async attachment(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
  ) {
    return attachmentFile(
      this.disputes,
      { userId: this.userId(request), role: 'shop' },
      id,
      fileId,
    );
  }

  @Post(':id/resolution')
  async proposeResolution(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ProposeDisputeResolutionDto,
  ) {
    return {
      data: await this.disputes.proposeResolution(
        { userId: this.userId(request), role: 'shop' },
        id,
        dto,
      ),
    };
  }

  @Patch(':id/resolution/decision')
  async decideResolution(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: DisputeDecisionDto,
  ) {
    return {
      data: await this.disputes.decideResolution(
        { userId: this.userId(request), role: 'shop' },
        id,
        dto,
      ),
    };
  }

  @Patch(':id/resolve')
  async resolve(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return {
      data: await this.disputes.resolveDispute(
        { userId: this.userId(request), role: 'shop' },
        id,
        dto,
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

  @Get(':id/attachments/:fileId')
  async attachment(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
  ) {
    return attachmentFile(
      this.disputes,
      { userId: this.userId(request), role: 'admin' },
      id,
      fileId,
    );
  }

  @Patch(':id/status')
  async updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: AdminDisputeStatusDto,
  ) {
    return {
      data: await this.disputes.updateAdminStatus(
        { userId: this.userId(request), role: 'admin' },
        id,
        dto,
      ),
    };
  }

  @Post(':id/resolution')
  async proposeResolution(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ProposeDisputeResolutionDto,
  ) {
    return {
      data: await this.disputes.proposeResolution(
        { userId: this.userId(request), role: 'admin' },
        id,
        dto,
      ),
    };
  }

  @Patch(':id/resolve')
  async resolve(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return {
      data: await this.disputes.resolveDispute(
        { userId: this.userId(request), role: 'admin' },
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
        { userId: this.userId(request), role: 'admin' },
        id,
        dto,
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
