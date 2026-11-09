import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  Body,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminRoleGuard } from './admin-role.guard';
import {
  AdminRegistrationRequest,
  AdminDashboardOverview,
  AdminUserDetails,
  AdminService,
  RegistrationRequestPage,
  ShopApplication,
} from './admin.service';
import { DeclineRegistrationDto } from './dto/decline-registration.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
@ApiTags('Administration')
@ApiCookieAuth('access_token')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/overview')
  @ApiOperation({ summary: 'Get date-filtered Admin marketplace analytics' })
  async getDashboardOverview(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<{ data: AdminDashboardOverview }> {
    return { data: await this.adminService.getDashboardOverview(from, to) };
  }

  @Get('repair-jobs')
  @ApiOperation({
    summary: 'Monitor confirmed repair jobs and their workflow status',
  })
  async getRepairJobs(
    @Query('status') status?: string,
    @Query('requestId') requestId?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ): Promise<{
    data: Awaited<ReturnType<AdminService['getRepairJobMonitor']>>;
  }> {
    return {
      data: await this.adminService.getRepairJobMonitor({
        status,
        requestId,
        search,
        from,
        to,
        page,
        limit,
      }),
    };
  }

  @Get('repair-reviews')
  @ApiOperation({
    summary: 'Review verified customer feedback for completed repairs',
  })
  async getRepairReviews(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ): Promise<{
    data: Awaited<ReturnType<AdminService['getRepairReviewMonitor']>>;
  }> {
    return {
      data: await this.adminService.getRepairReviewMonitor({ page, limit }),
    };
  }

  @Get('users')
  @ApiOperation({ summary: 'List customer and shop user accounts' })
  async getUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('accountType') accountType?: string,
    @Query('search') search?: string,
    @Query('accountStatus') accountStatus?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ): Promise<{ data: RegistrationRequestPage }> {
    return {
      data: await this.adminService.getUsers({
        page,
        limit,
        status,
        accountType,
        search,
        accountStatus,
        fromDate,
        toDate,
        sortBy,
        sortOrder,
      }),
    };
  }

  @Get('users/statistics')
  @ApiOperation({ summary: 'Get customer and shop account statistics' })
  async getUserStatistics(): Promise<{
    data: Awaited<ReturnType<AdminService['getUserStatistics']>>;
  }> {
    return { data: await this.adminService.getUserStatistics() };
  }

  @Get('users/:id/activity')
  @ApiOperation({ summary: 'Get immutable administrative activity for a user' })
  async getUserActivity(
    @Param('id') id: string,
  ): Promise<{ data: Awaited<ReturnType<AdminService['getUserActivity']>> }> {
    return { data: await this.adminService.getUserActivity(id) };
  }

  @Patch('users/:id/status')
  @ApiOperation({
    summary: 'Activate, deactivate, or suspend an approved account',
  })
  async updateUserStatus(
    @Param('id') id: string,
    @Body() input: UpdateUserStatusDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{
    data: Awaited<ReturnType<AdminService['updateUserStatus']>>;
  }> {
    const adminId = request.auth?.userId;
    if (!adminId) {
      throw new UnauthorizedException('Authentication required');
    }
    return {
      data: await this.adminService.updateUserStatus(
        id,
        adminId,
        input.status,
        input.reason,
      ),
    };
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get customer or shop account details' })
  async getUserDetails(
    @Param('id') id: string,
  ): Promise<{ data: AdminUserDetails }> {
    return { data: await this.adminService.getUserDetails(id) };
  }

  @Patch('registration-requests/:id/approve')
  @ApiOperation({ summary: 'Approve a customer or shop registration' })
  async approveRegistration(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ data: { request: AdminRegistrationRequest } }> {
    const adminId = request.auth?.userId;
    if (!adminId) {
      throw new UnauthorizedException('Authentication required');
    }
    return {
      data: {
        request: await this.adminService.approveRegistration(id, adminId),
      },
    };
  }

  @Patch('registration-requests/:id/decline')
  @ApiOperation({ summary: 'Decline a customer or shop registration' })
  async declineRegistration(
    @Param('id') id: string,
    @Body() input: DeclineRegistrationDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ data: { request: AdminRegistrationRequest } }> {
    const adminId = request.auth?.userId;
    if (!adminId) {
      throw new UnauthorizedException('Authentication required');
    }
    return {
      data: {
        request: await this.adminService.declineRegistration(
          id,
          adminId,
          input,
        ),
      },
    };
  }

  @Get('shops/pending')
  @ApiOperation({ summary: 'List shop applications awaiting review' })
  @ApiResponse({ status: 200, description: 'Pending shop applications.' })
  async getPendingShops(): Promise<{ data: { shops: ShopApplication[] } }> {
    return { data: { shops: await this.adminService.getPendingShops() } };
  }

  @Patch('shops/:id/approve')
  @ApiOperation({ summary: 'Approve a pending shop application' })
  @ApiResponse({ status: 200, description: 'Shop account approved.' })
  async approveShop(
    @Param('id') id: string,
  ): Promise<{ data: { shop: ShopApplication } }> {
    return { data: { shop: await this.adminService.approveShop(id) } };
  }

  @Patch('shops/:id/reject')
  @ApiOperation({ summary: 'Reject a pending shop application' })
  @ApiResponse({ status: 200, description: 'Shop application rejected.' })
  async rejectShop(
    @Param('id') id: string,
    @Body() input: DeclineRegistrationDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<{ data: { shop: ShopApplication } }> {
    const adminId = request.auth?.userId;
    if (!adminId) {
      throw new UnauthorizedException('Authentication required');
    }
    return {
      data: {
        shop: await this.adminService.rejectShop(id, adminId, input.reason),
      },
    };
  }
}
