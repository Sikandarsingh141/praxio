import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  Patch,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateQuotationDto,
  CreateRepairRequestDto,
  CreateRepairReviewDto,
  CustomerPickupVerificationDto,
  GeocodeQueryDto,
  CustomerRepairRequestListQueryDto,
  ShopSearchDto,
  ReportRepairIssueDto,
  UpdateRepairRequestDto,
  UpdateQuotationStatusDto,
} from './customer-portal.dto';
import { CustomerPortalService } from './customer-portal.service';

interface AuthenticatedCustomerRequest extends Request {
  auth?: { userId: string };
}

interface UploadedPhoto {
  buffer: Buffer;
  mimetype: string;
}

const PHOTO_LIMIT = 1024 * 1024;
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Controller('customer')
@UseGuards(JwtAuthGuard)
@ApiTags('Customer portal')
@ApiCookieAuth('access_token')
export class CustomerPortalController {
  constructor(private readonly portal: CustomerPortalService) {}

  @Get('shops')
  @ApiOperation({ summary: 'Search approved repair shops' })
  async searchShops(
    @Req() request: AuthenticatedCustomerRequest,
    @Query() query: ShopSearchDto,
  ) {
    await this.portal.requireActiveCustomer(this.userId(request));
    return { data: { shops: await this.portal.searchShops(query) } };
  }

  @Get('shops/:id')
  @ApiOperation({ summary: 'Get an approved repair shop profile' })
  async getShop(
    @Req() request: AuthenticatedCustomerRequest,
    @Param('id') id: string,
  ) {
    await this.portal.requireActiveCustomer(this.userId(request));
    return { data: { shop: await this.portal.getShop(id) } };
  }

  @Get('addresses')
  @ApiOperation({ summary: 'Suggest locations from the configured geocoder' })
  async suggestAddresses(
    @Req() request: AuthenticatedCustomerRequest,
    @Query() query: GeocodeQueryDto,
  ) {
    await this.portal.requireActiveCustomer(this.userId(request));
    return {
      data: { suggestions: await this.portal.searchAddresses(query.q) },
    };
  }

  @Get('repair-requests')
  async getRepairRequests(
    @Req() request: AuthenticatedCustomerRequest,
    @Query() query: CustomerRepairRequestListQueryDto,
  ) {
    return {
      data: {
        requests: await this.portal.getMyRepairRequests(
          this.userId(request),
          query,
        ),
      },
    };
  }

  @Patch('repair-requests/:id')
  @ApiOperation({
    summary:
      'Update an open repair request before any shop submits a quotation',
  })
  @UseInterceptors(
    FilesInterceptor('photos', 4, {
      limits: { fileSize: PHOTO_LIMIT, files: 4 },
    }),
  )
  async updateRepairRequest(
    @Req() request: AuthenticatedCustomerRequest,
    @Param('id') id: string,
    @Body() input: UpdateRepairRequestDto,
    @UploadedFiles() photos: UploadedPhoto[] = [],
  ) {
    if (
      photos.some(
        (photo) =>
          !PHOTO_TYPES.has(photo.mimetype) ||
          !this.hasValidImageSignature(photo),
      )
    ) {
      throw new BadRequestException(
        'Repair photos must be valid JPEG, PNG, or WebP images.',
      );
    }
    const savedPhotos = photos.map((photo) => ({
      mimeType: photo.mimetype,
      data: `data:${photo.mimetype};base64,${photo.buffer.toString('base64')}`,
    }));
    return {
      data: {
        request: await this.portal.updateRepairRequest(
          this.userId(request),
          id,
          input,
          savedPhotos,
        ),
      },
    };
  }

  @Get('repair-requests/:id')
  async getRepairJob(
    @Req() request: AuthenticatedCustomerRequest,
    @Param('id') id: string,
  ) {
    return {
      data: {
        repairJob: await this.portal.getCustomerRepairJob(
          this.userId(request),
          id,
        ),
      },
    };
  }

