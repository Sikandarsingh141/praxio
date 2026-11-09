import {
  BadRequestException,
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UploadedFile,
  UnauthorizedException,
  UseGuards,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody } from '@nestjs/swagger';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from '../users/users.service';
import { AuthService, SafeUser } from './auth.service';
import type { AuthenticatedRequest } from './interfaces/authenticated-request.interface';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  hasValidImageSignature,
  UPLOADED_IMAGE_MAX_BYTES,
  UPLOADED_IMAGE_TYPES,
} from './image-upload';
import type { UploadedImage } from './image-upload';

@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiTags('Users')
@ApiCookieAuth('access_token')
export class ProfileController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Safe user profile.' })
  @ApiResponse({
    status: 401,
    description: 'Missing, invalid, or expired token.',
  })
  async getProfile(
    @Req() request: AuthenticatedRequest,
  ): Promise<{ data: { user: SafeUser } }> {
    const userId = request.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    return { data: { user: await this.authService.toAuthenticatedUser(user) } };
  }

  @Patch('me/profile')
  @ApiOperation({ summary: 'Update the authenticated user profile name' })
  async updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() input: UpdateProfileDto,
  ): Promise<{ data: { user: SafeUser } }> {
    const userId = request.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const user = await this.usersService.updateProfile(userId, {
      fullName: input.fullName.trim(),
    });
    return { data: { user: await this.authService.toAuthenticatedUser(user) } };
  }

  @Post('me/profile-image')
  @ApiOperation({ summary: 'Upload an authenticated user profile image' })
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
  async uploadProfileImage(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() image?: UploadedImage,
  ): Promise<{ data: { user: SafeUser } }> {
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

    const profileImageData = `data:${image.mimetype};base64,${image.buffer.toString('base64')}`;
    const user = await this.usersService.updateProfile(userId, {
      profileImageData,
    });
    return { data: { user: await this.authService.toAuthenticatedUser(user) } };
  }

}
