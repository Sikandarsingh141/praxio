import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { CookieOptions, Response } from 'express';
import { AuthService, RegistrationResult, SafeUser } from './auth.service';
import { ACCESS_TOKEN_COOKIE } from './constants';
import { LoginDto } from './dto/login.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { RegisterShopDto } from './dto/register-shop.dto';
import { RegisterDto } from './dto/register.dto';
import { GeocodeQueryDto } from '../customer/customer-portal.dto';
import { CustomerPortalService } from '../customer/customer-portal.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedRequest } from './interfaces/authenticated-request.interface';

@Controller('auth')
@ApiTags('Authentication')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly customerPortal: CustomerPortalService,
  ) {}

  @Get('addresses')
  @ApiOperation({ summary: 'Suggest locations for account registration' })
  async suggestRegistrationAddresses(@Query() query: GeocodeQueryDto) {
    return {
      data: { suggestions: await this.customerPortal.searchAddresses(query.q) },
    };
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new account' })
  @ApiResponse({
    status: 201,
    description: 'Customer registration submitted for approval.',
  })
  async register(
    @Body() input: RegisterDto,
  ): Promise<{ data: RegistrationResult }> {
    return { data: await this.authService.register(input) };
  }

  @Post('register/customer')
  @ApiOperation({ summary: 'Register a customer account' })
  @ApiResponse({ status: 201, description: 'Customer account created.' })
  @ApiResponse({
    status: 409,
    description: 'Email or mobile is already registered.',
  })
  async registerCustomer(
    @Body() input: RegisterCustomerDto,
  ): Promise<{ data: RegistrationResult }> {
    const result = await this.authService.registerCustomer(input);
    return { data: result };
  }

  @Post('register/shop')
  @ApiOperation({ summary: 'Submit a shop account for approval' })
  @ApiResponse({
    status: 201,
    description: 'Shop account created and pending approval.',
  })
  @ApiResponse({
    status: 409,
    description: 'Email or mobile is already registered.',
  })
  @ApiResponse({
    status: 503,
    description: 'Stripe checkout or payment verification is not configured.',
  })
  async registerShop(
    @Body() input: RegisterShopDto,
  ): Promise<{ data: RegistrationResult }> {
    const result = await this.authService.registerShop(input);
    return { data: result };
  }

  @Post('register/shop/checkout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry checkout for a pending shop registration' })
  async retryShopCheckout(
    @Body() input: LoginDto,
  ): Promise<{ data: { checkoutUrl: string } }> {
    return {
      data: {
        checkoutUrl: await this.authService.retryShopCheckout(input),
      },
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in and receive an HttpOnly access cookie' })
  @ApiResponse({ status: 200, description: 'Signed in.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ data: { user: SafeUser; redirectTo: string } }> {
    const result = await this.authService.login(input);
    response.cookie(
      ACCESS_TOKEN_COOKIE,
      result.accessToken,
      this.getCookieOptions(),
    );
    return {
      data: { user: result.user, redirectTo: result.redirectTo },
    };
  }

  @Get('registration-status')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get the authenticated shop registration status' })
  async getRegistrationStatus(@Req() request: AuthenticatedRequest): Promise<{
    data: {
      registration: Awaited<
        ReturnType<AuthService['getCurrentShopAuthorization']>
      >;
    };
  }> {
    const userId = request.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    return {
      data: {
        registration:
          await this.authService.getCurrentShopAuthorization(userId),
      },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Sign out and clear the access cookie' })
  @ApiResponse({ status: 204, description: 'Access cookie cleared.' })
  logout(@Res({ passthrough: true }) response: Response): void {
    response.clearCookie(ACCESS_TOKEN_COOKIE, this.getCookieOptions(false));
  }

  private getCookieOptions(includeMaxAge = true): CookieOptions {
    const options: CookieOptions = {
      httpOnly: true,
      secure:
        this.configService.getOrThrow<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/api',
    };
    if (includeMaxAge) {
      options.maxAge = this.authService.getAccessTokenTtlSeconds() * 1000;
    }
    return options;
  }
}
