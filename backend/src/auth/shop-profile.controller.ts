import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody } from '@nestjs/swagger';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService, ShopProfile } from './auth.service';
import { UpdateShopBusinessDetailsDto } from './dto/update-shop-business-details.dto';
import type { AuthenticatedRequest } from './interfaces/authenticated-request.interface';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ShopPortalGuard } from './shop-portal.guard';
import { UsersService } from '../users/users.service';
import {
  hasValidImageSignature,
  UPLOADED_IMAGE_MAX_BYTES,
  UPLOADED_IMAGE_TYPES,
} from './image-upload';
import type { UploadedImage } from './image-upload';

@Controller('shops')
@UseGuards(JwtAuthGuard)
@ApiTags('Shops')
@ApiCookieAuth('access_token')
export class ShopProfileController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Get('my-profile')
  @ApiOperation({ summary: 'Get the authenticated shop owner profile' })
  async getMyProfile(
    @Req() request: AuthenticatedRequest,
  ): Promise<{ data: { profile: ShopProfile } }> {
    const userId = request.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    return {
      data: { profile: await this.authService.getShopProfile(userId) },
    };
  }

  @Patch('my-profile/business-details')
  @ApiOperation({ summary: 'Update the authenticated shop business profile' })
  async updateMyBusinessDetails(
    @Req() request: AuthenticatedRequest,
    @Body() input: UpdateShopBusinessDetailsDto,
  ): Promise<{ data: { profile: ShopProfile } }> {
    const userId = request.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    await this.usersService.updateShopBusinessDetails(userId, input);
    return { data: { profile: await this.authService.getShopProfile(userId) } };
  }

  @Post('my-profile-image')
  @ApiOperation({ summary: 'Upload the authenticated shop image' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { image: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: UPLOADED_IMAGE_MAX_BYTES, files: 1 },
    }),
  )
  async uploadMyProfileImage(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() image?: UploadedImage,
  ): Promise<{ data: { profile: ShopProfile } }> {
    const userId = request.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    if (
      !image ||
      !UPLOADED_IMAGE_TYPES.has(image.mimetype) ||
      !hasValidImageSignature(image)
    ) {
      throw new BadRequestException('Upload a valid JPEG, PNG, or WebP image.');
    }

    await this.usersService.updateShopImage(
      userId,
      `data:${image.mimetype};base64,${image.buffer.toString('base64')}`,
    );
    return { data: { profile: await this.authService.getShopProfile(userId) } };
  }

  @Get('dashboard')
  @UseGuards(JwtAuthGuard, ShopPortalGuard)
  @ApiOperation({
    summary: 'Get the shop portal dashboard for an approved shop owner',
  })
  async getDashboard(
    @Req() request: AuthenticatedRequest,
  ): Promise<{ data: { shopName: string } }> {
    const userId = request.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const profile = await this.authService.getShopProfile(userId);
    return { data: { shopName: profile.shopName } };
  }
}