  @Patch('repair-requests/:id/confirm-pickup')
  async confirmPickup(
    @Req() request: AuthenticatedCustomerRequest,
    @Param('id') id: string,
    @Body() input: CustomerPickupVerificationDto,
  ) {
    return {
      data: {
        repairJob: await this.portal.verifyCustomerPickup(
          this.userId(request),
          id,
          input,
        ),
      },
    };
  }

  @Post('repair-requests/:id/report-issue')
  async reportRepairIssue(
    @Req() request: AuthenticatedCustomerRequest,
    @Param('id') id: string,
    @Body() input: ReportRepairIssueDto,
  ) {
    return {
      data: {
        repairJob: await this.portal.reportRepairIssue(
          this.userId(request),
          id,
          input.description,
        ),
      },
    };
  }

  @Post('repair-requests/:id/reviews')
  async createRepairReview(
    @Req() request: AuthenticatedCustomerRequest,
    @Param('id') id: string,
    @Body() input: CreateRepairReviewDto,
  ) {
    return {
      data: {
        review: await this.portal.createRepairReview(
          this.userId(request),
          id,
          input,
        ),
      },
    };
  }

  @Get('quotations')
  async getQuotations(
    @Req() request: AuthenticatedCustomerRequest,
    @Query() query: import('./customer-portal.dto').QuotationListQueryDto,
  ) {
    return {
      data: await this.portal.getCustomerQuotations(
        this.userId(request),
        query,
      ),
    };
  }

  @Post('repair-requests')
  @UseInterceptors(
    FilesInterceptor('photos', 4, {
      limits: { fileSize: PHOTO_LIMIT, files: 4 },
    }),
  )
  async createRepairRequest(
    @Req() request: AuthenticatedCustomerRequest,
    @Body() input: CreateRepairRequestDto,
    @UploadedFiles() photos: UploadedPhoto[] = [],
  ) {
    if (
      photos.some(
        (photo) =>
          !PHOTO_TYPES.has(photo.mimetype) ||
          !this.hasValidImageSignature(photo),
      )
    ) {
      throw new BadRequestException(
        'Repair photos must be valid JPEG, PNG, or WebP images.',
      );
    }
    const savedPhotos = photos.map((photo) => ({
      mimeType: photo.mimetype,
      data: `data:${photo.mimetype};base64,${photo.buffer.toString('base64')}`,
    }));
    return {
      data: {
        request: await this.portal.createRepairRequest(
          this.userId(request),
          input,
          savedPhotos,
        ),
      },
    };
  }

  @Get('shop-requests')
  async getShopRequests(@Req() request: AuthenticatedCustomerRequest) {
    return {
      data: {
        requests: await this.portal.getShopRepairRequests(this.userId(request)),
      },
    };
  }

  @Post('shop-requests/:id/quotation')
  async createQuotation(
    @Req() request: AuthenticatedCustomerRequest,
    @Param('id') id: string,
    @Body() input: CreateQuotationDto,
  ) {
    return {
      data: {
        quotation: await this.portal.createQuotation(
          this.userId(request),
          id,
          input,
        ),
      },
    };
  }

  @Patch('quotations/:id/status')
  async updateQuotationStatus(
    @Req() request: AuthenticatedCustomerRequest,
    @Param('id') id: string,
    @Body() input: UpdateQuotationStatusDto,
  ) {
    return {
      data: {
        quotation: await this.portal.updateQuotationStatus(
          this.userId(request),
          id,
          input.status,
          input.rejectionReason,
        ),
      },
    };
  }

  private userId(request: AuthenticatedCustomerRequest): string {
    const userId = request.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    return userId;
  }

  private hasValidImageSignature(image: UploadedPhoto): boolean {
    const { buffer, mimetype } = image;
    if (mimetype === 'image/jpeg') {
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );
    }
    if (mimetype === 'image/png') {
      return (
        buffer.length >= 8 &&
        buffer
          .subarray(0, 8)
          .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      );
    }
    return (
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    );
  }
}
