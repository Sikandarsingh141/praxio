import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CustomerPortalService } from '../customer/customer-portal.service';
import {
  CompleteRepairDto,
  RepairProgressDto,
} from '../customer/customer-portal.dto';
import { InspectionReportDto } from '../customer/repair-workflow.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ShopPortalGuard } from './shop-portal.guard';
import { TechnicianPortalGuard } from './technician-portal.guard';
import type { AuthenticatedRequest } from './interfaces/authenticated-request.interface';
import {
  AssignTechnicianDto,
  CreateTechnicianDto,
  TechnicianProgressDto,
  UpdateTechnicianDto,
  UpdateTechnicianAvailabilityDto,
  UpdateTechnicianStatusDto,
} from './dto/technician.dto';
import { TechniciansService } from './technicians.service';

@Controller('shop/technicians')
@UseGuards(JwtAuthGuard, ShopPortalGuard)
@ApiTags('Shop technicians')
@ApiCookieAuth('access_token')
export class TechniciansController {
  constructor(private readonly technicians: TechniciansService) {}

  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('skill') skill?: string,
  ) {
    return {
      data: {
        ...(await this.technicians.list(this.shopId(request), {
          search,
          status,
          skill,
        })),
      },
    };
  }

  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateTechnicianDto,
  ) {
    return {
      data: {
        technician: await this.technicians.create(this.shopId(request), input),
      },
    };
  }

  @Get('assignments')
  async listAssignments(@Req() request: AuthenticatedRequest) {
    return {
      data: {
        assignments: await this.technicians.listAssignments(
          this.shopId(request),
        ),
      },
    };
  }

  @Get(':id')
  async get(
    @Req() request: AuthenticatedRequest,
    @Param('id') technicianId: string,
  ) {
    return {
      data: {
        technician: await this.technicians.getTechnician(
          this.shopId(request),
          technicianId,
        ),
      },
    };
  }

  @Patch(':id')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id') technicianId: string,
    @Body() input: UpdateTechnicianDto,
  ) {
    return {
      data: {
        technician: await this.technicians.update(
          this.shopId(request),
          technicianId,
          input,
        ),
      },
    };
  }

  @Patch(':id/status')
  async updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id') technicianId: string,
    @Body() input: UpdateTechnicianStatusDto,
  ) {
    return {
      data: {
        technician: await this.technicians.updateStatus(
          this.shopId(request),
          technicianId,
          input,
        ),
      },
    };
  }

  private shopId(request: AuthenticatedRequest): string {
    const userId = request.auth?.userId;
    if (!userId) throw new UnauthorizedException('Authentication required');
    return userId;
  }
}

@Controller('shop/repair-requests')
@UseGuards(JwtAuthGuard, ShopPortalGuard)
@ApiTags('Technician assignments')
@ApiCookieAuth('access_token')
export class TechnicianAssignmentsController {
  constructor(private readonly technicians: TechniciansService) {}

  @Post(':id/assignment')
  async assign(
    @Req() request: AuthenticatedRequest,
    @Param('id') requestId: string,
    @Body() input: AssignTechnicianDto,
  ) {
    const actorId = this.userId(request);
    return {
      data: {
        ...(await this.technicians.setAssignment(
          actorId,
          requestId,
          actorId,
          input,
        )),
      },
    };
  }

  @Delete(':id/assignment')
  async unassign(
    @Req() request: AuthenticatedRequest,
    @Param('id') requestId: string,
    @Body('reason') reason = '',
  ) {
    const actorId = this.userId(request);
    return {
      data: await this.technicians.unassign(
        actorId,
        requestId,
        actorId,
        reason,
      ),
    };
  }

  private userId(request: AuthenticatedRequest): string {
    const userId = request.auth?.userId;
    if (!userId) throw new UnauthorizedException('Authentication required');
    return userId;
  }
}

@Controller('technician')
@UseGuards(JwtAuthGuard, TechnicianPortalGuard)
@ApiTags('Technician portal')
@ApiCookieAuth('access_token')
export class TechnicianPortalController {
  constructor(
    private readonly technicians: TechniciansService,
    private readonly customerPortal: CustomerPortalService,
  ) {}

  @Get('me')
  async profile(@Req() request: AuthenticatedRequest) {
    const technicianId = this.userId(request);
    const shopId = await this.technicians.technicianShopId(technicianId);
    return {
      data: {
        technician: await this.technicians.getTechnician(shopId, technicianId),
      },
    };
  }

