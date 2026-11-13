import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CustomerPortalService } from '../customer/customer-portal.service';
import { AdminRoleGuard } from './admin-role.guard';
import {
  AdminMapData,
  AdminMapEntity,
  AdminMapMarker,
  AdminService,
} from './admin.service';

@Controller('admin/map')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
@ApiTags('Administration map')
@ApiCookieAuth('access_token')
export class AdminMapController {
  constructor(
    private readonly adminService: AdminService,
    private readonly customerPortal: CustomerPortalService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get filtered marketplace map markers and counts' })
  async getMapData(
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('city') city?: string,
    @Query('state') state?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('approvalStatus') approvalStatus?: string,
  ): Promise<{ data: AdminMapData }> {
    const parsedPage = page === undefined ? undefined : Number(page);
    const parsedLimit = limit === undefined ? undefined : Number(limit);
    return {
      data: await this.adminService.getMapData({
        type,
        page: parsedPage,
        limit: parsedLimit,
        search,
        city,
        state,
        from,
        to,
        status,
        approvalStatus,
      }),
    };
  }

  @Get('markers')
  @ApiOperation({ summary: 'Get filtered repair request map markers' })
  async getMapMarkers(
    @Query('search') search?: string,
    @Query('city') city?: string,
    @Query('state') state?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ): Promise<{ data: { markers: AdminMapMarker[] } }> {
    const result = await this.adminService.getMapData({
      type: 'requests',
      mapOnly: true,
      search,
      city,
      state,
      from,
      to,
      status,
    });
    return { data: { markers: result.markers ?? [] } };
  }

  @Get('repair-requests/:id')
  @ApiOperation({ summary: 'Get a repair request for the administration map' })
  async getRepairRequest(
    @Param('id') requestId: string,
  ): Promise<{ data: AdminMapEntity }> {
    return { data: await this.adminService.getMapRequest(requestId) };
  }

  @Get('repair-requests/:id/route')
  @ApiOperation({ summary: 'Get a repair request route for administrators' })
  async getRepairRoute(@Param('id') requestId: string): Promise<{
    data: {
      route: Awaited<ReturnType<CustomerPortalService['getAdminRepairRoute']>>;
    };
  }> {
    return {
      data: { route: await this.customerPortal.getAdminRepairRoute(requestId) },
    };
  }
}
