import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminRoleGuard } from '../admin/admin-role.guard';
import { AuthModule } from '../auth/auth.module';
import { ShopPortalGuard } from '../auth/shop-portal.guard';
import {
  RepairQuotation,
  RepairQuotationSchema,
  RepairRequest,
  RepairRequestSchema,
} from '../customer/repair-request.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { RegistrationsModule } from '../registrations/registrations.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UsersModule } from '../users/users.module';
import {
  AdminDisputesController,
  CustomerDisputesController,
  ShopDisputesController,
} from './disputes.controller';
import { DisputesService } from './disputes.service';
import { Dispute, DisputeSchema } from './schemas/dispute.schema';

@Module({
  imports: [
    AuthModule,
    RegistrationsModule,
    UsersModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: Dispute.name, schema: DisputeSchema },
      { name: RepairRequest.name, schema: RepairRequestSchema },
      { name: RepairQuotation.name, schema: RepairQuotationSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [
    CustomerDisputesController,
    ShopDisputesController,
    AdminDisputesController,
  ],
  providers: [AdminRoleGuard, ShopPortalGuard, DisputesService],
})
export class DisputesModule {}
