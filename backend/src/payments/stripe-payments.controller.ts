import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { ConfirmShopPaymentDto } from './dto/confirm-shop-payment.dto';
import type { ShopPaymentStatus } from './stripe-payments.service';
import { StripePaymentsService } from './stripe-payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@Controller('payments')
@ApiTags('Payments')
export class StripePaymentsController {
  constructor(
    private readonly authService: AuthService,
    private readonly stripePaymentsService: StripePaymentsService,
  ) {}

  @Post('stripe/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Stripe payment events' })
  async handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ): Promise<{ received: true }> {
    await this.stripePaymentsService.handleWebhook(request.rawBody, signature);
    return { received: true };
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get the authenticated shop payment status' })
  async getStatus(
    @Req() request: AuthenticatedRequest,
  ): Promise<{ data: { payment: ShopPaymentStatus } }> {
    const userId = request.auth?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    return {
      data: {
        payment: await this.authService.getCurrentShopPaymentStatus(userId),
      },
    };
  }

  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: 'Create or resume checkout for the authenticated shop',
  })
  async createCheckout(
    @Req() request: AuthenticatedRequest,
  ): Promise<{ data: { checkoutUrl: string } }> {
    const user = request.auth;
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    return {
      data: {
        checkoutUrl: await this.authService.createCheckoutForAuthenticatedShop(
          user.userId,
        ),
      },
    };
  }

  @Post('stripe/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a shop Checkout payment with Stripe' })
  async confirmPayment(
    @Body() input: ConfirmShopPaymentDto,
  ): Promise<{ data: { paymentStatus: 'paid' } }> {
    await this.stripePaymentsService.confirmCheckout(input.sessionId);
    return { data: { paymentStatus: 'paid' } };
  }
}