  @Get('dashboard')
  async dashboard(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.technicians.technicianDashboard(this.userId(request)),
    };
  }

  @Get('search')
  async search(
    @Req() request: AuthenticatedRequest,
    @Query('query') query?: string,
  ) {
    return {
      data: {
        results: await this.technicians.searchTechnicianActivity(
          this.userId(request),
          query,
        ),
      },
    };
  }

  @Get('jobs')
  async jobs(
    @Req() request: AuthenticatedRequest,
    @Query('filter')
    filter:
      | 'all'
      | 'pending'
      | 'active'
      | 'today'
      | 'in_progress'
      | 'completed'
      | 'on_hold'
      | 'history' = 'all',
  ) {
    return {
      data: await this.technicians.technicianJobs(this.userId(request), filter),
    };
  }

  @Patch('me/availability')
  async updateAvailability(
    @Req() request: AuthenticatedRequest,
    @Body() input: UpdateTechnicianAvailabilityDto,
  ) {
    return {
      data: {
        technician: await this.technicians.updateOwnAvailability(
          this.userId(request),
          input.availabilityPreference,
        ),
      },
    };
  }

  @Get('jobs/:id')
  async jobDetails(
    @Req() request: AuthenticatedRequest,
    @Param('id') requestId: string,
  ) {
    return {
      data: {
        request: await this.technicians.technicianJobDetails(
          this.userId(request),
          requestId,
        ),
      },
    };
  }

  @Post('jobs/:id/start-inspection')
  async startInspection(
    @Req() request: AuthenticatedRequest,
    @Param('id') requestId: string,
  ) {
    const technicianId = this.userId(request);
    return {
      data: {
        repairJob: await this.customerPortal.startRepairInspection(
          await this.technicians.technicianShopId(technicianId),
          requestId,
          technicianId,
        ),
      },
    };
  }

  @Post('jobs/:id/inspection-report')
  async saveInspection(
    @Req() request: AuthenticatedRequest,
    @Param('id') requestId: string,
    @Body() input: InspectionReportDto,
  ) {
    const technicianId = this.userId(request);
    return {
      data: {
        repairJob: await this.customerPortal.saveRepairInspection(
          await this.technicians.technicianShopId(technicianId),
          requestId,
          input,
          technicianId,
        ),
      },
    };
  }

  @Post('jobs/:id/start-repair')
  async startRepair(
    @Req() request: AuthenticatedRequest,
    @Param('id') requestId: string,
  ) {
    const technicianId = this.userId(request);
    return {
      data: {
        repairJob: await this.customerPortal.startApprovedRepair(
          await this.technicians.technicianShopId(technicianId),
          requestId,
          technicianId,
        ),
      },
    };
  }

  @Patch('jobs/:id/start')
  async start(
    @Req() request: AuthenticatedRequest,
    @Param('id') requestId: string,
    @Body() input: RepairProgressDto,
  ) {
    const technicianId = this.userId(request);
    return {
      data: {
        repairJob: await this.customerPortal.updateRepairProgress(
          await this.technicians.technicianShopId(technicianId),
          requestId,
          'start',
          input,
          technicianId,
        ),
      },
    };
  }

  @Patch('jobs/:id/progress')
  async progress(
    @Req() request: AuthenticatedRequest,
    @Param('id') requestId: string,
    @Body() input: TechnicianProgressDto,
  ) {
    return {
      data: await this.technicians.updateProgress(
        this.userId(request),
        requestId,
        input,
      ),
    };
  }

  @Patch('jobs/:id/hold')
  async hold(
    @Req() request: AuthenticatedRequest,
    @Param('id') requestId: string,
    @Body() input: RepairProgressDto,
  ) {
    const technicianId = this.userId(request);
    return {
      data: {
        repairJob: await this.customerPortal.updateRepairProgress(
          await this.technicians.technicianShopId(technicianId),
          requestId,
          'hold',
          input,
          technicianId,
        ),
      },
    };
  }

  @Patch('jobs/:id/complete')
  async complete(
    @Req() request: AuthenticatedRequest,
    @Param('id') requestId: string,
    @Body() input: CompleteRepairDto,
  ) {
    const technicianId = this.userId(request);
    return {
      data: {
        repairJob: await this.customerPortal.completeRepair(
          await this.technicians.technicianShopId(technicianId),
          requestId,
          input,
          technicianId,
        ),
      },
    };
  }

  private userId(request: AuthenticatedRequest): string {
    const userId = request.auth?.userId;
    if (!userId) throw new UnauthorizedException('Authentication required');
    return userId;
  }
}
