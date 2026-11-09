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

const PROFILE_IMAGE_MAX_BYTES = 1024 * 1024;
const PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface UploadedProfileImage {
  buffer: Buffer;
  mimetype: string;
}

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
      limits: { fileSize: PROFILE_IMAGE_MAX_BYTES, files: 1 },
    }),
  )
  async uploadProfileImage(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() image?: UploadedProfileImage,
  ): Promise<{ data: { user: SafeUser } }> {
    const userId = request.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }
    if (
      !image ||
      !PROFILE_IMAGE_TYPES.has(image.mimetype) ||
      !this.hasValidImageSignature(image)
    ) {
      throw new BadRequestException('Upload a valid JPEG, PNG, or WebP image.');
    }

    const profileImageData = `data:${image.mimetype};base64,${image.buffer.toString('base64')}`;
    const user = await this.usersService.updateProfile(userId, {
      profileImageData,
    });
    return { data: { user: await this.authService.toAuthenticatedUser(user) } };
  }

  private hasValidImageSignature(image: UploadedProfileImage): boolean {
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
    if (mimetype === 'image/webp') {
      return (
        buffer.length >= 12 &&
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP'
      );
    }
    return false;
  }
}
