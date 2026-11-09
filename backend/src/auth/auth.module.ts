import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ProfileController } from './profile.controller';
import { ShopProfileController } from './shop-profile.controller';
import { ACCESS_TOKEN_EXPIRES_IN } from './constants';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ShopPortalGuard } from './shop-portal.guard';
import { RegistrationsModule } from '../registrations/registrations.module';
import { StripePaymentsModule } from '../payments/stripe-payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationsController } from './notifications.controller';
import { StripePaymentsController } from '../payments/stripe-payments.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  RegistrationRequest,
  RegistrationRequestSchema,
} from '../registrations/schemas/registration-request.schema';
import {
  RepairQuotation,
  RepairQuotationSchema,
  RepairReview,
  RepairReviewSchema,
  RepairRequest,
  RepairRequestSchema,
} from '../customer/repair-request.schema';
import { CustomerPortalController } from '../customer/customer-portal.controller';
import { CustomerPortalService } from '../customer/customer-portal.service';
import { User, UserSchema } from '../users/schemas/user.schema';
import { ShopRepairRequestsController } from '../customer/shop-repair-requests.controller';
import { ShopQuotationsController } from '../customer/shop-quotations.controller';
import { ShopDashboardController } from '../customer/shop-dashboard.controller';
import {
  CustomerRepairWorkflowController,
  ShopRepairWorkflowController,
} from '../customer/repair-workflow.controller';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: RegistrationRequest.name, schema: RegistrationRequestSchema },
      { name: RepairRequest.name, schema: RepairRequestSchema },
      { name: RepairQuotation.name, schema: RepairQuotationSchema },
      { name: RepairReview.name, schema: RepairReviewSchema },
    ]),
    RegistrationsModule,
    StripePaymentsModule,
    NotificationsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.getOrThrow<number>(ACCESS_TOKEN_EXPIRES_IN),
        },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [
    AuthController,
    ProfileController,
    ShopProfileController,
    NotificationsController,
    StripePaymentsController,
    CustomerPortalController,
    ShopRepairRequestsController,
    ShopQuotationsController,
    ShopDashboardController,
    CustomerRepairWorkflowController,
    ShopRepairWorkflowController,
  ],
  providers: [
    AuthService,
    JwtAuthGuard,
    ShopPortalGuard,
    CustomerPortalService,
  ],
  exports: [JwtAuthGuard, ShopPortalGuard, JwtModule],
})
export class AuthModule {}
